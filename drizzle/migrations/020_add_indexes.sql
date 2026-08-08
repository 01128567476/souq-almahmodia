-- ============================================================
-- Migration: Add performance indexes
-- Phase 4: Performance optimization
-- ============================================================

-- 1. Ads createdAt index (for sorting, filtering recent ads)
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON products (created_at DESC);

-- 2. Ads status index (for admin filtering by status)
CREATE INDEX IF NOT EXISTS idx_ads_status ON products (status);

-- 3. Ads owner + status index (for "my ads" queries)
CREATE INDEX IF NOT EXISTS idx_ads_owner_status ON products (owner_id, status);

-- 4. Ads category + status + created_at (for category browsing)
CREATE INDEX IF NOT EXISTS idx_ads_category_status_created ON products (category_slug, status, created_at DESC);

-- 5. Ads expires_at index (for cron expiry cleanup)
CREATE INDEX IF NOT EXISTS idx_ads_expires_at ON products (expires_at) WHERE expires_at IS NOT NULL;

-- 6. Reactions adId index (for fetching reactions per ad)
CREATE INDEX IF NOT EXISTS idx_reactions_ad_id ON reactions (ad_id);

-- 7. Reactions userId index (for user reaction history)
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions (user_id);

-- 8. Reactions adId + userId composite (for duplicate checking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON reactions (ad_id, user_id);

-- 9. Favorites userId index (for user favorites list)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);

-- 10. Favorites adId index (for ad favorites count)
CREATE INDEX IF NOT EXISTS idx_favorites_ad_id ON favorites (ad_id);

-- 11. Favorites userId + adId composite (for duplicate checking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique ON favorites (user_id, ad_id);

-- 12. Comments adId index (for fetching comments per ad)
CREATE INDEX IF NOT EXISTS idx_comments_ad_id ON comments (ad_id);

-- 13. Comments userId index (for user comment history)
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);

-- 14. Notifications recipientId + read (for notification badge)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications (recipient_id, is_read);

-- 15. Notifications created_at (for sorting newest first)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- 16. Users email index (for auth lookup)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 17. Users usernameLower index (for username lookup)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (username_lower);

-- 18. User profiles userId index
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- 19. Reports adId + status (for reported ads queries)
CREATE INDEX IF NOT EXISTS idx_reports_ad_status ON reports (ad_id, status);

-- 20. Audit log created_at (for timeline queries)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);