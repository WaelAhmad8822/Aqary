import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import propertiesRouter from "./properties";
import recommendationsRouter from "./recommendations";
import interactionsRouter from "./interactions";
import chatRouter from "./chat";
import adminRouter from "./admin";
import userRouter from "./user";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(propertiesRouter);
router.use(recommendationsRouter);
router.use(interactionsRouter);
router.use(chatRouter);
router.use(adminRouter);
router.use(userRouter);

export default router;
