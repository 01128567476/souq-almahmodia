/**
 * POST /api/auth/login
 *
 * Auth.js compatible login endpoint.
 * Delegates to Auth.js signIn with Credentials provider.
 */

import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Invalid email or password" },
      { status: 401 }
    );
  }
}

export const dynamic = "force-dynamic";