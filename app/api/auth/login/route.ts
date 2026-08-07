/**
 * POST /api/auth/login
 *
 * Auth.js compatible login endpoint.
 * Delegates to Auth.js signIn with Credentials provider.
 * Returns user data on success so the client can navigate without re-fetching.
 */

import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/auth";
import { db } from "@/lib/db-server";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // First, authenticate and get the user from DB
    const userRow = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (userRow.length === 0) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Authenticate via Auth.js (sets the session cookie)
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    // Auth.js returns an error object when signIn fails
    if (result?.error) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if email is verified — require verification for login
    const user = userRow[0];
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          needsVerification: true,
          email: user.email,
          message: "Your email address has not been verified. Please check your inbox for the verification code.",
        },
        { status: 403 }
      );
    }

    // Return user data from the DB query
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.displayName ?? "",
          email: user.email,
          role: user.role ?? "guest",
          avatar: user.avatar ?? undefined,
        },
      },
    });
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    return NextResponse.json(
      { message: "Invalid email or password" },
      { status: 401 }
    );
  }
}

export const dynamic = "force-dynamic";
