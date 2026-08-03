import { NextResponse } from "next/server";
import { userRepository } from "@/services/repositories/userRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";

/**
 * PATCH /api/users/[id]
 *   Updates a user profile.
 *
 * Permission rules:
 *            - Owner → may edit their own profile (name, phone only for now)
 *   - Admin          → may edit any user (all fields including status)
 *
 * Protected fields (never editable via API):
 *   - role, permissions, passwordHash, passwordSalt, hasPassword,
 *     emailVerified, googleId, email, createdAt, updatedAt, deletedAt
 *
 * Authentication: Auth.js session via getCurrentUser().
 */
export async function PATCH(
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

  const body = await request.json();

  // Check if user is editing their own profile
  const isOwner = currentUser.id === id;
  const isAdminRole = isAdmin(currentUser.role);

  if (!isOwner && !isAdminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build allowed update set based on role
  const allowedPatch: Partial<{
    name: string;
    email: string;
    phone: string;
    status: "active" | "suspended";
  }> = {};

  if (isOwner) {
    // Owner can only edit: name, phone
    if (typeof body.name === "string" && body.name.trim()) {
      allowedPatch.name = body.name.trim();
    }
    if (typeof body.phone === "string") {
      allowedPatch.phone = body.phone.trim() || undefined;
    }
  }

  if (isAdminRole) {
    // Admin can edit: name, email, phone, status
    if (typeof body.name === "string" && body.name.trim()) {
      allowedPatch.name = body.name.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      allowedPatch.email = body.email.trim();
    }
    if (typeof body.phone === "string") {
      allowedPatch.phone = body.phone.trim() || undefined;
    }
    const status = body.status as string | undefined;
    if (status === "active" || status === "suspended") {
      allowedPatch.status = status as "active" | "suspended";
    }
  }

  const updatedUser = await userRepository.update(id, allowedPatch, {
    action: allowedPatch.status === "suspended" ? "user_suspended"
      : allowedPatch.status === "active" ? "user_activated"
      : "profile_edited",
    actorId: currentUser.id,
    actorName: currentUser.name,
    note: `Updated fields: ${[allowedPatch.name && "name", allowedPatch.email && "email", allowedPatch.phone && "phone", allowedPatch.status && "status"].filter(Boolean).join(", ")}`,
  });

  return NextResponse.json(updatedUser);
}

export async function DELETE(
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

  // Authorize: only admins can delete users
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  await userRepository.remove(id, {
    action: "user_deleted",
    actorId: currentUser.id,
    actorName: currentUser.name,
    note: `Deleted user: ${id}`,
  });
  return NextResponse.json({ success: true });
}
