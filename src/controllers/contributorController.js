import PullRequest from "../models/PullRequest.js";
import Commit from "../models/Commit.js";
import { dateRange } from "../utils/dates.js";

const BOT = /\[bot\]$/i;

async function computeContributors({ repo, range, includeBots, username }) {
  const repoFilter = repo ? { repositoryFullName: repo } : {};

  const prMatch = {
    ...repoFilter,
    "author.username": username ? username : { $ne: null },
  };
  if (range) prMatch.createdAtGithub = range;

  const commitMatch = {
    ...repoFilter,
    "author.login": username ? username : { $ne: null },
  };
  if (range) commitMatch.committedAt = range;

  const reviewMatch = { ...repoFilter };
  const reviewAfterUnwind = {
    "reviews.user": username ? username : { $ne: null },
    $expr: { $ne: ["$reviews.user", "$author.username"] }, // ignore self-reviews
  };
  if (range) reviewAfterUnwind["reviews.submittedAt"] = range;

  const count = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

  const [prs, reviews, commits] = await Promise.all([
    PullRequest.aggregate([
      { $match: prMatch },
      {
        $group: {
          _id: "$author.username",
          avatarUrl: { $first: "$author.avatarUrl" },
          profileUrl: { $first: "$author.url" },
          opened: { $sum: 1 },
          merged: count({ $eq: ["$merged", true] }),
          open: count({ $eq: ["$state", "open"] }),
          closedUnmerged: count({
            $and: [{ $eq: ["$state", "closed"] }, { $ne: ["$merged", true] }],
          }),
          additions: { $sum: { $ifNull: ["$additions", 0] } },
          deletions: { $sum: { $ifNull: ["$deletions", 0] } },
          changedFiles: { $sum: { $ifNull: ["$changedFiles", 0] } },
          repos: { $addToSet: "$repositoryFullName" },
        },
      },
    ]),

    PullRequest.aggregate([
      { $match: reviewMatch },
      { $unwind: "$reviews" },
      { $match: reviewAfterUnwind },
      {
        $group: {
          _id: "$reviews.user",
          given: { $sum: 1 },
          approvals: count({ $eq: ["$reviews.state", "APPROVED"] }),
          changesRequested: count({ $eq: ["$reviews.state", "CHANGES_REQUESTED"] }),
          commented: count({ $eq: ["$reviews.state", "COMMENTED"] }),
          prs: { $addToSet: "$githubPRId" },
          repos: { $addToSet: "$repositoryFullName" },
        },
      },
    ]),

    Commit.aggregate([
      { $match: commitMatch },
      {
        $group: {
          _id: "$author.login",
          avatarUrl: { $first: "$author.avatarUrl" },
          count: { $sum: 1 },
          firstCommitAt: { $min: "$committedAt" },
          lastCommitAt: { $max: "$committedAt" },
          repos: { $addToSet: "$repositoryFullName" },
        },
      },
    ]),
  ]);

  const people = new Map();

  const get = (name) => {
    if (!people.has(name)) {
      people.set(name, {
        username: name,
        avatarUrl: null,
        profileUrl: `https://github.com/${name}`,
        pullRequests: { opened: 0, merged: 0, open: 0, closedUnmerged: 0, additions: 0, deletions: 0, changedFiles: 0 },
        reviews: { given: 0, approvals: 0, changesRequested: 0, commented: 0, prsReviewed: 0 },
        commits: { count: 0, firstCommitAt: null, lastCommitAt: null },
        repos: new Set(),
      });
    }
    return people.get(name);
  };

  for (const p of prs) {
    const c = get(p._id);
    c.avatarUrl = c.avatarUrl || p.avatarUrl;
    c.profileUrl = p.profileUrl || c.profileUrl;
    c.pullRequests = {
      opened: p.opened, merged: p.merged, open: p.open, closedUnmerged: p.closedUnmerged,
      additions: p.additions, deletions: p.deletions, changedFiles: p.changedFiles,
    };
    p.repos.forEach((r) => c.repos.add(r));
  }

  for (const r of reviews) {
    const c = get(r._id);
    c.reviews = {
      given: r.given, approvals: r.approvals, changesRequested: r.changesRequested,
      commented: r.commented, prsReviewed: r.prs.length,
    };
    r.repos.forEach((x) => c.repos.add(x));
  }

  for (const m of commits) {
    const c = get(m._id);
    c.avatarUrl = c.avatarUrl || m.avatarUrl;
    c.commits = { count: m.count, firstCommitAt: m.firstCommitAt, lastCommitAt: m.lastCommitAt };
    m.repos.forEach((x) => c.repos.add(x));
  }

  return [...people.values()]
    .filter((c) => includeBots || !BOT.test(c.username))
    .map((c) => ({ ...c, repos: [...c.repos].sort() }))
    .sort(
      (a, b) =>
        b.pullRequests.opened + b.commits.count + b.reviews.given -
        (a.pullRequests.opened + a.commits.count + a.reviews.given)
    );
}

/*
 * GET /api/contributors?repo=owner/name&since=&until=&includeBots=true
 */
export async function getContributors(req, res) {
  try {
    const data = await computeContributors({
      repo: req.query.repo,
      range: dateRange(req.query),
      includeBots: req.query.includeBots === "true",
    });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch contributors" });
  }
}

/*
 * GET /api/contributors/:username
 */
export async function getContributor(req, res) {
  try {
    const { username } = req.params;
    const repo = req.query.repo;

    const [contributor] = await computeContributors({
      repo,
      range: dateRange(req.query),
      includeBots: true,
      username,
    });

    if (!contributor) {
      return res.status(404).json({ success: false, message: "Contributor not found" });
    }

    const repoFilter = repo ? { repositoryFullName: repo } : {};

    const [recentPullRequests, recentCommits] = await Promise.all([
      PullRequest.find({ ...repoFilter, "author.username": username }, { githubPayload: 0, files: 0, body: 0 })
        .sort({ createdAtGithub: -1 })
        .limit(20)
        .lean(),
      Commit.find({ ...repoFilter, "author.login": username })
        .sort({ committedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({ success: true, data: { ...contributor, recentPullRequests, recentCommits } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch contributor" });
  }
}
