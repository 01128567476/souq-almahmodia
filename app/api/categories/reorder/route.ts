import { NextResponse } from "next/server";
import { categoryRepository } from "@/services/repositories/categoryRepository";

export async function POST(request: Request) {
  const payload = (await request.json()) as { order: string[] };
  const categories = await categoryRepository.reorder(payload.order);
  return NextResponse.json(categories);
}
