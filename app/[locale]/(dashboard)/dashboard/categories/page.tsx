import { setRequestLocale, getTranslations } from "next-intl/server";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CategoriesAdminView } from "@/components/dashboard/CategoriesAdminView";
import type { Locale } from "@/i18n/routing";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const categories = await categoryRepository.list();

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.nav.categories")} subtitle={t("categoriesAdmin.subtitle")} />
      <CategoriesAdminView initialCategories={categories} />
    </div>
  );
}