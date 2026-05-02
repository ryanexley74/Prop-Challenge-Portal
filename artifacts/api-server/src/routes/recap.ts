import { Router, type IRouter } from "express";
import { db, gamesTable, propsTable, playersTable, answersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/games/:gameId/recap", async (req, res) => {
  try {
    const gameId = z.coerce.number().int().parse(req.params.gameId);

    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!game) return res.status(404).json({ error: "Game not found" });

    const props = await db.select().from(propsTable).where(eq(propsTable.gameId, gameId));
    const players = await db.select().from(playersTable).where(eq(playersTable.gameId, gameId));

    let answers: { propId: number; playerId: number; answer: boolean }[] = [];
    if (players.length > 0) {
      const playerIds = players.map((p) => p.id);
      answers = await db
        .select({ propId: answersTable.propId, playerId: answersTable.playerId, answer: answersTable.answer })
        .from(answersTable)
        .where(inArray(answersTable.playerId, playerIds));
    }

    // Per-prop stats
    const propStats = props.map((prop) => {
      const propAnswers = answers.filter((a) => a.propId === prop.id);
      const totalPicks = propAnswers.length;
      const trueCount = propAnswers.filter((a) => a.answer === true).length;
      const falseCount = propAnswers.filter((a) => a.answer === false).length;

      const resolved = prop.result !== null && prop.result !== undefined;
      const correctPicks = resolved
        ? propAnswers.filter((a) => a.answer === prop.result).length
        : 0;
      const accuracy = resolved && totalPicks > 0
        ? Math.round((correctPicks / totalPicks) * 100)
        : null;

      return {
        propId: prop.id,
        question: prop.question,
        type: prop.type,
        threshold: prop.threshold ?? null,
        result: prop.result ?? null,
        totalPicks,
        trueCount,
        falseCount,
        correctPicks,
        accuracy,
      };
    });

    // Overall accuracy across all resolved props
    const resolvedStats = propStats.filter((p) => p.result !== null && p.totalPicks > 0);
    const overallAccuracy =
      resolvedStats.length > 0
        ? Math.round(
            resolvedStats.reduce((sum, p) => sum + (p.accuracy ?? 0), 0) / resolvedStats.length
          )
        : 0;

    // Build podium: rank players by correct answers across resolved props
    const resolvedPropIds = new Set(
      props.filter((p) => p.result !== null && p.result !== undefined).map((p) => p.id)
    );
    const resolvedPropCount = resolvedPropIds.size;

    const playerScores = players.map((player) => {
      const playerAnswers = answers.filter((a) => a.propId in Object.fromEntries([...resolvedPropIds].map((id) => [id, true])) && a.playerId === player.id);
      const correctCount = playerAnswers.filter((a) => {
        const prop = props.find((p) => p.id === a.propId);
        return prop && prop.result === a.answer;
      }).length;
      return {
        playerId: player.id,
        playerName: player.name,
        score: correctCount,
        correctAnswers: correctCount,
        totalResolved: resolvedPropCount,
        rank: 0,
      };
    });

    playerScores.sort((a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName));
    playerScores.forEach((p, i) => { p.rank = i + 1; });

    const podium = playerScores.slice(0, 3);

    res.json({
      gameId: game.id,
      gameName: game.name,
      status: game.status,
      totalPlayers: players.length,
      totalProps: props.length,
      resolvedProps: resolvedPropCount,
      overallAccuracy,
      podium,
      propStats,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get game recap");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
