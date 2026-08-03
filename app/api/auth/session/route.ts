/**
 * GET /api/auth/session
 *
 * Auth.js compatible session endpoint.
 * Returns the current user's session data.
 * Used by client-side AuthContext to fetch session on mount.
 *
 * Response shape:
 * - { data: { user: { id, name, email, role, avatar? }, expires } } | null
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession({ request });

    if (!session?.user) {
      return NextResponse.json({ data: null }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        user: {
          id: session.user.id,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          role: (session.user as Record<string, unknown>).role as
            "guest" | "user" | "admin" ?? "guest",
          avatar: (session.user as Record<string, unknown>).image as string | undefined,
        },
        expires: session.expires ?? "",
      },
    });
  } catch {
    return NextResponse.json({ data: null }, { status: 401 });
  }
}

export const dynamic = "force-dynamic";