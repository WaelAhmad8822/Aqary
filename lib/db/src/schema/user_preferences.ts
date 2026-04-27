import { pgTable, serial, timestamp, integer, real, text } from "drizzle-orm/pg-core";

export const userPreferencesTable = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  preferredLocation: text("preferred_location"),
  maxBudget: real("max_budget"),
  preferredType: text("preferred_type"),
  preferredFeatures: text("preferred_features").array().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
