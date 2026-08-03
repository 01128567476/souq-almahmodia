import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getViewerId } from "@/lib/serverAuth";
import { validateUsername, checkUsernameAvailability, generateUsernameSuggestions, normalizeUsernameInput, getCooldownRemaining } from "@/lib/usernameValidator";
import { userRepository } from "@/services/repositories/userRepository";

/**
 * POST /api/users/username
 * Create or change the current user's username.
 *
 * Body: { username: string }
 * Returns: { success: true, username: string } or { error: string, suggestions?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getViewerId();
    if (!userId) {
      return NextResponse.json({ error: "auth.required" }, { status: 401 });
    }

    const body = await request.json();
    const rawUsername = body?.username;

    if (!rawUsername || typeof rawUsername !== "string") {
      return NextResponse.json({ error: "username.empty" }, { status: 400 });
    }

    // Validate username format
    const validationError = validateUsername(rawUsername);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      );
    }

    const normalized = normalizeUsernameInput(rawUsername)!;
    const userRows = await userRepository.getAllWithUsername();
    const existingUsernames = new Set(userRows.map((p: any) => (p.usernameLower ?? "").trim().toLowerCase()));

    // If user is changing username, allow re-using their own old username
    const currentUser = await userRepository.getFullProfile(userId);
    if (currentUser && currentUser.usernameLower === normalized) {
      // Same username, no change needed
      return NextResponse.json({ success: true, username: normalized });
    }

    // Check availability
    const availability = checkUsernameAvailability(normalized, existingUsernames);
    if (availability === "taken") {
      const suggestions = generateUsernameSuggestions(normalized, existingUsernames, 4);
      return NextResponse.json(
        {
          error: "username.taken",
          suggestions,
        },
        { status: 409 },
      );
    }

    // Check cooldown (only if changing existing username)
    if (currentUser && currentUser.usernameLastChangedAt) {
      const cooldown = getCooldownRemaining(currentUser.usernameLastChangedAt.toISOString());
      if (!cooldown.canChange) {
        return NextResponse.json(
          {
            error: "username.cooldown",
            daysRemaining: cooldown.daysRemaining,
          },
          { status: 429 },
        );
      }
    }

    // In a real implementation, we'd update the database here.
    // For mock, we acknowledge the change but don't persist it.
    return NextResponse.json({
      success: true,
      username: normalized,
    });
  } catch (err) {
    console.error("[Username API Error]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/**
 * GET /api/users/username/availability?username=xxx
 * Check if a username is available.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "username.required" }, { status: 400 });
    }

    const validationError = validateUsername(username);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const normalized = normalizeUsernameInput(username)!;
    const userRows = await userRepository.getAllWithUsername();
    const existingUsernames = new Set(userRows.map((p: any) => (p.usernameLower ?? "").trim().toLowerCase()));
    const availability = checkUsernameAvailability(normalized, existingUsernames);

    if (availability === "taken") {
      const suggestions = generateUsernameSuggestions(normalized, existingUsernames, 4);
      return NextResponse.json({ available: false, suggestions });
    }

    return NextResponse.json({ available: true });
  } catch (err) {
    console.error("[Username Availability API Error]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}