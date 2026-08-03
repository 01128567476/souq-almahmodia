import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ROUTES } from "@/constants/routes";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { UserDetailsView } from "@/components/dashboard/UserDetailsView";
import { userRepository } from "@/services/repositories/userRepository";
import { adRepository } from "@/services/repositories/adRepository";
import { reportRepository } from "@/services/repositories/reportRepository";
import { auditRepository } from "@/services/repositories/auditRepository";
import { commentRepository } from "@/services/repositories/commentRepository";
import { categoryRepository } from "@/services/repositories/categoryRepository";
import type { Locale } from "@/i18n/routing";

// Force dynamic rendering — no static generation
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const user = await userRepository.getById(id);
  if (!user) notFound();

  const ads = await adRepository.listByOwner(id);
  const [reports, auditEntries, categories, comments] = await Promise.all([
    reportRepository.listByAdIds(ads.map((ad) => ad.id)),
    auditRepository.getAuditLog(),
    categoryRepository.list(),
    commentRepository.listByAuthor(id),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <Breadcrumbs items={[{ label: t("users.title"), href: ROUTES.users }, { label: user.name }]} />
      <UserDetailsView user={user} ads={ads} reports={reports} comments={comments} activity={auditEntries} categories={categories} />
    </div>
  );
}
