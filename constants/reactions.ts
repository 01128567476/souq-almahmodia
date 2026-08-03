import type { ReactionType } from "@/types";

/**
 * Presentation config for the five reaction types. Order here is the display
 * order in the picker and the breakdown. `labelKey` maps to `reactions.*` in
 * the message catalogues; `color` tints the label when it is the active choice.
 */
export interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  labelKey: string;
  color: string;
}

export const REACTIONS: ReactionConfig[] = [
  { type: "like", emoji: "👍", labelKey: "like", color: "text-primary" },
  { type: "love", emoji: "❤️", labelKey: "love", color: "text-error" },
  { type: "funny", emoji: "😂", labelKey: "funny", color: "text-amber-600" },
  { type: "wow", emoji: "😮", labelKey: "wow", color: "text-amber-600" },
  { type: "sad", emoji: "😢", labelKey: "sad", color: "text-secondary" },
];

export const REACTION_BY_TYPE: Record<ReactionType, ReactionConfig> = REACTIONS.reduce(
  (acc, r) => {
    acc[r.type] = r;
    return acc;
  },
  {} as Record<ReactionType, ReactionConfig>,
);
