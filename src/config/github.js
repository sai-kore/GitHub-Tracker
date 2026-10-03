const list = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const bool = (value) => String(value || "").toLowerCase() === "true";

/*
 * Read lazily so it always reflects process.env after dotenv has loaded.
 */
export function getGithubConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repos = list(process.env.GITHUB_REPOS);

  const explicit = repos.length > 0 && !repos.includes("*");

  const interval = Number(process.env.SYNC_INTERVAL_MINUTES);

  return {
    owner,
    token: process.env.GITHUB_TOKEN,

    // null => discover every repo in the account
    repos: explicit ? repos : null,

    exclude: list(process.env.GITHUB_EXCLUDE_REPOS).map((r) =>
      (r.includes("/") ? r : `${owner}/${r}`).toLowerCase()
    ),

    includeForks: bool(process.env.GITHUB_INCLUDE_FORKS),
    includeArchived: bool(process.env.GITHUB_INCLUDE_ARCHIVED),

    syncIntervalMinutes: Number.isFinite(interval) ? interval : 10,
  };
}
