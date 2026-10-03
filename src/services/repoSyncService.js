import Repository from "../models/Repository.js";
import Commit from "../models/Commit.js";
import RepositoryMember from "../models/RepositoryMember.js";
import Issue from "../models/Issue.js";
import IssueComment from "../models/IssueComment.js";
import PullRequest from "../models/PullRequest.js";

import {
  getCommits,
  getPullRequestsUpdatedSince,
  getRepositoryCollaborators,
  getIssuesSince,
  getIssueCommentsSince,
} from "./githubService.js";

import { syncPullRequest } from "./pullRequestSyncService.js";
import { getTrackedRepos } from "./repoService.js";
import { mapLimit } from "../utils/pool.js";

const OVERLAP_MS = 5 * 60 * 1000; // re-check a small window to be safe
const PR_CONCURRENCY = 4;
const MEMBERS_REFRESH_MS = 24 * 60 * 60 * 1000; // collaborators rarely change

let running = false;

export function isSyncRunning() {
  return running;
}

function repoMetaFields(meta) {
  if (!meta) return {};
  return {
    githubId: meta.id,
    githubRepositoryId: meta.id,
    owner: meta.owner?.login,
    ownerGithubId: meta.owner?.id,
    name: meta.name,
    description: meta.description,
    htmlUrl: meta.html_url,
    private: meta.private,
    fork: meta.fork,
    archived: meta.archived,
    defaultBranch: meta.default_branch,
    language: meta.language,
    stars: meta.stargazers_count,
  };
}

function repositoryUpdate(repo) {
  return { ...repoMetaFields(repo.meta), owner: repo.owner, name: repo.name };
}

function normalizeCommit(fullName, repositoryId, c) {
  return {
    sha: c.sha,
    repositoryFullName: fullName,
    repositoryId,
    message: c.commit?.message,
    url: c.html_url,
    parents: c.parents?.length ?? 0,
    isMergeCommit: (c.parents?.length ?? 0) > 1,
    author: {
      login: c.author?.login,
      githubId: c.author?.id,
      name: c.commit?.author?.name,
      email: c.commit?.author?.email,
      avatarUrl: c.author?.avatar_url,
    },
    committer: {
      login: c.committer?.login,
      githubId: c.committer?.id,
      name: c.commit?.committer?.name,
      email: c.commit?.committer?.email,
    },
    authoredAt: c.commit?.author?.date,
    committedAt: c.commit?.committer?.date,
  };
}

/*
 * Incremental commit sync for one repo (default branch).
 */
