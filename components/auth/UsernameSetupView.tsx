"use client";

import { useState, type FormEvent, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import type { SearchResult } from "@/types";

/**
 * Username creation/setup view for new users.
 * Shows available usernames and auto-generates suggestions.
 */
export function UsernameSetupView() {
  const t = useTranslations("username");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion);
    setSelectedSuggestion(suggestion);
    setError(null);
    setSuggestions([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestions([]);
    setSelectedSuggestion(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError(t("empty"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
        setError(data.error || t("error"));
        return;
      }

      setSuccess(true);
      // Redirect to home after brief success message
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant p-xl text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-lg">
            <Icon name="check_circle" size={40} className="text-primary" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-sm">
            {t("successTitle")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("successSubtitle")}
          </p>
          <p className="font-label-md text-label-md text-primary mt-md">
            @{username}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-4 py-xl">
      <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant p-xl">
        <div className="text-center mb-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mb-md">
            <Icon name="person_outline" size={32} className="text-primary" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">
            {t("title")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-lg">
          <div className="space-y-xs">
            <label htmlFor="username" className="font-label-md text-label-md text-on-surface-variant block">
              {t("label")}
            </label>
            <div className="relative">
              <span className="absolute start-md top-1/2 -translate-y-1/2 text-outline-variant font-label-md">
                @
              </span>
              <input
                ref={inputRef}
                id="username"
                type="text"
                value={selectedSuggestion || username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelectedSuggestion(null);
                }}
                placeholder="your_username"
                autoComplete="off"
                className={cn(
                  "w-full ps-8 pe-md py-md bg-white border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-body-md text-body-md",
                  error ? "border-error" : "border-outline-variant",
                )}
              />
            </div>
            {error && (
              <p className="font-body-sm text-body-sm text-error flex items-center gap-xs">
                <Icon name="error" size={16} />
                {error === "taken" && suggestions.length > 0
                  ? t("takenWithSuggestions")
                  : error}
              </p>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-surface-container rounded-xl p-md space-y-sm">
              <p className="font-label-md text-label-md text-on-surface-variant">
                {t("suggestionsTitle")}
              </p>
              <div className="flex flex-wrap gap-sm">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-full font-label-md text-label-md text-on-surface hover:border-primary hover:text-primary transition-colors"
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface-container rounded-xl p-md space-y-1">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {t("rules.title")}
            </p>
            <ul className="font-body-sm text-body-sm text-on-surface-variant space-y-0.5 ms-4 list-disc">
              <li>{t("rules.a-z")}</li>
              <li>{t("rules.numbers")}</li>
              <li>{t("rules.special")}</li>
              <li>{t("rules.noArabic")}</li>
              <li>{t("rules.noSpaces")}</li>
              <li>{t("rules.minLength")}</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full bg-primary text-on-primary font-label-md text-label-md font-bold py-md rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all duration-200",
              loading && "opacity-60 cursor-not-allowed",
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-sm">
                <Icon name="progress_activity" size={20} className="animate-spin" />
                {t("creating")}
              </span>
            ) : (
              t("create")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}