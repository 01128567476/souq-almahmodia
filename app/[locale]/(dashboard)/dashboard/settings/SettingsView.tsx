"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MarketplaceSettings } from "@/types";

interface SettingsViewProps {
  initialSettings: MarketplaceSettings;
}

const currencyOptions = ["SAR", "USD", "EUR", "GBP"] as const;

export function SettingsView({ initialSettings }: SettingsViewProps) {
  const [settings, setSettings] = useState<MarketplaceSettings>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("settings");

  const updateField = <K extends keyof MarketplaceSettings>(key: K, value: MarketplaceSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateSocialLink = (key: keyof MarketplaceSettings["socialLinks"], value: string) => {
    setSettings((current) => ({
      ...current,
      socialLinks: {
        ...current.socialLinks,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(t("saveError") || "Unable to save settings.");
      }

      const updatedSettings = (await response.json()) as MarketplaceSettings;
      setSettings(updatedSettings);
      setMessage(t("saveSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-xl">
      {error ? (
        <div className="rounded-3xl border border-error bg-error-container/10 p-lg text-error">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-3xl border border-success bg-success-container/10 p-lg text-success">{message}</div>
      ) : null}

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("siteIdentity")}</h2>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{t("siteIdentityDescription")}</p>
          </div>
        </div>

        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("siteName")}</span>
            <input
              type="text"
              value={settings.siteName}
              onChange={(event) => updateField("siteName", event.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("logoUrl")}</span>
            <input
              type="url"
              value={settings.logoUrl}
              onChange={(event) => updateField("logoUrl", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("bannerUrl")}</span>
            <input
              type="url"
              value={settings.bannerUrl}
              onChange={(event) => updateField("bannerUrl", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>

        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-4">
            <p className="mb-2 text-label-sm font-label-sm text-on-surface-variant">{t("logoPreview")}</p>
            <div className="h-28 overflow-hidden rounded-3xl bg-surface-container-highest">
              {settings.logoUrl ? (
                <Image src={settings.logoUrl} alt={t("logoUrl")} fill className="object-cover" onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }} />
              ) : (
                <div className="flex h-full items-center justify-center text-on-surface-variant">{t("noPreview")}</div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-outline-variant bg-surface-container p-4">
            <p className="mb-2 text-label-sm font-label-sm text-on-surface-variant">{t("bannerPreview")}</p>
            <div className="h-28 overflow-hidden rounded-3xl bg-surface-container-highest">
              {settings.bannerUrl ? (
                <Image src={settings.bannerUrl} alt={t("bannerUrl")} fill className="object-cover" onError={(e) => { e.currentTarget.src = "/placeholder-image.svg"; }} />
              ) : (
                <div className="flex h-full items-center justify-center text-on-surface-variant">{t("noPreview")}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("contactInformation")}</h2>
        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("contactEmail")}</span>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(event) => updateField("contactEmail", event.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("contactPhone")}</span>
            <input
              type="tel"
              value={settings.contactPhone}
              onChange={(event) => updateField("contactPhone", event.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("contactAddress")}</span>
            <textarea
              value={settings.contactAddress}
              onChange={(event) => updateField("contactAddress", event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("socialLinks")}</h2>
        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("facebook")}</span>
            <input
              type="url"
              value={settings.socialLinks.facebook}
              onChange={(event) => updateSocialLink("facebook", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("instagram")}</span>
            <input
              type="url"
              value={settings.socialLinks.instagram}
              onChange={(event) => updateSocialLink("instagram", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("twitter")}</span>
            <input
              type="url"
              value={settings.socialLinks.twitter}
              onChange={(event) => updateSocialLink("twitter", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("whatsapp")}</span>
            <input
              type="url"
              value={settings.socialLinks.whatsapp}
              onChange={(event) => updateSocialLink("whatsapp", event.target.value)}
              placeholder="https://"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("approvalSettings")}</h2>
        <p className="mt-2 text-body-sm font-body-sm text-on-surface-variant">{t("approvalSettingsDescription")}</p>

        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("approvalMode")}</span>
            <select
              value={settings.approvalMode}
              onChange={(event) => updateField("approvalMode", event.target.value as MarketplaceSettings["approvalMode"])}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              <option value="manual">{t("approvalModeManual")}</option>
              <option value="automatic">{t("approvalModeAutomatic")}</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 rounded-3xl border border-outline-variant bg-surface-container p-4">
            <span className="text-body-md font-body-md text-on-surface">{t("allowEditBeforeApproval")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.allowEditBeforeApproval}
              onClick={() => updateField("allowEditBeforeApproval", !settings.allowEditBeforeApproval)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                settings.allowEditBeforeApproval ? "bg-primary" : "bg-surface-container-highest"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  settings.allowEditBeforeApproval ? "start-6" : "start-1"
                }`}
              />
            </button>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-xl">
        <h2 className="text-headline-sm font-headline-sm text-on-surface">{t("generalConfiguration")}</h2>
        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("defaultCurrency")}</span>
            <select
              value={settings.defaultCurrency}
              onChange={(event) => updateField("defaultCurrency", event.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-label-sm font-label-sm text-on-surface-variant">{t("defaultAdDurationDays")}</span>
            <input
              type="number"
              min={1}
              value={settings.defaultAdDurationDays}
              onChange={(event) => updateField("defaultAdDurationDays", Number(event.target.value))}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-label-md font-label-md text-on-primary transition hover:brightness-110 disabled:opacity-60"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
