import { Router, type IRouter } from "express";
import { db, gamesTable, propsTable, playersTable, answersTable } from "@workspace/db";
import { ilike, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/player-history", async (req, res) => {
  try {
    const name = z.string().min(1).parse(req.query.name);

    // Find all player records with this name (case-insensitive)
    const playerRecords = await db.select().from(playersTable)
      .where(ilike(playersTable.name, name));

    if (playerRecords.length === 0) {
      return res.json({
        playerName: name,
        totalGames: 0,
        overallCorrect: 0,
        overallResolved: 0,
        overallAccuracy: 0,
        bestRank: null,
        championCount: 0,
        games: [],
      });
    }

    const gameIds = [...new Set(playerRecords.map(p => p.gameId))];

    // Batch-fetch everything we need
    const [games, allProps, allPlayersInGames] = await Promise.all([
      db.select().from(gamesTable).where(inArray(gamesTable.id, gameIds)),
      db.select().from(propsTable).where(inArray(propsTable.gameId, gameIds)),
      db.select().from(playersTable).where(inArray(playersTable.gameId, gameIds)),
    ]);

    const allPlayerIds = allPlayersInGames.map(p => p.id);
    const allAnswers = allPlayerIds.length > 0
      ? await db.select({
          propId: answersTable.propId,
          playerId: answersTable.playerId,
          answer: answersTable.answer,
        }).from(answersTable).where(inArray(answersTable.playerId, allPlayerIds))
      : [];

    let overallCorrect = 0;
    let overallResolved = 0;
    let championCount = 0;
    let bestRank: number | null = null;

    const gameEntries = games
      .filter(g => g.includeInArchive !== false)
      .map(game => {
        const myRecord = playerRecords.find(p => p.gameId === game.id);
        if (!myRecord) return null;

        const gameProps = allProps.filter(p => p.gameId === game.id);
        const resolvedProps = gameProps.filter(p => p.result !== null && p.result !== undefined);
        const propResultMap = new Map(resolvedProps.map(p => [p.id, p.result as boolean]));

        // Score every player for rank computation
        const gamePlayers = allPlayersInGames.filter(p => p.gameId === game.id);
        const scored = gamePlayers.map(player => {
          const pAnswers = allAnswers.filter(
            a => a.playerId === player.id && propResultMap.has(a.propId)
          );
          const correct = pAnswers.filter(a => propResultMap.get(a.propId) === a.answer).length;
          return { playerId: player.id, correct };
        }).sort((a, b) => b.correct - a.correct);

        let rank = 1;
        const rankMap = new Map<number, number>();
        for (let i = 0; i < scored.length; i++) {
          if (i > 0 && scored[i].correct < scored[i - 1].correct) rank = i + 1;
          rankMap.set(scored[i].playerId, rank);
        }

        const myAnswers = allAnswers.filter(a => a.playerId === myRecord.id);
        const myCorrect = myAnswers.filter(
          a => propResultMap.has(a.propId) && propResultMap.get(a.propId) === a.answer
        ).length;
        const myResolved = myAnswers.filter(a => propResultMap.has(a.propId)).length;
        const myRank = rankMap.get(myRecord.id) ?? null;
        const accuracy = myResolved > 0 ? Math.round((myCorrect / myResolved) * 100) : null;

        overallCorrect += myCorrect;
        overallResolved += resolvedProps.length;
        if (myRank === 1) championCount++;
        if (myRank !== null && (bestRank === null || myRank < bestRank)) bestRank = myRank;

        return {
          gameId: game.id,
          gameName: game.name,
          status: game.status,
          createdAt: game.createdAt.toISOString(),
          score: myCorrect,
          correctAnswers: myCorrect,
          totalResolved: resolvedProps.length,
          totalAnswered: myAnswers.length,
          accuracy,
          rank: myRank,
          totalPlayers: gamePlayers.length,
          isChampion: myRank === 1,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

    const overallAccuracy = overallResolved > 0
      ? Math.round((overallCorrect / overallResolved) * 100)
      : 0;

    res.json({
      playerName: playerRecords[0].name,
      totalGames: gameEntries.length,
      overallCorrect,
      overallResolved,
      overallAccuracy,
      bestRank,
      championCount,
      games: gameEntries,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get player history");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
