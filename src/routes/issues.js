import express from "express";
import { listIssues, getById } from "../controllers/rawDataController.js";
import Issue from "../models/Issue.js";
const router = express.Router();
router.get("/", listIssues);
router.get("/:id", (req, res) => getById(req, res, Issue, "githubIssueId"));
export default router;
