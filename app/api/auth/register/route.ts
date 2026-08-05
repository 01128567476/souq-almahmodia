/**
 * POST /api/auth/register
 *
 * Register a new user with email and password.
 * Creates user in PostgreSQL with emailVerificationRequired=true,
 * then sends verification email. User must verify email before login.
 *
 * Request body:
 * - fullName (required): Display name
 * - username (required): Unique username
 * - email (required): Unique email address
 * - phone (optional): Phone number
 * - password (required): Password (min 8 chars, must have upper, lower, number)
 *
 * Response:
 * - success: boolean
 * - message: string
 *
 * Flow:
 * 1. Validate inputs
 * 2. Check email/username uniqueness
 * 3. Create user with emailVerified = false
 * 4. Generate verification token
 * 5. Send verification email
 * 6. Return success (user must verify email before login)
 *
 * Note: User is NOT automatically logged in after registration.
 * They must verify their email first, then login normally.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createVerificationToken } from "@/services/repositories/verificationRepository";
import { getEmailService } from "@/services/email/emailService";

/** Password minimum requirements */
const MIN_PASSWORD_LENGTH = 8;

/** Validate email format */
function validateEmail(email: string): string | null {
  if (!email?.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
}

/** Validate username */
function validateUsername(username: string): string | null {
  if (!username?.trim()) return "Username is required";
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 50) return "Username must be at most 50 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, underscores, and hyphens";
  return null;
}

/** Validate password strength */
function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
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

    // Rate limit by IP (use remote address or IP from headers)
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

    // Hash password with bcrypt (salt rounds = 12 for production)
    const passwordHash = await bcrypt.hash(password, 12);

    // Use a transaction to ensure atomicity
    const normalizedEmail = email.trim().toLowerCase();
    const usernameLower = username.trim().toLowerCase();

    const result = await db.transaction(async (tx) => {
      // Check if email already exists (case-insensitive)
      const existingByEmail = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail.length > 0) {
        return { error: "Email already registered" };
      }

      // Check if username already exists (case-insensitive)
      const existingByUsername = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.usernameLower, usernameLower))
        .limit(1);

      if (existingByUsername.length > 0) {
        return { error: "Username already taken" };
      }

      // Create user with emailVerified = false
      // hasPassword = true (this is a regular registration)
      const now = new Date();
      const [user] = await tx
        .insert(users)
        .values({
          displayName: fullName.trim(),
          username: usernameLower,
          usernameLower: usernameLower,
          email: normalizedEmail,
          phone: phone.trim() || null,
          passwordHash: passwordHash,
          hasPassword: true,
          emailVerified: null, // User must verify email before login
          role: "user",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!user) {
        return { error: "Failed to create user" };
      }

      // Generate verification token
      const tokenResult = await createVerificationToken(user.id, normalizedEmail);
      if (tokenResult.error) {
        return { error: "Failed to generate verification token" };
      }

      return { user, verificationToken: tokenResult.token };
    });

    if ("error" in result) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 409 }
      );
    }

    // Send verification email
    try {
      const emailService = getEmailService();
      const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${result.verificationToken}`;
      
      // For verification email, we just need to send the URL
      await emailService.sendVerificationEmail(
        result.user.email,
        result.verificationToken,
        "en"
      );
    } catch (emailError) {
      console.error("[REGISTER] Email send failed:", emailError);
      // Continue even if email fails — user can resend later
    }

    // User is NOT logged in — they must verify email first
    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please check your email to verify your account.",
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