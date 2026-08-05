/**
 * Auth.js (NextAuth) configuration.
 *
 * This is the SINGLE authentication engine for the entire application.
 * All auth operations flow through here.
 *
 * Configuration:
 * - JWT strategy for sessions (stateless, cookie-based)
 * - Credentials provider for email/password auth
 * - Google provider for OAuth
 *
 * Google OAuth flow:
 * 1. User clicks "Continue with Google" on login page
 * 2. Redirected to Google for authentication
 * 3. Google returns user info (email, name, picture)
 * 4. signIn callback handles account linking:
 *    - Check if user has matching googleId -> log them in
 *    - Check if user has matching email -> link googleId to existing user
 *    - No match -> create new user with googleId + email
 * 5. JWT callback adds id, role, email, name, image to token
 * 6. Session callback adds these fields to session.user
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { userRepository } from "@/services/repositories/userRepository";
import { validateEmail, validatePassword } from "@/lib/authValidation";
import type { Role } from "@/types";

// Google provider is optional — only enabled when credentials are configured
const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      })
    : undefined;

// Auth.js (NextAuth v5) configuration.
//
// NextAuth(config) returns { handlers, auth, signIn, signOut }:
// - handlers  -> re-exported as GET/POST from app/api/auth/[...nextauth]/route.ts
// - auth      -> server-side session reads (lib/serverAuth.ts)
// - signIn    -> /api/auth/login, /api/auth/register
// - signOut   -> /api/auth/logout

const nextAuthConfig = {
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Validate input
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);
        if (emailError !== null || passwordError !== null) {
          return null;
        }

        // Look up user by email in PostgreSQL
        const user = await userRepository.getByEmail(email.toLowerCase().trim());
        if (!user) {
          return null;
        }

        // Check if password is set (Google-only users cannot login via credentials)
        const hasPassword = await userRepository.hasPassword(user.id);
        if (!hasPassword) {
          return null;
        }

        // Verify password hash
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(password, user.passwordHash!);
        if (!valid) {
          return null;
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

  // Session configuration
  session: {
    strategy: "jwt" as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Custom pages for login/logout flows
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/login",
  },

  // Callbacks - core of OAuth account linking + session population
  callbacks: {
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

      const userByGoogleId = await db
        .select()
        .from(users)
        .where(eq(users.googleId as any, googleId))
        .limit(1);

      if (userByGoogleId.length > 0) {
        await db
          .update(users)
          .set({ avatar: avatar || "", updatedAt: new Date() })
          .where(eq(users.id, userByGoogleId[0].id));

        user.id = userByGoogleId[0].id;
        return true;
      }

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
        return true;
      }

      const now = new Date();
      const username = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
      const uniqueUsername = username + Math.random().toString(36).slice(2, 6);

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
      return true;
    },

    async jwt({ token, user }: any) {
      if (user) {
        (token as { id?: string }).id = user.id;
        (token as { role?: Role }).role = (user as { role?: Role }).role;
        (token as { picture?: string }).picture = (user as { image?: string }).image;
      }
      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        (session.user as { id?: string }).id = (token as { id?: string }).id;
        (session.user as { role?: Role }).role = token.role as Role;
        (session.user as { image?: string }).image = (token as { picture?: string }).picture;
      }
      return session;
    },
  },

  events: {
    createUser: async (event: any) => {
      console.log(`[Auth] User created: ${event.user.email}`);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(nextAuthConfig);
