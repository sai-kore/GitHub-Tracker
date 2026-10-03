import express from "express";
import { getContributors, getContributor } from "../controllers/contributorController.js";

const router = express.Router();
router.get("/", getContributors);
router.get("/:username", getContributor);

export default router;
