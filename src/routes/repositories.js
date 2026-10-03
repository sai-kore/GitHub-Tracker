import express from "express";
import { getRepositories } from "../controllers/repositoryController.js";
import { getRepositoryMembers, getRepositoryLabels } from "../controllers/rawDataController.js";
import Repository from "../models/Repository.js";
import { getById } from "../controllers/rawDataController.js";

const router = express.Router();
router.get("/", getRepositories);
router.get("/:id/members", getRepositoryMembers);
router.get("/:id/labels", getRepositoryLabels);
router.get("/:id", (req, res) => getById(req, res, Repository, "githubId"));

export default router;
