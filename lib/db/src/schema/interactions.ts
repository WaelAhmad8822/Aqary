import { pgTable, serial, timestamp, integer, real, pgEnum, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interactionTypeEnum = pgEnum("interaction_type", ["view", "save", "contact", "scroll", "time_spent"]);

export const interactionsTable = pgTable("interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  propertyId: integer("property_id").notNull(),
  interactionType: interactionTypeEnum("interaction_type").notNull(),
  weight: real("weight").notNull().default(1),
  seconds: real("seconds"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInteractionSchema = createInsertSchema(interactionsTable).omit({ id: true, createdAt: true });
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactionsTable.$inferSelect;
