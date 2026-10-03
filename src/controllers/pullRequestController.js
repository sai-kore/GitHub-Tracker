import PullRequest from "../models/PullRequest.js";
import { dateRange } from "../utils/dates.js";

/*
 * GET /api/pull-requests
 *
 * Filters (all optional):
 *   repo=owner/name   author=username   state=open|closed|merged
 *   since=ISO  until=ISO  (by PR creation date)
 *   page, limit       full=true (include raw GitHub payload)
 */
export async function getAllPullRequests(req, res) {
  try {
    let page = Math.max(Number(req.query.page) || 1, 1);
    let limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.repo) filter.repositoryFullName = req.query.repo;
    if (req.query.author) filter["author.username"] = req.query.author;

    if (req.query.state === "open") filter.state = "open";
    if (req.query.state === "merged") filter.merged = true;
    if (req.query.state === "closed") {
      filter.state = "closed";
      filter.merged = { $ne: true };
    }

    const range = dateRange(req.query);
    if (range) filter.createdAtGithub = range;

    const projection = req.query.full === "true" ? {} : { githubPayload: 0 };

    const [prs, total] = await Promise.all([
      PullRequest.find(filter, projection)
        .sort({ createdAtGithub: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PullRequest.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: prs.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: prs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch pull requests" });
  }
}

/*
 * GET /api/pull-requests/:owner/:repo/:number
 */
export async function getPullRequestByNumber(req, res) {
  try {
    const { owner, repo } = req.params;
    const number = Number(req.params.number);

    if (!Number.isInteger(number)) {
      return res.status(400).json({ success: false, message: "Invalid pull request number" });
    }

    const pr = await PullRequest.findOne({
      repositoryFullName: `${owner}/${repo}`,
      prNumber: number,
    }).lean();

    if (!pr) {
      return res.status(404).json({ success: false, message: "Pull request not found" });
    }

    res.json({ success: true, data: pr });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch pull request" });
  }
}
