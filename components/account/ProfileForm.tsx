"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";

/** Profile page: edit the signed-in user's personal details (mock, client-only). */
export function ProfileForm() {
  const t = useTranslations("profileForm");
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("emailRequired");
    if (!phone.trim()) next.phone = t("phoneRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSaved(false);
      return;
    }
    // Mock persistence: no backend, just confirm success.
    setSaved(true);
  };

  return (
    <div>
      <header className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("title")}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-xs">{t("subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-lg max-w-lg" noValidate>
        <div className="flex items-center gap-lg">
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-surface-container shrink-0">
            {user?.avatar && (
              <Image src={user.avatar} alt="" fill sizes="80px" className="object-cover" />
            )}
          </div>
          <button
            type="button"
            className="flex items-center gap-xs py-sm px-md border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Icon name="photo_camera" size={18} />
            {t("changePhoto")}
          </button>
        </div>

        <Field
          id="profile-name"
          label={t("name")}
          icon="person"
          value={name}
          onChange={setName}
          error={errors.name}
        />
        <Field
          id="profile-email"
          label={t("email")}
          icon="mail"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <Field
          id="profile-phone"
          label={t("phone")}
          icon="call"
          type="tel"
          value={phone}
          onChange={setPhone}
          error={errors.phone}
        />

        {saved && (
          <p className="flex items-center gap-xs text-body-sm font-body-sm text-green-700">
            <Icon name="check_circle" size={18} />
            {t("saved")}
          </p>
        )}

        <button
          type="submit"
          className="flex items-center justify-center gap-sm py-md px-xl bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Icon name="save" size={20} />
          {t("save")}
        </button>
      </form>
    </div>
  );
}
