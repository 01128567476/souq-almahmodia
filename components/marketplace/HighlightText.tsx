/**
 * HighlightText - Renders text with matching search terms highlighted.
 *
 * Uses proper React elements (<mark>) instead of dangerouslySetInnerHTML.
 * This ensures CSS classes are processed correctly and no HTML leaks as text.
 *
 * Usage:
 * <HighlightText text={ad.title} query={displayQuery} />
 */

"use client";

import { useMemo } from "react";
import { normalizeSearchText } from "@/utils/search";

interface HighlightTextProps {
  /** The text to highlight matches in */
  text: string;
  /** The search query */
  query: string;
  /** Additional Tailwind CSS classes for the <mark> element */
  className?: string;
}

export function HighlightText({ text, query, className = "bg-primary/20 text-inherit rounded px-0.5" }: HighlightTextProps) {
  const parts = useMemo(() => {
    if (!query || !query.trim()) {
      return [{ text, highlight: false } as const];
    }

    const tokens = normalizeSearchText(query)
      .split(/\s+/)
      .filter((t) => t.length > 0);
    
    if (tokens.length === 0) {
      return [{ text, highlight: false } as const];
    }

    const result: Array<{ text: string; highlight: boolean }> = [];
    const lowerText = text.toLowerCase();
    let lastIndex = 0;

    for (const token of tokens) {
      const lowerToken = normalizeSearchText(token).toLowerCase();
      let idx = lowerText.indexOf(lowerToken);

      while (idx !== -1) {
        // Add any text before this match
        if (idx > lastIndex) {
          result.push({ text: text.substring(lastIndex, idx), highlight: false });
        }
        // Add the matched text
        result.push({ text: text.substring(idx, idx + lowerToken.length), highlight: true });
        lastIndex = idx + lowerToken.length;
        // Find next occurrence
        idx = lowerText.indexOf(lowerToken, lastIndex);
      }
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({ text: text.substring(lastIndex), highlight: false });
    }

    // Merge adjacent non-highlighted segments
    const merged: Array<{ text: string; highlight: boolean }> = [];
    for (const part of result) {
      if (merged.length > 0 && !merged[merged.length - 1].highlight && !part.highlight) {
        merged[merged.length - 1].text += part.text;
      } else {
        merged.push({ ...part });
      }
    }

    return merged;
  }, [text, query]);

  return (
    <span>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className={className}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}