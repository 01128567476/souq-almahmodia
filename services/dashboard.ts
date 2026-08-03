import type { AdReport as Report, DirectoryUser, AppNotification, StatCard } from "@/types";

/**
 * Get all reports from PostgreSQL.
 * Uses dynamic import to avoid pulling pg into the shared bundle.
 */
export async function getReports(): Promise<Report[]> {
  const { reportRepository } = await import("@/services/repositories/reportRepository");
  const reports = await reportRepository.list();

  return reports.map((r) => ({
    ...r,
    createdAt: r.createdAt.split("T")[0],
  }));
}

/**
 * Get all directory users from PostgreSQL.
 */
export async function getDirectoryUsers(): Promise<DirectoryUser[]> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  return userRepository.list();
}

/**
 * Get a single directory user by ID from PostgreSQL.
 */
export async function getDirectoryUserById(id: string): Promise<DirectoryUser | undefined> {
  const { userRepository } = await import("@/services/repositories/userRepository");
  const users = await userRepository.list();
  return users.find((u) => u.id === id);
}

/**
 * Get all notifications from PostgreSQL.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const { notificationRepository } = await import("@/services/repositories/notificationRepository");
  const notifications = await notificationRepository.listAll();

  // Map DB notifications to AppNotification format
  const mapped: AppNotification[] = notifications.map((n) => ({
    ...n,
    time: n.read ? "مقروءة" : "غير مقروءة",
  }));

  // Sort by createdAt descending (newest first)
  return mapped.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

/** Notifications shown to a marketplace user about their advertisements. */
const userNotifications: AppNotification[] = [
  { id: "UN-1", type: "ad_approved", title: "تمت الموافقة على إعلانك", body: "إعلان \"آيفون 15 برو ماكس\" أصبح الآن ظاهراُ في السوق.", time: "منذ ساعتين", read: false },
  { id: "UN-2", type: "ad_rejected", title: "تم رفض إعلانك", body: "إعلان \"مكتب خشبي عتيق\" لم يستوفِ شروط النشر. يرجى مراجعة التفاصيل.", time: "منذ يوم", read: false },
  { id: "UN-3", type: "ad_expired", title: "انتهت صلاحية إعلانك", body: "إعلان \"شاشة عريضة\" انتهت مدته. يمكنك إعادة نشره في أي وقت.", time: "منذ 3 أيام", read: true },
  { id: "UN-4", type: "system", title: "تحديث المنصة", body: "أضفنا تحسينات جديدة على تجربة نشر الإعلانات في سوق المحمودية.", time: "منذ أسبوع", read: true },
];

/** User notifications — uses dynamic import to avoid pulling pg into client bundle. */
export async function getUserNotifications(): Promise<AppNotification[]> {
  const { notificationRepository } = await import("@/services/repositories/notificationRepository");
  return notificationRepository.listForUser("u-1");
}

/**
 * Get real dashboard statistics from PostgreSQL.
 * Uses dynamic imports to avoid pulling pg into the shared bundle.
 */
export async function getDashboardStats(): Promise<StatCard[]> {
  const { adRepository, countAdsByStatus } = await import("@/services/repositories/adRepository");
  const { reportRepository } = await import("@/services/repositories/reportRepository");
  const { userRepository } = await import("@/services/repositories/userRepository");

  const [pendingCount, approvedCount, reportedCount, userCount] = await Promise.all([
    countAdsByStatus("pending"),
    countAdsByStatus("approved"),
    reportRepository.countOpen(),
    userRepository.count(),
  ]);

  return [
    {
      labelKey: "pendingAds",
      value: String(pendingCount),
      delta: "+12%",
      icon: "pending_actions",
      tone: "primary",
    },
    {
      labelKey: "activeAds",
      value: String(approvedCount),
      delta: "+5%",
      icon: "campaign",
      tone: "secondary",
    },
    {
      labelKey: "openReports",
      value: String(reportedCount),
      delta: "-3%",
      icon: "flag",
      tone: "error",
    },
    {
      labelKey: "totalUsers",
      value: String(userCount),
      delta: "+8%",
      icon: "group",
      tone: "tertiary",
    },
  ];
}