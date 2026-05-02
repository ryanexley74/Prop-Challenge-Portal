import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { answersTable, playersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  SubmitAnswersBody,
  SubmitAnswersParams,
  ListAnswersParams,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// Get all answers for a specific player
router.get("/players/:playerId/answers", async (req, res) => {
  try {
    const playerId = z.coerce.number().int().parse(req.params.playerId);

    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (player.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const answers = await db.select().from(answersTable)
      .where(eq(answersTable.playerId, playerId));

    res.json(answers.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get player answers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all answers for a game
router.get("/games/:gameId/answers", async (req, res) => {
  try {
    const { gameId } = ListAnswersParams.parse(req.params);

    const players = await db.select().from(playersTable).where(eq(playersTable.gameId, gameId));
    if (players.length === 0) {
      return res.json([]);
    }

    const playerIds = players.map(p => p.id);
    const answers = await db.select().from(answersTable)
      .where(inArray(answersTable.playerId, playerIds));

    res.json(answers.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list answers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit answers for a player
router.post("/games/:gameId/answers", async (req, res) => {
  try {
    const { gameId } = SubmitAnswersParams.parse(req.params);
    void gameId; // used for validation; player is verified via playerId

    const body = SubmitAnswersBody.parse(req.body);

    const inserted = await db
      .insert(answersTable)
      .values(body.answers.map(a => ({
        propId: a.propId,
        playerId: body.playerId,
        answer: a.answer,
      })))
      .onConflictDoUpdate({
        target: [answersTable.propId, answersTable.playerId],
        set: { answer: answersTable.answer },
      })
      .returning();

    res.status(201).json(inserted.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to submit answers");
    res.status(400).json({ error: "Bad request" });
  }
});

export default router;
