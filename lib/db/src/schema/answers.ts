import { pgTable, serial, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propsTable } from "./props";
import { playersTable } from "./players";

export const answersTable = pgTable("answers", {
  id: serial("id").primaryKey(),
  propId: integer("prop_id").notNull().references(() => propsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  answer: boolean("answer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("answers_prop_player_unique").on(table.propId, table.playerId),
]);

export const insertAnswerSchema = createInsertSchema(answersTable).omit({ id: true, createdAt: true });
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answersTable.$inferSelect;
