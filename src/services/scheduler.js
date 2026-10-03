import { getGithubConfig } from "../config/github.js";
import { syncAllRepos } from "./repoSyncService.js";

async function run() {
  try {
    const started = Date.now();
    const summary = await syncAllRepos();

    if (summary.skipped) return;

    console.log(
      `[sync] ${summary.repositories} repos in ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  } catch (error) {
    console.error("[sync] scheduled run failed:", error.message);
  }
}

export function startScheduler() {
  const { syncIntervalMinutes } = getGithubConfig();

  if (!syncIntervalMinutes || syncIntervalMinutes <= 0) {
    console.log("Background sync disabled (SYNC_INTERVAL_MINUTES=0)");
    return;
  }

  console.log(`Background sync every ${syncIntervalMinutes} min`);

  // First run shortly after boot (does the full import for new repos).
  setTimeout(run, 3000);
  setInterval(run, syncIntervalMinutes * 60 * 1000);
}
