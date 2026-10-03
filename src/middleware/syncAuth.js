export function requireSyncSecret(req, res, next) {
  const provided = req.headers["x-sync-secret"];

  if (!provided || provided !== process.env.SYNC_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
}
