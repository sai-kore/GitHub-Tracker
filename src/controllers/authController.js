import crypto from "node:crypto";
import User from "../models/User.js";

const sessions = new Map();
const githubHeaders = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

export function githubLogin(req, res) {
  if (!process.env.GITHUB_CLIENT_ID) return res.status(501).json({ success: false, message: "GitHub OAuth is not configured" });
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie("github_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60 * 1000 });
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
  return res.redirect(`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email&state=${state}`);
}

export async function githubCallback(req, res) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) return res.status(501).json({ success: false, message: "GitHub OAuth is not configured" });
  if (!req.query.code || !req.query.state || req.query.state !== req.headers.cookie?.match(/(?:^|; )github_oauth_state=([^;]+)/)?.[1]) return res.status(400).json({ success: false, message: "Invalid OAuth state" });
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { ...githubHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code }) });
  const token = (await tokenResponse.json()).access_token;
  if (!token) return res.status(401).json({ success: false, message: "GitHub authentication failed" });
  const profileResponse = await fetch("https://api.github.com/user", { headers: { ...githubHeaders, Authorization: `Bearer ${token}` } });
  const profile = await profileResponse.json();
  if (!profile.id) return res.status(401).json({ success: false, message: "Unable to load GitHub profile" });
  await User.updateOne({ githubId: profile.id }, { $set: { githubId: profile.id, username: profile.login, name: profile.name, email: profile.email, avatarUrl: profile.avatar_url, profileUrl: profile.html_url } }, { upsert: true });
  const sessionId = crypto.randomBytes(32).toString("hex"); sessions.set(sessionId, token);
  res.cookie("github_session", sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 });
  return res.redirect(process.env.AUTH_SUCCESS_REDIRECT || "/");
}

export async function authMe(req, res) {
  const token = req.headers.cookie?.match(/(?:^|; )github_session=([^;]+)/)?.[1];
  if (!token || !sessions.has(token)) return res.status(401).json({ success: false, message: "Not authenticated" });
  const profile = await (await fetch("https://api.github.com/user", { headers: { ...githubHeaders, Authorization: `Bearer ${sessions.get(token)}` } })).json();
  return res.json({ success: true, data: { githubId: profile.id, username: profile.login, name: profile.name, email: profile.email, avatarUrl: profile.avatar_url, profileUrl: profile.html_url } });
}

export function logout(req, res) { const sessionId = req.headers.cookie?.match(/(?:^|; )github_session=([^;]+)/)?.[1]; if (sessionId) sessions.delete(sessionId); res.clearCookie("github_session"); return res.json({ success: true }); }
