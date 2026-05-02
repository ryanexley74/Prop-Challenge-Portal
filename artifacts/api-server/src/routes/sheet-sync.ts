import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, gamesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncGameFromSheet } from "../lib/sheet-sync-core";

const router: IRouter = Router();

const ParamsSchema = z.object({ gameId: z.coerce.number().int() });
const BodySchema = z.object({ sheetUrl: z.string().min(1) });

router.post("/games/:gameId/sync-from-sheet", async (req, res) => {
  try {
    const { gameId } = ParamsSchema.parse(req.params);
    const { sheetUrl } = BodySchema.parse(req.body);

    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Persist the sheetUrl so auto-sync can pick it up
    await db.update(gamesTable).set({ sheetUrl }).where(eq(gamesTable.id, gameId));

    const result = await syncGameFromSheet(gameId, sheetUrl);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    req.log.info({ gameId, resolved: result.resolved.length }, "Manual sheet sync complete");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to sync from sheet");
    res.status(500).json({ error: "Sheet sync failed" });
  }
});

export default router;
