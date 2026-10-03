import { verifyGithubSignature } from "../utils/signature.js";

export function githubWebhookMiddleware(req, res, next) {
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ success: false, message: "Malformed webhook body" });
  }
  const signature = req.headers["x-hub-signature-256"];

  const isValid = verifyGithubSignature(
    req.body,
    signature
  );

  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid GitHub webhook signature",
    });
  }

  next();
}