import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gamesTable, propsTable, playersTable, answersTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import {
  CreateGameBody,
  UpdateGameBody,
  GetGameParams,
  UpdateGameParams,
  GetGameSummaryParams,
} from "@workspace/api-zod";
import crypto from "crypto";
import { z } from "zod";

const router: IRouter = Router();

// Find a game by admin code
router.get("/games/by-code/:code", async (req, res) => {
  try {
    const code = z.string().min(1).parse(req.params.code);
    const [game] = await db.select().from(gamesTable)
      .where(eq(gamesTable.adminCode, code.toUpperCase()));
    if (!game) return res.status(404).json({ error: "No game found for that code" });
    res.json({ ...game, createdAt: game.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to find game by code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all games
router.get("/games", async (req, res) => {
  try {
    const games = await db.select().from(gamesTable).orderBy(gamesTable.createdAt);
    res.json(games.map(g => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
      lastSheetSync: g.lastSheetSync?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list games");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a game
router.post("/games", async (req, res) => {
  try {
    const body = CreateGameBody.parse(req.body);
    const adminCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const [game] = await db.insert(gamesTable).values({
      name: body.name,
      description: body.description ?? null,
      adminCode,
      status: "open",
    }).returning();
    res.status(201).json({ ...game, createdAt: game.createdAt.toISOString(), lastSheetSync: null });
  } catch (err) {
    req.log.error({ err }, "Failed to create game");
    res.status(400).json({ error: "Bad request" });
  }
});

// Get a game by ID with props + playerCount
router.get("/games/:gameId", async (req, res) => {
  try {
    const { gameId } = GetGameParams.parse(req.params);
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!game) return res.status(404).json({ error: "Game not found" });

    const props = await db.select().from(propsTable)
      .where(eq(propsTable.gameId, gameId))
      .orderBy(propsTable.order, propsTable.createdAt);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId));

    // Fetch pick counts per prop for pick-reveal overlay
    const propIds = props.map(p => p.id);
    const pickCounts: Record<number, { trueCount: number; falseCount: number }> = {};
    if (propIds.length > 0) {
      const rows = await db
        .select({
          propId: answersTable.propId,
          answer: answersTable.answer,
          cnt: sql<number>`count(*)::int`,
        })
        .from(answersTable)
        .where(inArray(answersTable.propId, propIds))
        .groupBy(answersTable.propId, answersTable.answer);
      for (const row of rows) {
        if (!pickCounts[row.propId]) pickCounts[row.propId] = { trueCount: 0, falseCount: 0 };
        if (row.answer) pickCounts[row.propId].trueCount = row.cnt;
        else pickCounts[row.propId].falseCount = row.cnt;
      }
    }

    res.json({
      ...game,
      createdAt: game.createdAt.toISOString(),
      lastSheetSync: game.lastSheetSync?.toISOString() ?? null,
      props: props.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        resolvedAt: p.resolvedAt?.toISOString() ?? null,
        trueCount: pickCounts[p.id]?.trueCount ?? 0,
        falseCount: pickCounts[p.id]?.falseCount ?? 0,
      })),
      playerCount: count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get game");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update game status/name
router.patch("/games/:gameId", async (req, res) => {
  try {
    const { gameId } = UpdateGameParams.parse(req.params);
    const body = UpdateGameBody.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.sheetUrl !== undefined) updates.sheetUrl = body.sheetUrl;
    if (body.syncInterval !== undefined) updates.syncInterval = body.syncInterval;
    if (body.soundEnabled !== undefined) updates.soundEnabled = body.soundEnabled;
    if (body.soundChoice !== undefined) updates.soundChoice = body.soundChoice;
    if (body.showCountdown !== undefined) updates.showCountdown = body.showCountdown;
    if (body.showTicker !== undefined) updates.showTicker = body.showTicker;
    if (body.showBanner !== undefined) updates.showBanner = body.showBanner;
    if (body.showPickReveal !== undefined) updates.showPickReveal = body.showPickReveal;
    if (body.showTally !== undefined) updates.showTally = body.showTally;

    const [game] = await db.update(gamesTable)
      .set(updates)
      .where(eq(gamesTable.id, gameId))
      .returning();

    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json({ ...game, createdAt: game.createdAt.toISOString(), lastSheetSync: game.lastSheetSync?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to update game");
    res.status(400).json({ error: "Bad request" });
  }
});

// Get game summary
router.get("/games/:gameId/summary", async (req, res) => {
  try {
    const { gameId } = GetGameSummaryParams.parse(req.params);
    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!game) return res.status(404).json({ error: "Game not found" });

    const props = await db.select().from(propsTable).where(eq(propsTable.gameId, gameId));
    const resolvedProps = props.filter(p => p.result !== null);

    const [{ count: playerCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId));

    res.json({
      gameId: game.id,
      gameName: game.name,
      status: game.status,
      totalProps: props.length,
      resolvedProps: resolvedProps.length,
      totalPlayers: playerCount,
      topPlayer: null,
      topScore: null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get game summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
