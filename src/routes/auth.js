import express from "express";
import { githubLogin, githubCallback, authMe, logout } from "../controllers/authController.js";
const router = express.Router();
router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.get("/me", authMe);
router.post("/logout", logout);
export default router;
