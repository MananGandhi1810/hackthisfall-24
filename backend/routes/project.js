import { Router } from "express";
import { checkAuth } from "../middleware/auth.js";
import {
    newProjectHandler,
    newProjectWithChatHandler,
} from "../handlers/project.js";
import {
    incomingWebhookHandler,
} from "../handlers/webhook.js";
const router = Router();

// Public route
router.post("/:projectId/hooks/", incomingWebhookHandler);

router.use(checkAuth);

router.post("/new", newProjectHandler);
router.post("/newWithChat", newProjectWithChatHandler);


export default router;
