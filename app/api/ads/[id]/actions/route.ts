/**
 * POST /api/ads/[id]/actions
 *
 * Ad moderation actions (hide, unhide, pin, unpin, feature, unfeature, warn, suspend, ignoreReports).
 *
 * Production-only. No mock data. No temporary code.
 * All admin actions require admin role.
 * Authentication: Auth.js session via getCurrentUser().
 */

import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";
import { notificationRepository } from "@/services/repositories/notificationRepository";
import { reportRepository } from "@/services/repositories/reportRepository";

import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await context.params;

  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Authorize: all actions require admin role
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { action, message } = (await request.json()) as {
    action: string;
    message?: string;
  };

  switch (action) {
    case "hide": {
      const ad = await adRepository.hide(id, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "unhide": {
      const ad = await adRepository.unhide(id, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "pin": {
      // Pinning is ONLY allowed for approved advertisements.
      const existingAd = await adRepository.getById(id);
      if (!existingAd) {
        return NextResponse.json({ error: "Ad not found" }, { status: 404 });
      }
      if (existingAd.status !== "approved") {
        return NextResponse.json(
          { error: "Only approved advertisements can be pinned." },
          { status: 400 },
        );
      }
      const ad = await adRepository.setPinned(id, true, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "unpin": {
      const ad = await adRepository.setPinned(id, false, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "feature": {
      const ad = await adRepository.setFeatured(id, true, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "unfeature": {
      const ad = await adRepository.setFeatured(id, false, {
        id: currentUser.id,
        name: currentUser.name,
      });
      return NextResponse.json(ad);
    }
    case "warn": {
      const ad = await adRepository.getById(id);
      if (ad?.ownerId) {
        await notificationRepository.add({
          recipientId: ad.ownerId,
          adId: ad.id,
          type: "system",
          title: "Warning issued by admin",
          body: message ?? "An administrator has issued a warning about your listing.",
          read: false,
        });
      }
      return NextResponse.json({ success: true });
    }
    case "suspend": {
      const ad = await adRepository.hide(id, {
        id: currentUser.id,
        name: currentUser.name,
      });
      if (ad.ownerId) {
        await notificationRepository.add({
          recipientId: ad.ownerId,
          adId: ad.id,
          type: "system",
          title: "Account suspended",
          body: message ?? "Your seller account has been suspended pending review.",
          read: false,
        });
      }
      return NextResponse.json(ad);
    }
    case "ignoreReports": {
      const resolved = await reportRepository.resolveReportsByAdId(id);
      return NextResponse.json({ resolved });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}