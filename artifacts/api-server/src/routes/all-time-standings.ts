import { Router, type IRouter } from "express";
import { db, gamesTable, propsTable, playersTable, answersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/all-time-standings", async (req, res) => {
  try {
    const allGames = await db.select().from(gamesTable);
    const archivedGames = allGames.filter(
      (g) => g.status === "completed" && g.includeInArchive !== false
    );

    if (archivedGames.length === 0) {
      return res.json([]);
    }

    const gameIds = archivedGames.map((g) => g.id);

    const [allProps, allPlayers] = await Promise.all([
      db.select().from(propsTable).where(inArray(propsTable.gameId, gameIds)),
      db.select().from(playersTable).where(inArray(playersTable.gameId, gameIds)),
    ]);

    const allPlayerIds = allPlayers.map((p) => p.id);
    const allAnswers =
      allPlayerIds.length > 0
        ? await db
            .select({
              propId: answersTable.propId,
              playerId: answersTable.playerId,
              answer: answersTable.answer,
            })
            .from(answersTable)
            .where(inArray(answersTable.playerId, allPlayerIds))
        : [];

    // Map: normalised name → accumulated stats
    const statsMap = new Map<
      string,
      {
        displayName: string;
        gamesPlayed: number;
        wins: number;
        totalCorrect: number;
        totalResolved: number;
        bestRank: number | null;
      }
    >();

    for (const game of archivedGames) {
      const gameProps = allProps.filter((p) => p.gameId === game.id);
      const resolvedProps = gameProps.filter(
        (p) => p.result !== null && p.result !== undefined
      );
      const propResultMap = new Map(
        resolvedProps.map((p) => [p.id, p.result as boolean])
      );

      const gamePlayers = allPlayers.filter((p) => p.gameId === game.id);

      const scored = gamePlayers.map((player) => {
        const playerAnswers = allAnswers.filter(
          (a) => a.playerId === player.id && propResultMap.has(a.propId)
        );
        const correct = playerAnswers.filter(
          (a) => propResultMap.get(a.propId) === a.answer
        ).length;
        return { player, correct };
      });

      scored.sort((a, b) => b.correct - a.correct);

      let rank = 1;
      const rankMap = new Map<number, number>();
      for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].correct < scored[i - 1].correct) rank = i + 1;
        rankMap.set(scored[i].player.id, rank);
      }

      for (const { player, correct } of scored) {
        const key = player.name.toLowerCase();
        const playerRank = rankMap.get(player.id) ?? null;

        if (!statsMap.has(key)) {
          statsMap.set(key, {
            displayName: player.name,
            gamesPlayed: 0,
            wins: 0,
            totalCorrect: 0,
            totalResolved: 0,
            bestRank: null,
          });
        }

        const s = statsMap.get(key)!;
        s.gamesPlayed++;
        s.totalCorrect += correct;
        s.totalResolved += resolvedProps.length;
        if (playerRank === 1) s.wins++;
        if (playerRank !== null && (s.bestRank === null || playerRank < s.bestRank)) {
          s.bestRank = playerRank;
        }
      }
    }

    const standings = [...statsMap.values()]
      .map((s) => ({
        playerName: s.displayName,
        gamesPlayed: s.gamesPlayed,
        wins: s.wins,
        totalCorrect: s.totalCorrect,
        totalResolved: s.totalResolved,
        avgAccuracy:
          s.totalResolved > 0
            ? Math.round((s.totalCorrect / s.totalResolved) * 100)
            : null,
        bestRank: s.bestRank,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
        return (b.avgAccuracy ?? 0) - (a.avgAccuracy ?? 0);
      });

    res.json(standings);
  } catch (err) {
    req.log.error({ err }, "Failed to get all-time standings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
