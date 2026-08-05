/**
 * Auth.js (NextAuth v5) module augmentation.
 *
 * The jwt/session callbacks in `auth.ts` always populate `id` and `role`,
 * so the session user is typed accordingly here. Without this, `session.user.id`
 * is `string | undefined` and every consumer needs a cast.
 */

import type { DefaultSession } from "next-auth";
import type { Role } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