export async function syncRepoCommits(repo, { full = false } = {}) {
  const startedAt = new Date();

  const state = await Repository.findOne({ fullName: repo.fullName }).lean();

  const since =
    full || !state?.lastCommitSyncAt
      ? null
      : new Date(state.lastCommitSyncAt.getTime() - OVERLAP_MS);

  const commits = await getCommits(repo.owner, repo.name, since);
  const repositoryId = repo.meta?.id ?? state?.githubId;

  const ops = commits.map((c) => {
    const doc = normalizeCommit(repo.fullName, repositoryId, c);
    return {
      updateOne: {
        filter: { repositoryFullName: repo.fullName, sha: doc.sha },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  for (let i = 0; i < ops.length; i += 500) {
    await Commit.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }

  await Repository.updateOne(
    { fullName: repo.fullName },
    {
      $set: { lastCommitSyncAt: startedAt, ...repositoryUpdate(repo) },
    },
    { upsert: true }
  );

  return { fetched: commits.length };
}

/*
 * Incremental PR sync for one repo.
 */
export async function syncRepoPullRequests(repo, { full = false } = {}) {
  const startedAt = new Date();

  const state = await Repository.findOne({ fullName: repo.fullName }).lean();

  const since =
    full || !state?.lastPRSyncAt
      ? null
      : new Date(state.lastPRSyncAt.getTime() - OVERLAP_MS);

  const prs = await getPullRequestsUpdatedSince(repo.owner, repo.name, since);

  const errors = [];
  let synced = 0;

  await mapLimit(prs, PR_CONCURRENCY, async (pr) => {
    try {
      await syncPullRequest(repo.owner, repo.name, pr.number);
      synced++;
    } catch (error) {
      errors.push({ prNumber: pr.number, error: error.message });
      console.error(`Failed ${repo.fullName}#${pr.number}: ${error.message}`);
    }
  });

  /*
   * Only move the checkpoint forward if everything worked,
   * so failed PRs are retried next run.
   */
  const update = { ...repoMetaFields(repo.meta) };
  if (errors.length === 0) update.lastPRSyncAt = startedAt;

  await Repository.updateOne(
    { fullName: repo.fullName },
    {
      $set: { ...update, owner: repo.owner, name: repo.name },
    },
    { upsert: true }
  );

  return { discovered: prs.length, synced, failed: errors.length, errors };
}

const userFields = (u) => ({
  githubId: u?.id,
  username: u?.login,
  name: u?.name,
  avatarUrl: u?.avatar_url,
  profileUrl: u?.html_url,
});

/*
 * Incremental issue sync (real issues only - GitHub mixes PRs into /issues).
 */
export async function syncRepoIssues(repo, { full = false } = {}) {
  const startedAt = new Date();
  const state = await Repository.findOne({ fullName: repo.fullName }).lean();
  const repositoryId = repo.meta?.id ?? state?.githubId;

  const since =
    full || !state?.lastIssueSyncAt
      ? null
      : new Date(state.lastIssueSyncAt.getTime() - OVERLAP_MS);

  const issues = (await getIssuesSince(repo.owner, repo.name, since)).filter(
    (i) => !i.pull_request
  );

  const issueOps = issues.map((i) => ({
    updateOne: {
      filter: { githubIssueId: i.id },
      update: {
        $set: {
          repositoryId,
          repositoryFullName: repo.fullName,
          issueNumber: i.number,
          author: userFields(i.user),
          title: i.title,
          body: i.body,
          state: i.state,
          createdAtGithub: i.created_at,
          updatedAtGithub: i.updated_at,
          closedAt: i.closed_at,
          labels: (i.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color, description: l.description })),
          assignees: (i.assignees || []).map(userFields),
          milestone: i.milestone,
          htmlUrl: i.html_url,
        },
      },
      upsert: true,
    },
  }));

  for (let k = 0; k < issueOps.length; k += 500) {
    await Issue.bulkWrite(issueOps.slice(k, k + 500), { ordered: false });
  }

  // Comments (issues + PRs). Work out which numbers are PRs.
  const comments = await getIssueCommentsSince(repo.owner, repo.name, since);
  const numberOf = (c) => Number(String(c.issue_url).split("/").pop());
  const numbers = [...new Set(comments.map(numberOf))];
  const prNumbers = new Set(
    (await PullRequest.find(
      { repositoryFullName: repo.fullName, prNumber: { $in: numbers } },
      { prNumber: 1 }
    ).lean()).map((p) => p.prNumber)
  );

  const commentOps = comments.map((c) => ({
    updateOne: {
      filter: { githubCommentId: c.id },
      update: {
        $set: {
          repositoryId,
          repositoryFullName: repo.fullName,
          issueOrPrNumber: numberOf(c),
          author: userFields(c.user),
          body: c.body,
          createdAtGithub: c.created_at,
          updatedAtGithub: c.updated_at,
          isPullRequest: prNumbers.has(numberOf(c)),
        },
      },
      upsert: true,
    },
  }));

  for (let k = 0; k < commentOps.length; k += 500) {
    await IssueComment.bulkWrite(commentOps.slice(k, k + 500), { ordered: false });
  }

  await Repository.updateOne(
    { fullName: repo.fullName },
    { $set: { lastIssueSyncAt: startedAt, ...repositoryUpdate(repo) } },
    { upsert: true }
  );

  return { issues: issues.length, comments: comments.length };
}

async function syncRepositoryMembers(repo, repositoryId) {
  const collaborators = await getRepositoryCollaborators(repo.owner, repo.name);
  const syncedAt = new Date();
  const ops = collaborators.filter((member) => member.id).map((member) => ({
    updateOne: {
      filter: { repositoryId, githubId: member.id },
      update: { $set: { repositoryId, repositoryFullName: repo.fullName, githubId: member.id, username: member.login, roleName: member.role_name, permission: member.permissions?.admin ? "admin" : member.permissions?.maintain ? "maintain" : member.permissions?.push ? "push" : member.permissions?.triage ? "triage" : member.permissions?.pull ? "pull" : undefined, isRepositoryOwner: member.login?.toLowerCase() === repo.owner.toLowerCase(), syncedAt } },
      upsert: true,
    },
  }));
  if (ops.length) await RepositoryMember.bulkWrite(ops, { ordered: false });

  // drop people who are no longer collaborators
  await RepositoryMember.deleteMany({ repositoryId, syncedAt: { $lt: syncedAt } });

  await Repository.updateOne({ fullName: repo.fullName }, { $set: { lastMembersSyncAt: syncedAt } });
  return { fetched: collaborators.length };
}

/*
 * Sync everything for one repo.
 */
export async function syncRepo(repo, options = {}) {
  const startedAt = new Date();

  await Repository.updateOne(
    { fullName: repo.fullName },
    {
      $set: { lastSyncStartedAt: startedAt, ...repositoryUpdate(repo) },
    },
    { upsert: true }
  );

  const result = { repo: repo.fullName, pullRequests: null, commits: null, issues: null, members: null };
  let failure = null;       // PR / commit / issue failure => "failed"
  let membersError = null;  // members only => "partial" (token often lacks permission)

  const state = await Repository.findOne({ fullName: repo.fullName }).lean();
  const repositoryId = repo.meta?.id ?? state?.githubId;

  try {
    result.pullRequests = await syncRepoPullRequests(repo, options);
  } catch (error) {
    failure = error;
    result.pullRequests = { error: error.message };
  }

  try {
    result.commits = await syncRepoCommits(repo, options);
  } catch (error) {
    failure = failure || error;
    result.commits = { error: error.message };
  }

  try {
    result.issues = await syncRepoIssues(repo, options);
  } catch (error) {
    failure = failure || error;
    result.issues = { error: error.message };
  }

  const membersDue =
    options.full ||
    !state?.lastMembersSyncAt ||
    Date.now() - new Date(state.lastMembersSyncAt).getTime() > MEMBERS_REFRESH_MS;

  if (repositoryId && membersDue) {
    try {
      result.members = await syncRepositoryMembers(repo, repositoryId);
    } catch (error) {
      membersError = error;
      result.members = { error: error.message };
    }
  }

  const prFailed = result.pullRequests?.failed > 0;
  const status = failure ? "failed" : prFailed || membersError ? "partial" : "success";
  const errorMessage = failure?.message ?? (membersError ? `members: ${membersError.message}` : null);

  await Repository.updateOne(
    { fullName: repo.fullName },
    {
      $set: {
        lastSyncFinishedAt: new Date(),
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: errorMessage,
        lastSyncStats: {
          pullRequests: result.pullRequests && {
            discovered: result.pullRequests.discovered,
            synced: result.pullRequests.synced,
            failed: result.pullRequests.failed,
          },
          commits: result.commits,
          issues: result.issues,
          members: result.members,
        },
      },
    }
  );

  result.status = status;
  return result;
}

/*
 * Sync every tracked repo. Only one run at a time.
 */
export async function syncAllRepos(options = {}) {
  if (running) {
    return { skipped: true, reason: "A sync is already running" };
  }

  running = true;

  try {
    const repos = await getTrackedRepos({ force: true });
    const results = [];

    for (const repo of repos) {
      try {
        results.push(await syncRepo(repo, options));
      } catch (error) {
        console.error(`Sync failed for ${repo.fullName}:`, error.message);
        results.push({ repo: repo.fullName, status: "failed", error: error.message });
      }
    }

    return { skipped: false, repositories: results.length, results };
  } finally {
    running = false;
  }
}
