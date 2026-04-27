import { pgTable, text, serial, timestamp, integer, real, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertyTypeEnum = pgEnum("property_type", ["apartment", "villa", "commercial", "land"]);
export const propertyStatusEnum = pgEnum("property_status", ["pending", "approved", "rejected"]);

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  location: text("location").notNull(),
  area: real("area").notNull(),
  rooms: integer("rooms"),
  propertyType: propertyTypeEnum("property_type").notNull(),
  features: text("features").array().notNull().default([]),
  imageUrl: text("image_url"),
  sellerId: integer("seller_id").notNull(),
  status: propertyStatusEnum("status").notNull().default("pending"),
  views: integer("views").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  contacts: integer("contacts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, views: true, saves: true, contacts: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
