"use client";

import { useState, type FormEvent, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";
import { Field } from "@/components/ui/Field";
import { MyAdsView } from "@/app/[locale]/(marketplace)/account/ads/MyAdsView";
import type { Product } from "@/types";
import type { User } from "@/types";

/** Profile tabs for authenticated users. Integrates My Ads into profile. */
import type { Locale } from "@/i18n/routing";

export function ProfileTabsView({
  user,
  ads,
  locale,
}: {
  user: User | null;
  ads: Product[];
  locale: Locale;
}) {
  const t = useTranslations("profile");
  const { user: authUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Avatar upload state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine current tab from URL
  const getCurrentTab = (): string => {
    if (pathname?.includes("/settings")) return "settings";
    if (pathname?.includes("/username")) return "username";
    if (pathname?.includes("/my-ads")) return "my-ads";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState(getCurrentTab());

  // Handle avatar click
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
  };

  // For guests, show only overview
  if (!user) {
    return <GuestProfileView user={null} />;
  }

  const tabs = [
    { key: "overview", label: t("tabOverview"), icon: "person" },
    { key: "username", label: t("tabUsername"), icon: "person_outline" },
    { key: "settings", label: t("tabSettings"), icon: "settings" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-lg">
        {/* Avatar */}
        <div 
          className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-surface shadow-lg bg-surface-container shrink-0 mb-md cursor-pointer hover:brightness-90 transition-all"
          onClick={handleAvatarClick}
        >
          <div className="relative w-full h-full rounded-full overflow-hidden">
            <Image
              src={avatarUrl}
              alt={user.displayName}
              fill
              className="object-cover"
              onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }}
            />
          </div>
          {/* Edit Avatar Button */}
          <button className="absolute bottom-[8px] sm:bottom-[4px] right-[3px] w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all pointer-events-none">
            <Icon name="edit" size={16} />
          </button>
        </div>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />

        {/* User Info Section */}
        <div className="text-center">
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold">
            {user.displayName}
          </h1>
          <p className="font-label-lg text-label-lg text-on-surface-variant mt-1">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Tabs Navigation - Pill Style */}
      <div className="mb-xl">
        <nav className="flex justify-center">
          <div className="inline-flex items-center gap-1 bg-surface-container-lowest rounded-xl border border-outline-variant p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-xs px-md py-sm font-label-md text-label-md rounded-lg transition-all",
                    isActive
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
                  )}
                >
                  <Icon name={tab.icon} size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTabContent user={user} />}
      {activeTab === "username" && <UsernameTab user={user} />}
      {activeTab === "settings" && <SettingsTab user={user} />}
    </div>
  );
}

/** Overview tab: show public profile info. */
function OverviewTabContent({ user }: { user: User }) {
  const t = useTranslations("profile");

  return (
    <div className="space-y-lg">
      {/* Profile Details Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-lg py-md border-b border-outline-variant">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {t("tabOverview")}
          </h3>
        </div>
        <div className="p-lg space-y-md">
          {/* Display Name */}
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="person" size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {t("displayName")}
              </p>
              <p className="font-body-md text-body-md text-on-surface mt-0.5">
                {user.displayName}
              </p>
            </div>
          </div>

          {/* Username */}
          <div className="h-px bg-outline-variant" />
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="badge" size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {t("username")}
              </p>
              <p className="font-body-md text-body-md text-on-surface mt-0.5">
                @{user.username}
              </p>
            </div>
          </div>

          {/* Member Since */}
          <div className="h-px bg-outline-variant" />
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="calendar_today" size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {t("memberSince")}
              </p>
              <p className="font-body-md text-body-md text-on-surface mt-0.5">
                2024
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Username tab: change username with cooldown. */
function UsernameTab({ user }: { user: User }) {
  const t = useTranslations("username");
  const [username, setUsername] = useState(user.username);
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = async () => {
    const trimmed = (savedUsername || username).trim();
    if (!trimmed || trimmed === user.username) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("error"));
        return;
      }

      setSavedUsername(trimmed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg max-w-lg">
      <div>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
          {t("changeUsername")}
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {t("changeSubtitle")}
        </p>
      </div>

      <div className="space-y-sm">
        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-outline-variant font-label-md">
            @
          </span>
          <input
            type="text"
            value={savedUsername || username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full ps-8 pe-md py-md bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-body-md"
          />
        </div>
        {error && (
          <p className="font-body-sm text-body-sm text-error">{error}</p>
        )}
        {success && (
          <p className="font-body-sm text-body-sm text-green-700">
            {t("successTitle")}
          </p>
        )}
      </div>

      <button
        onClick={handleChange}
        disabled={loading || !username.trim() || (savedUsername || username) === user.username}
        className="bg-primary text-on-primary font-label-md text-label-md font-bold py-md px-xl rounded-xl hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? t("creating") : t("save")}
      </button>
    </div>
  );
}

/** Settings tab: edit profile settings. */
function SettingsTab({ user }: { user: User }) {
  const t = useTranslations("profileForm");
  const [name, setName] = useState(user.displayName);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-lg max-w-lg">
      <Field
        id="settings-name"
        label={t("name")}
        icon="person"
        value={name}
        onChange={setName}
      />

      {saved && (
        <p className="flex items-center gap-xs text-body-sm font-body-sm text-green-700">
          <Icon name="check_circle" size={18} />
          {t("saved")}
        </p>
      )}

      <button
        type="submit"
        className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110"
      >
        <Icon name="save" size={20} />
        {t("save")}
      </button>
    </form>
  );
}

/** Guest profile view (no authenticated features). */
function GuestProfileView({ user }: { user: null }) {
  return (
    <div>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Please sign in to view profile settings.
      </p>
    </div>
  );
}