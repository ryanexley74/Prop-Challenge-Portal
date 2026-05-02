import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gamesRouter from "./games";
import propsRouter from "./props";
import playersRouter from "./players";
import answersRouter from "./answers";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gamesRouter);
router.use(propsRouter);
router.use(playersRouter);
router.use(answersRouter);
router.use(leaderboardRouter);

export default router;
