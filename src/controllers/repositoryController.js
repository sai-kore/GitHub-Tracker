import Repository from "../models/Repository.js";
import PullRequest from "../models/PullRequest.js";
import Commit from "../models/Commit.js";

/*
 * GET /api/repositories
 * Every tracked repo with sync status and counts.
 */
export async function getRepositories(req, res) {
  try {
    const [repos, prCounts, commitCounts] = await Promise.all([
      Repository.find().sort({ fullName: 1 }).lean(),
      PullRequest.aggregate([{ $group: { _id: "$repositoryFullName", count: { $sum: 1 } } }]),
      Commit.aggregate([{ $group: { _id: "$repositoryFullName", count: { $sum: 1 } } }]),
    ]);

    const prMap = new Map(prCounts.map((x) => [x._id, x.count]));
    const commitMap = new Map(commitCounts.map((x) => [x._id, x.count]));

    res.json({
      success: true,
      count: repos.length,
      data: repos.map((r) => ({
        ...r,
        pullRequestCount: prMap.get(r.fullName) || 0,
        commitCount: commitMap.get(r.fullName) || 0,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch repositories" });
  }
}
