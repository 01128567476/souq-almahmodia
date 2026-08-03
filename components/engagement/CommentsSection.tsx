"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { useComments } from "@/hooks/useComments";
import { Icon } from "@/components/ui/Icon";
import { CommentComposer } from "@/components/engagement/CommentComposer";
import { CommentItem } from "@/components/engagement/CommentItem";
import { formatCount } from "@/utils/format";
import type { Locale } from "@/i18n/routing";
import type { User } from "@/types";

/**
 * Full comments section for an advertisement: composer (or sign-in prompt),
 * total count, and the newest-first threaded list. All data flows through the
 * `useComments` hook, so counts update automatically after add/edit/delete.
 *
 * Ultra-compact layout — similar to Facebook Marketplace / Instagram / LinkedIn.
 */
export function CommentsSection({
  adId,
  advertisement,
}: {
  adId: string;
  /** The ad these comments belong to (only `ownerId` is used for permissions). */
  advertisement?: { ownerId?: string } | null;
}) {
  const t = useTranslations("engagement");
  const locale = useLocale() as Locale;
  const { user } = useAuth();
  const { comments, total, loading, pending, canComment, add, edit, remove } =
    useComments(adId);

  /** Convert AuthUser to a minimal User type for CommentItem. */
  function userToUser(authUser: { id: string; name: string; email: string; role: string; avatar?: string } | null): User | null {
    if (!authUser) return null;
    return {
      id: authUser.id,
      displayName: authUser.name,
      username: authUser.name.toLowerCase().replace(/\s+/g, "_"),
      usernameLower: authUser.name.toLowerCase().replace(/\s+/g, "_"),
      usernameLastChangedAt: null,
      joinedAt: new Date().toISOString(),
      avatar: authUser.avatar ?? "",
      googleId: "",
      email: authUser.email,
      role: authUser.role as User["role"],
      name: authUser.name,
      phone: undefined,
    } as User;
  }

  const actions = {
    canReply: canComment,
    pending,
    onReply: (parentId: string, body: string) => add(body, parentId),
    onEdit: edit,
    onDelete: remove,
  };

  return (
    <section className="mt-md sm:mt-xl" aria-label={t("comments")}>
      {/* Section header — compact */}
      <div className="mb-sm sm:mb-lg">
        <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-1.5 sm:gap-sm">
          {t("comments")}
          <span className="font-body-md text-body-md text-on-surface-variant">
            ({formatCount(total, locale)})
          </span>
        </h2>
      </div>

      {/* Composer or Sign-in prompt */}
      {canComment ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3 mb-sm sm:mb-lg">
          <CommentComposer
            avatar={user?.avatar}
            placeholder={t("commentPlaceholder")}
            submitLabel={t("postComment")}
            pending={pending}
            onSubmit={(body) => add(body)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3 mb-sm sm:mb-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("signInToComment")}
          </p>
          <Link
            href={ROUTES.login}
            className="shrink-0 min-h-[40px] sm:min-h-[44px] rounded-lg bg-primary px-5 py-1.5 sm:px-6 sm:py-2 font-label-md text-label-md font-bold text-on-primary hover:brightness-110 transition-all touch-manipulation text-center"
          >
            {t("signIn")}
          </Link>
        </div>
      )}

      {/* Comments list — ultra-compact gap (8–12px) */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {loading ? (
          <div className="flex justify-center py-xl text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-xl text-center font-body-md text-body-md text-on-surface-variant">
            {t("noComments")}
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              actions={actions}
              advertisement={advertisement}
              currentUser={userToUser(user)}
            />
          ))
        )}
      </div>
    </section>
  );
}