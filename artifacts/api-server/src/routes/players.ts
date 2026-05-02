import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  JoinGameBody,
  JoinGameParams,
  ListPlayersParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// List players in a game
router.get("/games/:gameId/players", async (req, res) => {
  try {
    const { gameId } = ListPlayersParams.parse(req.params);
    const players = await db.select().from(playersTable)
      .where(eq(playersTable.gameId, gameId))
      .orderBy(playersTable.joinedAt);
    res.json(players.map(p => ({
      ...p,
      joinedAt: p.joinedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list players");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join a game
router.post("/games/:gameId/players", async (req, res) => {
  try {
    const { gameId } = JoinGameParams.parse(req.params);
    const body = JoinGameBody.parse(req.body);

    const [player] = await db.insert(playersTable).values({
      gameId,
      name: body.name,
    }).returning();

    res.status(201).json({
      ...player,
      joinedAt: player.joinedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to join game");
    res.status(400).json({ error: "Bad request" });
  }
});

export default router;
