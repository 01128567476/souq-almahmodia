import { NextResponse } from "next/server";
import { adRepository } from "@/services/repositories/adRepository";

export async function GET() {
  const ads = await adRepository.listPending();
  return NextResponse.json(ads);
}
