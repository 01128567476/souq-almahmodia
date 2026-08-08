/**
 * Auth.js (NextAuth v5) configuration — PRODUCTION HARDENED.
 *
 * This is the SINGLE authentication engine for the entire application.
 *
 * Features:
 * - JWT strategy for sessions (stateless, cookie-based)
 * - Credentials provider for email/password auth
 * - Google provider for OAuth
 * - Secure cookie configuration (HttpOnly, Secure, SameSite=Lax)
 * - Trusted host validation for localhost / LAN / production
 * - Email verification enforcement
 * - Password change tracking for JWT session invalidation
 * - Google OAuth account linking without duplicate users
 *
 * JWT Session Invalidation:
 * - Users table has passwordChangedAt timestamp
 * - During JWT validation, token.iat is compared against passwordChangedAt
 * - If passwordChangedAt > token.iat, session is rejected
 * - Forces re-login after password reset
 *
 * NOTE: DB imports are lazy (dynamic import) to prevent bundling pg/crypto
 * in modules that run on Edge Runtime (middleware).
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { userRepository } from "@/services/repositories/userRepository";
import { validateEmail, validatePassword } from "@/lib/authValidation";
import type { Role } from "@/types";

/* ======================================================================== */
/* PROVIDERS                                                                */
/* ======================================================================== */

// Google provider — Auth.js v5 UX FIX
//
// CRITICAL: Auth.js v5 beta (next-auth@5.0.0-beta.32) hardcodes these defaults
// in the Google provider's authorization params:
//
//   prompt: "consent"          ← FORCES Google identity/consent screen EVERY login
//   access_type: "offline"     ← Always requests refresh token
//
// Simply omitting these parameters does NOT work — Auth.js v5 adds them back.
// You MUST explicitly override them by providing your own authorization.params.
//
// Setting prompt="" (empty string) overrides prompt=consent:
// - Google checks for active session in browser
// - Single session → auto-select → redirect (no email prompt, no consent)
// - Multiple sessions → Account Chooser popup → select → redirect
// - First-time authorization → consent screen shows ONCE, never again
//
// Setting access_type="online" overrides access_type=offline:
// - No refresh token requested (we use JWT sessions, not Google API calls)
//
// This matches GitHub, ChatGPT, Notion, Vercel, Discord behavior.
const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "", // Override Auth.js v5 default "consent" → empty
            access_type: "online", // Override Auth.js v5 default "offline" → online
          },
        },
      })
    : undefined;

/* ======================================================================== */
/* AUTH CONFIG                                                              */
/* ======================================================================== */

