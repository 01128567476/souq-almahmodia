import { NextResponse } from "next/server";
import { settingsRepository } from "@/services/repositories/settingsRepository";
import type { MarketplaceSettings } from "@/types";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";

/**
 * GET /api/settings
 *
   Returns marketplace settings (public, no auth required).
 */export async function GET() {
  const settings = await settingsRepository.get();
  return NextResponse.json(settings);
}

/**
 * PATCH /api/settings
 *   Updates marketplace settings (admin only).
 *   Authentication: Auth.js session via getCurrentUser().
 *   Authorization: role === "admin" via permissions.ts.
 */
export async function PATCH(request: Request) {
  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Authorize: only admins can update settings
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const payload = (await request.json()) as Partial<MarketplaceSettings>;
  const settings = await settingsRepository.update(payload);
  return NextResponse.json(settings);
}
