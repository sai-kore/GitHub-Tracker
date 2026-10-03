import { getGithubConfig } from "../config/github.js";

const BASE_URL = "https://api.github.com";
const MAX_RATE_LIMIT_WAIT_MS = 10 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function githubRequest(path, attempt = 0) {
  const { token } = getGithubConfig();

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });

  if (response.ok) {
    return response.json();
  }

  /*
   * Rate limit handling: wait and retry instead of failing the whole sync.
   */
  const retryAfter = response.headers.get("retry-after");
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");

  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && (retryAfter || remaining === "0"));

  if (rateLimited && attempt < 3) {
    const waitMs = retryAfter
      ? Number(retryAfter) * 1000
      : Math.max(Number(reset) * 1000 - Date.now(), 0) + 1000;

    if (waitMs <= MAX_RATE_LIMIT_WAIT_MS) {
      console.warn(`GitHub rate limit hit, waiting ${Math.ceil(waitMs / 1000)}s`);
      await sleep(waitMs);
      return githubRequest(path, attempt + 1);
    }
  }

  if (response.status >= 500 && attempt < 2) {
    await sleep(1000 * (attempt + 1));
    return githubRequest(path, attempt + 1);
  }

  const errorText = await response.text();
  const error = new Error(`GitHub API ${response.status}: ${errorText}`);
  error.status = response.status;
  throw error;
}

/*
 * Generic paginated GitHub request.
 */
async function githubRequestAll(path) {
  const results = [];
  let page = 1;

  while (true) {
    const separator = path.includes("?") ? "&" : "?";

    const data = await githubRequest(
      `${path}${separator}per_page=100&page=${page}`
    );

    if (!Array.isArray(data)) {
      return data;
    }

    results.push(...data);

    if (data.length < 100) {
      break;
    }

    page++;
  }

  return results;
}

/* ---------- Repositories ---------- */

export async function getRepository(owner, repo) {
  return githubRequest(`/repos/${owner}/${repo}`);
}

export async function getRepositoryCollaborators(owner, repo) {
  return githubRequestAll(`/repos/${owner}/${repo}/collaborators?affiliation=all`);
}

/*
 * List every repo of an account.
 * - token owner's own account  -> includes private repos
 * - organization               -> /orgs/:org/repos
 * - another user               -> /users/:user/repos (public)
 */
export async function listRepositories(owner) {
  let me = null;
  try {
    me = (await githubRequest("/user")).login;
  } catch {
    // e.g. fine-grained token without /user access
  }

  if (me && me.toLowerCase() === owner.toLowerCase()) {
    return githubRequestAll(
      "/user/repos?affiliation=owner&visibility=all&sort=full_name"
    );
  }

  try {
    return await githubRequestAll(`/orgs/${owner}/repos?type=all`);
  } catch (error) {
    if (error.status !== 404) throw error;
    return githubRequestAll(`/users/${owner}/repos?type=owner`);
  }
}

/* ---------- Pull requests ---------- */

export async function getPullRequest(owner, repo, pullNumber) {
  return githubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
}

export async function getAllPullRequests(owner, repo) {
  return githubRequestAll(
    `/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=asc`
  );
}

/*
 * Only PRs updated after `since` (newest first, stops early).
 * since = null => everything.
 */
export async function getPullRequestsUpdatedSince(owner, repo, since) {
  const results = [];
  let page = 1;

  while (true) {
    const data = await githubRequest(
      `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}`
    );

    for (const pr of data) {
      if (since && new Date(pr.updated_at) < since) {
        return results;
      }
      results.push(pr);
    }

    if (data.length < 100) break;
    page++;
  }

  return results;
}

export async function getPullRequestFiles(owner, repo, pullNumber) {
  return githubRequestAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
}

export async function getPullRequestReviews(owner, repo, pullNumber) {
  return githubRequestAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`);
}

export async function getPullRequestReviewComments(owner, repo, pullNumber) {
  return githubRequestAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments`);
}

export async function getPullRequestCommits(owner, repo, pullNumber) {
  return githubRequestAll(`/repos/${owner}/${repo}/pulls/${pullNumber}/commits`);
}

/* ---------- Issues & issue comments ---------- */

// NOTE: GitHub's issues endpoint also returns PRs; callers must filter them out.
export async function getIssuesSince(owner, repo, since) {
  const query = `?state=all&sort=updated&direction=asc${since ? `&since=${encodeURIComponent(since.toISOString())}` : ""}`;
  return githubRequestAll(`/repos/${owner}/${repo}/issues${query}`);
}

// Covers comments on issues AND pull requests.
export async function getIssueCommentsSince(owner, repo, since) {
  const query = since ? `?since=${encodeURIComponent(since.toISOString())}` : "";
  return githubRequestAll(`/repos/${owner}/${repo}/issues/comments${query}`);
}

/* ---------- Commits (default branch) ---------- */

export async function getCommits(owner, repo, since) {
  const query = since ? `?since=${encodeURIComponent(since.toISOString())}` : "";

  try {
    return await githubRequestAll(`/repos/${owner}/${repo}/commits${query}`);
  } catch (error) {
    // 409 = empty repository
    if (error.status === 409) return [];
    throw error;
  }
}
