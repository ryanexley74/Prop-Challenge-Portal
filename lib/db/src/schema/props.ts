import { pgTable, text, serial, timestamp, pgEnum, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

export const propTypeEnum = pgEnum("prop_type", ["yes_no", "over_under"]);

export const propsTable = pgTable("props", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  type: propTypeEnum("type").notNull(),
  threshold: real("threshold"),
  result: boolean("result"),
  resolvedAt: timestamp("resolved_at"),
  tally: text("tally"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPropSchema = createInsertSchema(propsTable).omit({ id: true, createdAt: true });
export type InsertProp = z.infer<typeof insertPropSchema>;
export type Prop = typeof propsTable.$inferSelect;
