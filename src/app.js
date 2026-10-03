import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import githubRoutes from "./routes/github.js";
import pullRequestRoutes from "./routes/pullRequests.js";
import contributorRoutes from "./routes/contributors.js";
import repositoryRoutes from "./routes/repositories.js";
import dataRoutes from "./routes/data.js";
import issueRoutes from "./routes/issues.js";
import userRoutes from "./routes/users.js";
import authRoutes from "./routes/auth.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit the whole API except GitHub webhooks / sync endpoints
app.use("/api", (req, res, next) =>
  req.path.startsWith("/github") ? next() : apiLimiter(req, res, next)
);

// Reject invalid date filters with 400 instead of a 500
app.use("/api", (req, res, next) => {
  for (const key of ["since", "until", "from", "to"]) {
    const value = req.query[key];
    if (value !== undefined && Number.isNaN(new Date(value).getTime())) {
      return res.status(400).json({ success: false, message: `Invalid date for "${key}"` });
    }
  }
  next();
});

/*
 * GitHub webhook MUST receive raw body.
 */
app.use(
  "/api/github/webhook",
  express.raw({
    type: "application/json",
    limit: "25mb", // GitHub allows payloads up to 25 MB (default 100kb would 413)
  }),
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "GitHub Contribution API is running",
  });
});

app.use("/api/github", githubRoutes);

app.use("/api/pull-requests", pullRequestRoutes);
app.use("/api/contributors", contributorRoutes);
app.use("/api/repositories", repositoryRoutes);
app.use("/api", dataRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

export default app;
