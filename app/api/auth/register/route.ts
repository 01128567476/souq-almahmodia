/**
 * POST /api/auth/register
 *
 * Register a new user with email and password.
 * Creates user in PostgreSQL, then authenticates via Auth.js.
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
 * - userId: string (UUID of created user)
 * - message: string
 *
 * Auth.js integration:
 * - User creation uses Drizzle ORM directly
 * - Authentication uses Auth.js signIn("credentials")
 * - Session cookie is set by Auth.js (not manually)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { hashPassword } from "@/services/repositories/passwordRepository";
import { signIn } from "@/auth";
import { eq } from "drizzle-orm";

function validateEmail(email: string): string | null {
  if (!email?.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
}

function validateUsername(username: string): string | null {
  if (!username?.trim()) return "Username is required";
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 50) return "Username must be at most 50 characters";
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, underscores, and hyphens";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
}

function validateFullName(name: string): string | null {
  if (!name?.trim()) return "Full name is required";
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 100) return "Name must be at most 100 characters";
  return null;
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

    // Validate inputs
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

    // Hash password
    const { salt: pwSalt, hash: pwHash } = hashPassword(password);

    // Use a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Check if email already exists (case-insensitive)
      const existingByEmail = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()))
        .limit(1);

      if (existingByEmail.length > 0) {
        return { error: "Email already registered" };
      }

      // Check if username already exists (case-insensitive)
      const usernameLower = username.trim().toLowerCase();
      const existingByUsername = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.usernameLower, usernameLower))
        .limit(1);

      if (existingByUsername.length > 0) {
        return { error: "Username already taken" };
      }

      // Create user
      const [user] = await tx
        .insert(users)
        .values({
          displayName: fullName.trim(),
          username: usernameLower,
          usernameLower: usernameLower,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          passwordHash: pwHash,
          passwordSalt: pwSalt,
          hasPassword: true,
          role: "user",
        })
        .returning();

      if (!user) {
        return { error: "Failed to create user" };
      }

      return { user };
    });

    if ("error" in result) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 409 }
      );
    }

    // Authenticate via Auth.js (sets session cookie)
    await signIn("credentials", {
      email: result.user.email,
      password,
      redirect: false,
    });

    return NextResponse.json(
      { success: true, userId: result.user.id, message: "Registration successful" },
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