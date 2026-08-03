import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getProductById } from "@/services/products";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { AdForm } from "@/components/account/AdForm";
import type { Locale } from "@/i18n/routing";

export default async function EditAdPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ads");

  const [product, categories] = await Promise.all([
    getProductById(id),
    categoryRepository.listVisible(),
  ]);
  if (!product) notFound();

  return (
    <div>
      <header className="mb-xl">
        <h2 className="text-headline-md font-headline-md text-on-surface">{t("editTitle")}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant mt-xs">
          {t("editSubtitle")}
        </p>
      </header>
      <AdForm mode="edit" product={product} categories={categories} />
    </div>
  );
}
