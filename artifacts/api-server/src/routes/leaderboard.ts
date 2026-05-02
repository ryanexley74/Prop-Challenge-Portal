import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gamesTable, propsTable, playersTable, answersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { GetLeaderboardParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/games/:gameId/leaderboard", async (req, res) => {
  try {
    const { gameId } = GetLeaderboardParams.parse(req.params);

    const [game] = await db.select().from(gamesTable).where(eq(gamesTable.id, gameId));
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Get all resolved props for this game
    const props = await db.select().from(propsTable).where(eq(propsTable.gameId, gameId));
    const resolvedProps = props.filter(p => p.result !== null && p.result !== undefined);
    const resolvedPropIds = resolvedProps.map(p => p.id);

    // Get all players
    const players = await db.select().from(playersTable).where(eq(playersTable.gameId, gameId));

    if (players.length === 0) {
      return res.json({
        gameId: game.id,
        gameName: game.name,
        entries: [],
        resolvedPropCount: resolvedProps.length,
        totalPropCount: props.length,
      });
    }

    // Get all answers for resolved props
    let answers: { propId: number; playerId: number; answer: boolean }[] = [];
    if (resolvedPropIds.length > 0) {
      answers = await db.select().from(answersTable)
        .where(inArray(answersTable.propId, resolvedPropIds));
    }

    // Build a map of propId -> correct answer
    const propResultMap = new Map<number, boolean>();
    for (const prop of resolvedProps) {
      if (prop.result !== null && prop.result !== undefined) {
        propResultMap.set(prop.id, prop.result);
      }
    }

    // Score each player
    const entries = players.map((player) => {
      const playerAnswers = answers.filter(a => a.playerId === player.id);
      let correct = 0;
      for (const ans of playerAnswers) {
        const correctResult = propResultMap.get(ans.propId);
        if (correctResult !== undefined && ans.answer === correctResult) {
          correct++;
        }
      }
      return {
        playerId: player.id,
        playerName: player.name,
        score: correct,
        correctAnswers: correct,
        totalResolved: resolvedProps.length,
        rank: 0, // will be set after sorting
      };
    });

    // Sort by score descending, assign ranks
    entries.sort((a, b) => b.score - a.score);
    let rank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].score < entries[i - 1].score) {
        rank = i + 1;
      }
      entries[i].rank = rank;
    }

    res.json({
      gameId: game.id,
      gameName: game.name,
      entries,
      resolvedPropCount: resolvedProps.length,
      totalPropCount: props.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
