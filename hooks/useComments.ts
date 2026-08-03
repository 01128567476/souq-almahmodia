"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Comment, CommentAuthor } from "@/types";

interface UseCommentsResult {
  comments: Comment[];
  /** Total count including replies. */
  total: number;
  loading: boolean;
  pending: boolean;
  /** Whether the viewer may author comments (must be signed in). */
  canComment: boolean;
  add: (body: string, parentId?: string | null) => Promise<boolean>;
  edit: (commentId: string, body: string) => Promise<boolean>;
  remove: (commentId: string) => Promise<boolean>;
}

/** Count a threaded comment list including one level of replies. */
function countThread(comments: Comment[]): number {
  return comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
}

/**
 * Comment state for one advertisement: loads the thread and exposes
 * add / edit / delete. Every mutation returns the fresh server thread so counts
 * stay in sync automatically.
 *
 * All data access goes through `/api/ads/[id]/comments`, so this hook stays
 * free of server-only repository modules (which bundle `pg` and cannot run in
 * the browser).
 */
export function useComments(adId: string): UseCommentsResult {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const role = user?.role ?? "guest";
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const params = new URLSearchParams();
    if (viewerId) params.set("viewerId", viewerId);

    fetch(`/api/ads/${adId}/comments?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setComments(data?.comments ?? []);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [adId, viewerId]);

  const author: CommentAuthor | null = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            avatar: user.avatar ?? "",
          }
        : null,
    [user],
  );

  const add = useCallback(
    async (body: string, parentId: string | null = null) => {
      if (!author || !body.trim()) return false;
      setPending(true);
      try {
        const res = await fetch(`/api/ads/${adId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ author, content: body, parentId }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setComments(data.comments ?? []);
        return true;
      } catch {
        return false;
      } finally {
        setPending(false);
      }
    },
    [adId, author],
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      if (!viewerId || !body.trim()) return false;
      setPending(true);
      try {
        const res = await fetch(`/api/ads/${adId}/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewerId, viewerRole: role, content: body }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setComments(data.comments ?? []);
        return true;
      } catch {
        return false;
      } finally {
        setPending(false);
      }
    },
    [adId, viewerId, role],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!viewerId) return false;
      setPending(true);
      try {
        const res = await fetch(`/api/ads/${adId}/comments/${commentId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewerId, viewerRole: role }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setComments(data.comments ?? []);
        return true;
      } catch {
        return false;
      } finally {
        setPending(false);
      }
    },
    [adId, viewerId, role],
  );

  const total = useMemo(() => countThread(comments), [comments]);

  return {
    comments,
    total,
    loading,
    pending,
    canComment: viewerId != null,
    add,
    edit,
    remove,
  };
}
