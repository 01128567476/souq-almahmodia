"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";

interface ShareProfileButtonProps {
  username: string;
  displayName: string;
}

export function ShareProfileButton({ username, displayName }: ShareProfileButtonProps) {
  const t = useTranslations("profile");
  const [copied, setCopied] = useState(false);

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/u/${username}`
    : "";

  const handleShare = async () => {
    if (!profileUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${displayName} (@${username}) | Souq El Mahmoudia`,
          url: profileUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback: try clipboard
      try {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Final fallback
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-xs py-sm px-md border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
      aria-label={t("shareProfile")}
    >
      <Icon name={copied ? "check" : "share"} size={18} />
      {copied ? t("copied") : t("share")}
    </button>
  );
}