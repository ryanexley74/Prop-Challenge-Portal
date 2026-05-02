import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gamesRouter from "./games";
import propsRouter from "./props";
import importPropsRouter from "./import-props";
import playersRouter from "./players";
import answersRouter from "./answers";
import leaderboardRouter from "./leaderboard";
import recapRouter from "./recap";
import sheetSyncRouter from "./sheet-sync";
import aiStatusRouter from "./ai-status";
import playerHistoryRouter from "./player-history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiStatusRouter);
router.use(playerHistoryRouter);
router.use(gamesRouter);
router.use(propsRouter);
router.use(importPropsRouter);
router.use(playersRouter);
router.use(answersRouter);
router.use(leaderboardRouter);
router.use(recapRouter);
router.use(sheetSyncRouter);

export default router;
