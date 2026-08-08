/**
 * POST /api/auth/register
 *
 * Registration flow with OTP verification.
 *
 * Flow:
 * 1. Validate inputs (name, username, email, password)
 * 2. Check email/username uniqueness
 * 3. Create user with emailVerified = null (must verify before login)
 * 4. Generate 6-digit OTP code
 * 5. Send OTP via email
 * 6. Return success (user must verify OTP to complete registration)
 *
 * If email already exists:
 * - hasPassword → "This email is already registered. Please sign in."
 * - googleId → "This email is linked to Google. Sign in with Google."
 *
 * Security:
 * - Rate limited to 5 requests per 1 hour per IP
 * - Password is bcrypt hashed (rounds=12)
 * - OTP is 6-digit numeric, expires in 5 minutes
 * - User is created but emailVerified=null until OTP verification
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createOtpToken } from "@/services/repositories/otpRepository";
import { getEmailService } from "@/services/email/emailService";

/** Validate email format */
function validateEmail(email: string): string | null {
  if (!email?.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
}

/** Validate username (optional during registration, required later in username-setup) */
function validateUsername(username: string): string | null {
  if (!username?.trim()) return null; // Username is optional during registration
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 50) return "Username must be at most 50 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, underscores, and hyphens";
  return null;
}

/** Validate password strength — Production Requirements */
function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return "Password must contain at least one special character";
  return null;
}

/** Validate full name */
function validateFullName(name: string): string | null {
  if (!name?.trim()) return "Full name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 100) return "Name must be at most 100 characters";
  return null;
}

/** Rate limiting: max 5 requests per window */
const MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** In-memory rate limiter (extend to Redis for production). */
const registerStore = new Map<string, Date[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const timestamps = registerStore.get(identifier) ?? [];
  const recent = timestamps.filter(t => now - t.getTime() < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    registerStore.set(identifier, recent);
    return true;
  }

  recent.push(new Date());
  registerStore.set(identifier, recent);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body as {
      fullName?: string;
      username?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const fullName = raw.fullName ?? "";
    const username = raw.username ?? "";
    const email = raw.email ?? "";
    const phone = raw.phone ?? "";
    const password = raw.password ?? "";

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many registration attempts. Please wait 1 hour." },
        { status: 429 }
      );
    }

    // Validate all inputs
    const fullNameError = validateFullName(fullName);
    if (fullNameError) {
      return NextResponse.json(
        { success: false, message: fullNameError },
        { status: 400 }
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json(
        { success: false, message: usernameError },
        { status: 400 }
      );
    }

    // Always generate a username (temporary if not provided)
    const usernameValue = username.trim() || `user_${Date.now()}`;
    const usernameLower = usernameValue.trim().toLowerCase();

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json(
        { success: false, message: emailError },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json(
        { success: false, message: passwordError },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Step 1: Check if email already exists
    const existingByEmail = await db
      .select({
        id: users.id,
        googleId: users.googleId,
        hasPassword: users.hasPassword,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0) {
      const existing = existingByEmail[0];
      if (existing.hasPassword) {
        return NextResponse.json(
          { success: false, message: "This email is already registered. Please sign in instead." },
          { status: 409 }
        );
      }
      if (existing.googleId) {
        return NextResponse.json(
          { success: false, message: "This email is already linked to a Google account. Please sign in with Google or set a password first." },
          { status: 409 }
        );
      }
      // Fallback: email exists but no password and no googleId
      return NextResponse.json(
        { success: false, message: "This email is already registered." },
        { status: 409 }
      );
    }

    // Step 2: Check if username already exists (only if provided)
    if (usernameValue) {
      const existingByUsername = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.usernameLower, usernameLower))
        .limit(1);

      if (existingByUsername.length > 0) {
        return NextResponse.json(
          { success: false, message: "Username already taken" },
          { status: 409 }
        );
      }
    }

    // Step 3: Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db
      .insert(users)
      .values({
        displayName: fullName.trim(),
        username: usernameValue,
        usernameLower: usernameLower,
        email: normalizedEmail,
        phone: phone.trim() || null,
        passwordHash: passwordHash,
        hasPassword: true,
        emailVerified: null, // Must verify before login
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!user || !user[0]) {
      return NextResponse.json(
        { success: false, message: "Failed to create user" },
        { status: 500 }
      );
    }

    const createdUser = user[0];

    // Step 4: Generate OTP for email verification (AFTER user is committed)
    // CRITICAL FIX: OTP generation must happen OUTSIDE the user insert transaction
    // because otpTokens.userId has a FK constraint referencing users.id.
    // Creating OTP inside the same transaction with a different db connection
    // causes PostgreSQL foreign key violation (user row not yet visible).
    const otpResult = await createOtpToken(createdUser.id, normalizedEmail, "email");
    if (!otpResult.success || !otpResult.code) {
      console.error("[REGISTER] OTP generation failed for user:", createdUser.id);
      // User is created but OTP failed — return success so user can request resend
      // The user can complete verification later via OTP verify endpoint
    }

    // Send OTP via email (non-blocking — registration succeeds even if email fails)
    try {
      if (otpResult.code) {
        const emailService = getEmailService();
        await emailService.sendOtpEmail(
          createdUser.email,
          otpResult.code,
          "verify",
          "en"
        );
      }
    } catch (emailError) {
      // Log but DO NOT block registration
      console.error("[REGISTER] OTP email send failed (non-fatal):", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please check your email for the verification code.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";