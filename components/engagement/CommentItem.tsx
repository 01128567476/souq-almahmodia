"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CommentComposer } from "@/components/engagement/CommentComposer";
import { canDeleteComment } from "@/utils/permissions";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Locale } from "@/i18n/routing";
import type { Comment, User } from "@/types";

interface CommentActions {
  canReply: boolean;
  pending: boolean;
  onReply: (parentId: string, body: string) => Promise<boolean>;
  onEdit: (commentId: string, body: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
}

/**
 * A single comment (root or reply). Ultra-compact layout similar to Facebook Marketplace.
 * - Outer wrapper groups card + actions as one unit
 * - Comment card contains ONLY avatar + username + text
 * - Action buttons sit directly below the card (mt-0.5)
 * - Card height hugs content exactly
 *
 * Mobile (<768px): ultra-compact card + external action bar
 * Desktop (>=768px): compact card + external action bar
 */
export function CommentItem({
  comment,
  actions,
  advertisement,
  currentUser,
  isReply = false,
}: {
  comment: Comment;
  actions: CommentActions;
  advertisement?: { ownerId?: string } | null;
  currentUser: User | null;
  isReply?: boolean;
}) {
  const t = useTranslations("engagement");
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const canDelete = canDeleteComment(currentUser, comment, advertisement);

  return (
    <div className="group-comment">
      {/* ========== COMMENT CARD (avatar + username + text ONLY) ========== */}
      <div
        className={cn(
          // Mobile: minimal padding — card hugs content tightly
          "rounded-xl px-3 py-1.5 sm:rounded-2xl sm:px-4 sm:py-2 transition-colors",
          isReply
            ? "ms-3 sm:ms-8 border-s-2 border-outline-variant/50"
            : "border border-outline-variant/30",
          "bg-surface-container-low",
        )}
      >
        <div className="flex items-start gap-2 sm:gap-2.5">
          <Image
            src={comment.author.avatar}
            alt=""
            width={isReply ? 28 : 34}
            height={isReply ? 28 : 34}
            className="rounded-full object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            {/* Username + timestamp on one tight line */}
            <div className="flex flex-wrap items-center gap-x-[10px] gap-y-0.5">
              <span className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[160px] sm:max-w-none">
                {comment.author.name}
              </span>
              <span className="text-[8px] font-label-sm text-on-surface-variant shrink-0">
                {formatRelativeTime(comment.createdAt, locale)}
                {comment.edited && ` · ${t("edited")}`}
              </span>
            </div>
            {/* Comment text — tight leading */}
            <p className="mt-1 text-body-sm text-on-surface whitespace-pre-line break-words leading-snug sm:mt-1 sm:text-sm">
              {comment.body}
            </p>
          </div>
        </div>
      </div>

      {/* ========== ACTION BUTTONS — OUTSIDE card, directly beneath ========== */}
      {!editing && (
        <div className={cn("mt-0.5 flex items-center gap-1 px-3 sm:mt-1 sm:gap-1 sm:px-0", isReply && "sm:ms-8")}>
          {actions.canReply && !isReply && (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className={cn(
                "text-xs font-medium text-on-surface-variant hover:text-primary transition-colors touch-manipulation",
                "min-h-[22px] sm:min-h-[26px] min-w-[36px] flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg hover:bg-primary/5 active:bg-primary/10",
              )}
            >
              {t("reply")}
            </button>
          )}
          {comment.viewerIsAuthor && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "text-xs font-medium text-on-surface-variant hover:text-primary transition-colors touch-manipulation",
                "min-h-[22px] sm:min-h-[26px] min-w-[36px] flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg hover:bg-primary/5 active:bg-primary/10",
              )}
            >
              {t("edit")}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={cn(
                "text-xs font-medium text-on-surface-variant hover:text-error transition-colors touch-manipulation",
                "min-h-[22px] sm:min-h-[26px] min-w-[36px] flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg hover:bg-error/5 active:bg-error/10",
              )}
            >
              {t("delete")}
            </button>
          )}
        </div>
      )}

      {/* ========== REPLY COMPOSER — OUTSIDE card ========== */}
      {replying && (
        <div className={cn("mt-0.5 px-3 sm:mt-1 sm:px-0", isReply && "sm:ms-8")}>
          <CommentComposer
            placeholder={t("replyPlaceholder")}
            submitLabel={t("reply")}
            pending={actions.pending}
            autoFocus
            compact
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              const ok = await actions.onReply(comment.id, body);
              if (ok) setReplying(false);
              return ok;
            }}
          />
        </div>
      )}

      {/* ========== EDIT COMPOSER — OUTSIDE card ========== */}
      {editing && (
        <div className={cn("mt-0.5 px-3 sm:mt-1 sm:px-0", isReply && "sm:ms-8")}>
          <CommentComposer
            initialValue={comment.body}
            placeholder={t("editPlaceholder")}
            submitLabel={t("save")}
            pending={actions.pending}
            autoFocus
            compact
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              const ok = await actions.onEdit(comment.id, body);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        </div>
      )}

      {/* ========== NESTED REPLIES ========== */}
      {comment.replies.length > 0 && (
        <div className="mt-0.5 sm:mt-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              actions={actions}
              advertisement={advertisement}
              currentUser={currentUser}
              isReply
            />
          ))}
        </div>
      )}

      {/* ========== DELETE CONFIRMATION MODAL ========== */}
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={async () => {
            const ok = await actions.onDelete(comment.id);
            if (!ok) return;
            setShowDeleteModal(false);
          }}
          onCancel={() => setShowDeleteModal(false)}
          pending={actions.pending}
          t={t}
        />
      )}
    </div>
  );
}

/**
 * Centered delete confirmation modal with dimmed background.
 */
function DeleteConfirmModal({
  onConfirm,
  onCancel,
  pending,
  t,
}: {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  t: (key: string) => string;
}) {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("confirmDelete")}
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl sm:p-5 animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-headline-sm font-headline-sm text-on-surface mb-1 sm:mb-1.5">
          {t("confirmDelete")}
        </h3>
        <p className="text-body-sm text-on-surface-variant mb-3 sm:mb-4 leading-snug">
          {t("confirmDeleteSubtitle")}
        </p>
        <div className="flex justify-end gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-[40px] rounded-lg border border-outline-variant bg-transparent px-3 font-label-md font-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low touch-manipulation disabled:opacity-50 sm:px-4"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-[40px] rounded-lg bg-error px-3 font-label-md font-label-md font-bold text-on-primary transition-colors hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 sm:px-4"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("delete")}
              </span>
            ) : (
              t("delete")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}