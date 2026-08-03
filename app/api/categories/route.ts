import { NextResponse } from "next/server";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { getCurrentUser } from "@/lib/serverAuth";
import { isAdmin } from "@/lib/permissions";

export async function GET() {
  const categories = await categoryRepository.list();
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  // Authenticate via Auth.js session
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Authorize: only admins can create categories
  if (!isAdmin(currentUser.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const payload = (await request.json()) as {
    nameEn: string;
    nameAr: string;
    icon: string;
    color: string;
  };
  const category = await categoryRepository.create(payload);
  return NextResponse.json(category);
}
