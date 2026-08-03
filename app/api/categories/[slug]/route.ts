import { NextResponse } from "next/server";
import { categoryRepository } from "@/services/repositories/categoryRepository";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ slug: string }>;
  },
) {
  const { slug } = await context.params;
  const payload = (await request.json()) as {
    nameEn?: string;
    nameAr?: string;
    icon?: string;
    color?: string;
    hidden?: boolean;
  };

  if (payload.hidden !== undefined) {
    const category = await categoryRepository.setHidden(slug, payload.hidden);
    return NextResponse.json(category);
  }

  const category = await categoryRepository.update(slug, {
    nameEn: payload.nameEn,
    nameAr: payload.nameAr,
    icon: payload.icon,
    color: payload.color,
  });

  return NextResponse.json(category);
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ slug: string }>;
  },
) {
  const { slug } = await context.params;
  await categoryRepository.remove(slug);
  return NextResponse.json({ success: true });
}