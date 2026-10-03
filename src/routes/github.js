import express from "express";

import {
  handleGithubWebhook,
  syncAll,
  syncOneRepository,
  syncSinglePullRequest,
} from "../controllers/githubController.js";

import { githubWebhookMiddleware } from "../middleware/githubWebhook.js";
import { requireSyncSecret } from "../middleware/syncAuth.js";

const router = express.Router();

// GitHub webhook (repo or organization level)
router.post("/webhook", githubWebhookMiddleware, handleGithubWebhook);

// Sync ALL tracked repos
router.post("/sync", requireSyncSecret, syncAll);

// Sync one repo
router.post("/sync/:owner/:repo", requireSyncSecret, syncOneRepository);

// Sync one PR
router.post("/sync/:owner/:repo/:number", requireSyncSecret, syncSinglePullRequest);

export default router;
