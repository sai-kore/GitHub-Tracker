import { getGithubConfig } from "../config/github.js";
import { getRepository, listRepositories } from "./githubService.js";

const CACHE_MS = 5 * 60 * 1000;
let cache = { repos: null, at: 0 };

function toRepoInfo(meta) {
  return {
    owner: meta.owner.login,
    name: meta.name,
    fullName: meta.full_name,
    meta,
  };
}

/*
 * Returns every repo we should track:
 *   GITHUB_REPOS=*  -> everything in the account (auto-discovers new repos)
 *   GITHUB_REPOS=a,b -> only those
 */
export async function getTrackedRepos({ force = false } = {}) {
  if (!force && cache.repos && Date.now() - cache.at < CACHE_MS) {
    return cache.repos;
  }

  const config = getGithubConfig();
  let repos;

  if (config.repos) {
    repos = [];

    for (const entry of config.repos) {
      const [owner, name] = entry.includes("/")
        ? entry.split("/")
        : [config.owner, entry];

      try {
        repos.push(toRepoInfo(await getRepository(owner, name)));
      } catch (error) {
        console.error(`Cannot access ${owner}/${name}: ${error.message}`);
      }
    }
  } else {
    const all = await listRepositories(config.owner);

    repos = all
      .filter((r) => config.includeForks || !r.fork)
      .filter((r) => config.includeArchived || !r.archived)
      .map(toRepoInfo);
  }

  repos = repos.filter((r) => !config.exclude.includes(r.fullName.toLowerCase()));

  cache = { repos, at: Date.now() };
  return repos;
}

/*
 * Cheap check used by the webhook (no API call).
 */
export function isRepoTracked(fullName) {
  const config = getGithubConfig();
  const lower = fullName.toLowerCase();

  if (config.exclude.includes(lower)) return false;

  if (config.repos) {
    return config.repos
      .map((r) => (r.includes("/") ? r : `${config.owner}/${r}`).toLowerCase())
      .includes(lower);
  }

  return lower.startsWith(`${config.owner.toLowerCase()}/`);
}
