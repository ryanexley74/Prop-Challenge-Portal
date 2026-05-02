import { db, gamesTable } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { syncGameFromSheet } from "../lib/sheet-sync-core";
import { logger } from "../lib/logger";

// Master tick runs every minute; each game uses its own syncInterval setting
const TICK_MS = 60 * 1000;
const DEFAULT_INTERVAL_MINS = 5;

async function runAutoSync() {
  try {
    const activeGames = await db.select().from(gamesTable).where(
      and(
        eq(gamesTable.status, "active"),
        isNotNull(gamesTable.sheetUrl),
      )
    );

    if (activeGames.length === 0) return;

    const now = Date.now();

    for (const game of activeGames) {
      if (!game.sheetUrl) continue;

      const intervalMins = game.syncInterval ?? DEFAULT_INTERVAL_MINS;
      const intervalMs = intervalMins * 60 * 1000;
      const lastSync = game.lastSheetSync ? new Date(game.lastSheetSync).getTime() : 0;
      const msSinceLast = now - lastSync;

      if (msSinceLast < intervalMs) continue; // not due yet

      logger.info({ gameId: game.id, intervalMins, msSinceLast }, "Auto-sync: syncing game");

      try {
        const result = await syncGameFromSheet(game.id, game.sheetUrl);
        if (result.error) {
          logger.warn({ gameId: game.id, error: result.error }, "Auto-sync failed for game");
        } else {
          logger.info(
            { gameId: game.id, resolved: result.resolved.length, alreadyResolved: result.alreadyResolved },
            "Auto-sync completed for game"
          );
        }
      } catch (err) {
        logger.error({ err, gameId: game.id }, "Auto-sync error for game");
      }
    }
  } catch (err) {
    logger.error({ err }, "Auto-sync polling error");
  }
}

export function startSheetPoller() {
  logger.info({ tickMs: TICK_MS }, "Sheet auto-sync poller started (1-min tick, per-game intervals)");
  setTimeout(runAutoSync, 15_000); // first check 15s after start
  setInterval(runAutoSync, TICK_MS);
}