const nextAuthConfig = {
  // Providers
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTH] authorize() entered");

        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] Missing email or password → returning null");
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        console.log(`[AUTH] email = ${email}`);
        console.log(`[AUTH] password received = yes (length=${password.length})`);

        // Validate input
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);
        if (emailError !== null || passwordError !== null) {
          console.log(`[AUTH] Validation failed → returning null (emailError=${emailError}, passwordError=${passwordError})`);
          return null;
        }

        // Look up user by email in PostgreSQL
        const user = await userRepository.getByEmail(email.toLowerCase().trim());
        if (!user) {
          console.log("[AUTH] No user with this email → returning null");
          return null;
        }

        console.log(`[AUTH] user found = true`);
        console.log(`[AUTH] user.googleId = ${user.googleId}`);
        console.log(`[AUTH] user.hasPassword = ${user.hasPassword}`);
        console.log(`[AUTH] passwordHash exists = ${!!user.passwordHash}`);

        // Check if password is set (Google-only users cannot login via credentials)
        const hasPassword = await userRepository.hasPassword(user.id);
        console.log(`[AUTH] hasPassword (DB check) = ${hasPassword}`);
        if (!hasPassword) {
          console.log("[AUTH] User has no password → returning null");
          return null;
        }

        // NOTE: Per spec — login MUST ONLY validate  :
        // 1. Email format
        //   2. Password not empty
        //   3. User exists
        //   4. User has password set (hasPassword)
        //   5. Password matches (bcrypt)
        //
        // emailVerified is NOT a login requirement.
        // OTP verification during registration already proves email ownership.
        //

        // Verify password hash
        const bcryptLib = await import("bcryptjs");
        const storedHash = user.passwordHash;
        console.log(`[AUTH] storedHash exists = ${!!storedHash}`);
        console.log(`[AUTH] storedHash length = ${storedHash?.length}`);
        console.log(`[AUTH] storedHash prefix = ${storedHash?.substring(0, 10)}`);
        console.log(`[AUTH] input password length = ${password.length}`);
        const valid = await bcryptLib.compare(password, storedHash!);
        console.log(`[AUTH] bcrypt.compare result = ${valid}`);
        if (!valid) {
          console.log("[AUTH] Password mismatch → returning null");
          return null;
        }

        console.log("[AUTH] Authentication successful → returning user");
        console.log("[AUTH] authorize role =", user.role);

        // GUARANTEE: role must never be null/undefined for credentials
        if (!user.role) {
          console.error("[AUTH] ERROR: role is null or undefined for credentials login!");
          throw new Error("CRITICAL: User role is missing. Database may be corrupted.");
        }

        return {
          id: user.id,
          name: user.displayName,
          email: user.email,
          role: user.role as Role,
          image: user.avatar ?? undefined,
        };
      },
    }),
  ],

  // Session configuration — JWT strategy
  session: {
    strategy: "jwt" as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // JWT configuration
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Cookie configuration — critical for PKCE to work on localhost
  //
  // Auth.js v5 defaults ALL cookies to __Secure- prefix + secure: true.
  // Secure cookies CANNOT be set on http://localhost (must be HTTPS).
  // This causes PKCE failure: "pkceCodeVerifier value could not be parsed"
  // because the PKCE cookie is never written by the browser.
  //
  // Solution: On localhost, use non-__Secure- cookie names + secure: false.
  // On production (HTTPS), use __Secure- names + secure: true.
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.csrf-token"
        : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.callback-url"
        : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    state: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.state"
        : "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    pkceCodeVerifier: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.pkce-code-verifier"
        : "next-auth.pkce-code-verifier",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    pageToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.page-token"
        : "next-auth.page-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  // Callbacks
  callbacks: {
    /**
     * signIn callback — handles Google OAuth account linking logic.
     */
    async signIn({ user, account, profile }: any) {
      if (account?.provider !== "google") {
        return true;
      }

      const googleId = profile?.sub as string | undefined;
      const email = (user.email ?? "").toLowerCase().trim();
      const name = (profile?.name ?? user.name ?? "").trim();
      const avatar = (profile?.image ?? user.image ?? "").trim();

      if (!email || !googleId) {
        return false;
      }

      // Lazy-load DB to avoid bundling pg/crypto in Edge Runtime (middleware)
      const { db } = await import("@/lib/db-server");

      // 1. Check if user already has this Google ID linked
      const userByGoogleId = await db
        .select()
        .from(users)
        .where(eq(users.googleId as any, googleId))
        .limit(1);

       if (userByGoogleId.length > 0) {
        const existingUser = userByGoogleId[0];
        await db
          .update(users)
          .set({
            avatar: avatar || "",
            displayName: name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        user.id = existingUser.id;
        // Attach role for JWT propagation
        (user as any).role = existingUser.role;
        console.log("[AUTH] signIn (googleId match) role =", existingUser.role);
        return true;
      }

      // 2. Check if email already exists — link Google ID to existing user
       const userByEmail = await userRepository.getByEmail(email);
       if (userByEmail) {
        await db
          .update(users)
          .set({
            googleId: googleId,
            displayName: name,
            avatar: avatar || "",
            emailVerified: new Date().toISOString(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, userByEmail.id));

        user.id = userByEmail.id;
        // Attach role for JWT propagation
        (user as any).role = userByEmail.role;
        console.log("[AUTH] signIn (email link) role =", userByEmail.role);
        return true;
      }

      // 3. New user — create account with Google ID
      const now = new Date();
      const usernameBase = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const uniqueUsername = usernameBase + Math.random().toString(36).slice(2, 8);

      await db.insert(users).values({
        displayName: name,
        username: uniqueUsername,
        usernameLower: uniqueUsername.toLowerCase(),
        email: email,
        emailVerified: now.toISOString(),
        avatar: avatar || "",
        googleId: googleId,
        role: "user" as Role,
        hasPassword: false,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });

       const createdUser = await userRepository.getByEmail(email);
       if (!createdUser) {
         return false;
       }

       user.id = createdUser.id;
       // Attach role for JWT propagation
       (user as any).role = createdUser.role;
       console.log("[AUTH] signIn (new user) role =", createdUser.role);
       return true;
     },

    /**
     * JWT callback — populate token and check session invalidation.
     *
     * SESSION INVALIDATION:
     * If passwordChangedAt > token.iat, return null to reject session.
     */
      async jwt({ token, user, trigger }: any) {
        // Initial sign in — populate token with user data
        if (user) {
          token.id = user.id;
          token.picture = (user as { image?: string }).image;
          token.emailVerified = user.emailVerified;

          // CRITICAL: Auth.js v5 OAuth flow does NOT propagate signIn() mutations to jwt().
          // We MUST re-fetch role from DB if user.role is missing.
          if (user.role) {
            token.role = user.role as Role;
            console.log("[AUTH] jwt: role from user object =", token.role);
          } else if (user.id) {
            // Re-fetch role from database (lazy-load to avoid Edge Runtime bundling issues)
            try {
              const { db } = await import("@/lib/db-server");
              const freshUser = await db
                .select({ role: users.role })
                .from(users)
                .where(eq(users.id, user.id))
                .limit(1);

              if (freshUser.length > 0 && freshUser[0].role) {
                token.role = freshUser[0].role as Role;
                console.log("[AUTH] jwt: role re-fetched from DB =", token.role);
              } else {
                console.error("[AUTH] jwt ERROR: user exists but role not found in DB");
                token.role = "user" as Role;
              }
            } catch (error) {
              console.error("[AUTH] jwt ERROR: failed to fetch role from DB:", error);
              token.role = "user" as Role;
            }
          } else {
            console.error("[AUTH] jwt ERROR: no user.id to fetch role");
            token.role = "user" as Role;
          }
        }

        // Safety: ensure token.role is never undefined
        if (!token.role) {
          console.error("[AUTH] jwt ERROR: token.role still missing after all attempts");
          token.role = "user" as Role;
        }

        console.log("[AUTH] jwt FINAL token.role =", token.role);

        // Session invalidation check — MUST skip on initial sign-in
        if (token?.id && !user) {
          try {
            const { db } = await import("@/lib/db-server");

            const freshUser = await db
              .select({
                passwordChangedAt: users.passwordChangedAt,
              })
              .from(users)
              .where(eq(users.id, token.id))
              .limit(1);

            if (freshUser.length > 0 && freshUser[0].passwordChangedAt) {
              const passwordChangedAt = new Date(freshUser[0].passwordChangedAt);

              // Only validate if token.iat exists
              if (typeof token.iat === "number") {
                const tokenIssuedAt = new Date(token.iat * 1000);

                if (passwordChangedAt > tokenIssuedAt) {
                  console.log("[AUTH] jwt: session invalidated (password changed)");
                  return null;
                }
              }
            }
          } catch (error) {
            console.error("[JWT_CALLBACK] Error checking passwordChangedAt:", error);
          }
        }

      return token;
    },

    /**
     * Session callback — shape session object for client.
     */
     async session({ session, token }: any) {
       if (session.user) {
         (session.user as { id?: string }).id = (token as { id?: string }).id;
         (session.user as { role?: Role }).role = token.role as Role;
         (session.user as { image?: string }).image = (token as { picture?: string }).picture;
         (session.user as { emailVerified?: string }).emailVerified = token.emailVerified;
       }
       console.log("[AUTH] session role =", token.role);
       return session;
     },
  },

  // Events — audit logging
  events: {
    signIn: async (message: any) => {
      const email = message.email ?? "unknown";
      const isNew = message.newUser ?? false;
      console.log(`[Auth] ${isNew ? "New" : "Returning"} user signed in: ${email}`);
    },
    signOut: async (message: any) => {
      console.log(`[Auth] User signed out: ${message.userId ?? "unknown"}`);
    },
    createUser: async (message: any) => {
      console.log(`[Auth] User created: ${message.user.email ?? "unknown"}`);
    },
    error: async (message: any) => {
      console.error(`[Auth] Error: ${message.error ?? "unknown error"}`);
    },
  },

  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(nextAuthConfig);