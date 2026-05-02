import { db, gamesTable } from "@workspace/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { syncGameFromSheet } from "../lib/sheet-sync-core";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runAutoSync() {
  try {
    const activeGames = await db.select().from(gamesTable).where(
      and(
        eq(gamesTable.status, "active"),
        isNotNull(gamesTable.sheetUrl),
      )
    );

    if (activeGames.length === 0) return;

    logger.info({ count: activeGames.length }, "Auto-sync: checking active games with sheets");

    for (const game of activeGames) {
      if (!game.sheetUrl) continue;
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
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Sheet auto-sync poller started");
  // Run immediately on startup (after a short delay to let the server settle)
  setTimeout(runAutoSync, 30_000);
  setInterval(runAutoSync, POLL_INTERVAL_MS);
}
