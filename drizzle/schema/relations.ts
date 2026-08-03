/**
 * Drizzle relation definitions.
 *
 * All foreign key relationships between tables.
 * This is separate from table definitions for clarity.
 */

import { relations } from "drizzle-orm";
import {
  users,
  categories,
  products,
  adImages,
  comments,
  reactions,
  favorites,
  reports,
  moderationEvents,
  auditLogs,
  notifications,
  pins,
  userSettings,
  usernameHistory,
} from "./tables";

/* ======================================================================== */
/* User Relations                                                           */
/* ======================================================================== */

export const usersRelations = relations(users, ({ many }) => ({
  /** User's ads. */
  ads: many(products),
  /** User's comments. */
  comments: many(comments),
  /** User's reactions. */
  reactions: many(reactions),
  /** User's favorites. */
  favorites: many(favorites),
  /** User's reports (as reporter). */
  reportsCreated: many(reports),
  /** User's moderation events. */
  moderationEvents: many(moderationEvents),
  /** User's audit logs. */
  auditLogs: many(auditLogs),
  /** User's notifications (as recipient). */
  notificationsReceived: many(notifications),
}));

/* ======================================================================== */
/* Category Relations                                                       */
/* ======================================================================== */

export const categoriesRelations = relations(categories, ({ many }) => ({
  /** Ads in this category. */
  ads: many(products),
}));

/* ======================================================================== */
/* Product (Ad) Relations                                                   */
/* ======================================================================== */

export const productsRelations = relations(products, ({ one, many }) => ({
  /** Category this product belongs to. */
  category: one(categories, {
    fields: [products.categorySlug],
    references: [categories.slug],
  }),
  /** Owner of this product. */
  owner: one(users, {
    fields: [products.ownerId],
    references: [users.id],
  }),
  /** Images for this product. */
  images: many(adImages),
  /** Comments on this product. */
  comments: many(comments),
  /** Reactions on this product. */
  reactions: many(reactions),
  /** Favorites of this product. */
  favorites: many(favorites),
  /** Reports about this product. */
  reports: many(reports),
  /** Moderation events on this product. */
  moderationEvents: many(moderationEvents),
}));

/* ======================================================================== */
/*                                                       Ad Image Relations */
/* ======================================================================== */

export const adImagesRelations = relations(adImages, ({ one }) => ({
  /** Ad this image belongs to. */
  ad: one(products, {
    fields: [adImages.adId],
    references: [products.id],
  }),
}));

/* ======================================================================== */
/* Comment Relations (Self-referential for threaded replies)                */
/* ======================================================================== */

export const commentsRelations = relations(comments, ({ one, many }) => ({
  /** Ad this comment belongs to. */
  ad: one(products, {
    fields: [comments.adId],
    references: [products.id],
  }),
  /** Parent comment (null for top-level). */
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
  /** Replies to this comment. */
  replies: many(comments, {
    relationName: "commentReplies",
  }),
  /** Author of this comment. */
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

/* ======================================================================== */                                                      
/* Reaction Relations */
/* ======================================================================== */

export const reactionsRelations = relations(reactions, ({ one }) => ({
  /** Ad this reaction belongs to. */
  ad: one(products, {
    fields: [reactions.adId],
    references: [products.id],
  }),
  /** User who reacted. */
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Favorite Relations                                                       */
/* ======================================================================== */

export const favoritesRelations = relations(favorites, ({ one }) => ({
  /** Ad favorited. */
  ad: one(products, {
    fields: [favorites.adId],
    references: [products.id],
  }),
  /** User who favorited. */
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Report Relations                                                         */
/* ======================================================================== */

export const reportsRelations = relations(reports, ({ one }) => ({
  /** Ad being reported. */
  ad: one(products, {
    fields: [reports.adId],
    references: [products.id],
  }),
  /** User who reported. */
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/*                                             Moderation Event Relations */
/* ======================================================================== */

export const moderationEventsRelations = relations(moderationEvents, ({ one }) => ({
  /** Ad being moderated. */
  ad: one(products, {
    fields: [moderationEvents.adId],
    references: [products.id],
  }),
  /** Admin who performed the action. */
  actor: one(users, {
    fields: [moderationEvents.actorId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Audit Log Relations                                                      */
/* ======================================================================== */

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  /** Actor who performed the action. */
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Notification Relations                                                   */
/* ======================================================================== */

export const notificationsRelations = relations(notifications, ({ one }) => ({
  /** Recipient user. */
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
  }),
  /** Related ad. */
  ad: one(products, {
    fields: [notifications.adId],
    references: [products.id],
  }),
}));

/* ======================================================================== */
/* Pin Relations                                                            */
/* ======================================================================== */

export const pinsRelations = relations(pins, ({ one }) => ({
  /** Ad that is pinned. */
  ad: one(products, {
    fields: [pins.adId],
    references: [products.id],
  }),
  /** Admin who pinned. */
  owner: one(users, {
    fields: [pins.ownerId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/*                                                  User Settings Relations */
/* ======================================================================== */

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  /** User these settings belong to. */
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Username History Relations                                             */
/* ======================================================================== */

export const usernameHistoryRelations = relations(usernameHistory, ({ one }) => ({
  /** User who changed username. */
  user: one(users, {
    fields: [usernameHistory.userId],
    references: [users.id],
  }),
}));

/* ======================================================================== */
/* Re-export all relation definitions as a single object                    */
/* ======================================================================== */

export const dbRelations = {
  users: usersRelations,
  categories: categoriesRelations,
  products: productsRelations,
  adImages: adImagesRelations,
  comments: commentsRelations,
  reactions: reactionsRelations,
  favorites: favoritesRelations,
  reports: reportsRelations,
  moderationEvents: moderationEventsRelations,
  auditLogs: auditLogsRelations,
  notifications: notificationsRelations,
  pins: pinsRelations,
  userSettings: userSettingsRelations,
  usernameHistory: usernameHistoryRelations,
};

export type AllRelations = typeof dbRelations;
