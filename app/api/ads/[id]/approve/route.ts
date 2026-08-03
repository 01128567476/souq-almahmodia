import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";
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

  // Authorize: only admins can approve ads
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const approved = await adRepository.approve(id, {
    id: currentUser.id,
    name: currentUser.name,
  });
  return NextResponse.json(approved);
}
