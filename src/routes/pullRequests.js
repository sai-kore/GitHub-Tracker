import express from "express";

import {
  getAllPullRequests,
  getPullRequestByNumber,
} from "../controllers/pullRequestController.js";
import PullRequest from "../models/PullRequest.js";
import { getById, getPRLabels, getPRLabelEvents, getPRReviews, getPRReviewComments } from "../controllers/rawDataController.js";

const router = express.Router();

router.get("/", getAllPullRequests);
router.get("/:id/labels", getPRLabels);
router.get("/:id/label-events", getPRLabelEvents);
router.get("/:id/reviews", getPRReviews);
router.get("/:id/review-comments", getPRReviewComments);
router.get("/:id", (req, res) => getById(req, res, PullRequest, "githubPRId"));
router.get("/:owner/:repo/:number", getPullRequestByNumber);

export default router;
