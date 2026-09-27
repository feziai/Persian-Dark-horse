import { Router, type IRouter } from "express";
import healthRouter from "./health";
import feziDataRouter from "./fezi-data";
import accountRouter from "./account";
import promptStudioRouter from "./prompt-studio";
import communityRouter from "./community";
import communityPushRouter from "./community-push";
import adminMailRouter from "./admin-mail";
import adminSupportInboxRouter from "./admin-support-inbox";
import registrationRouter from "./registration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(registrationRouter);
router.use(accountRouter);
router.use(feziDataRouter);
router.use(adminMailRouter);
router.use(adminSupportInboxRouter);
router.use(promptStudioRouter);
router.use(communityPushRouter);
router.use(communityRouter);

export default router;
