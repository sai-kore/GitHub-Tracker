const requiredEnv = [
  "MONGODB_URI",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "SYNC_SECRET",
];

export function validateEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  if (process.env.GITHUB_REPO) {
    console.warn(
      "GITHUB_REPO is no longer used. Use GITHUB_REPOS (comma separated, or *) instead."
    );
  }
}
