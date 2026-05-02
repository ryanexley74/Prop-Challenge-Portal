import { pgTable, text, serial, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gameStatusEnum = pgEnum("game_status", ["open", "active", "completed"]);

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: gameStatusEnum("status").notNull().default("open"),
  adminCode: text("admin_code").notNull(),
  sheetUrl: text("sheet_url"),
  syncInterval: integer("sync_interval").default(5),
  lastSheetSync: timestamp("last_sheet_sync"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({ id: true, createdAt: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
