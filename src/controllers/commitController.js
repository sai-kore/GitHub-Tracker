import Commit from "../models/Commit.js";
import { dateRange } from "../utils/dates.js";

/*
 * GET /api/commits?repo=owner/name&author=login&since=&until=&page=&limit=
 */
export async function getCommits(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const filter = {};
    if (req.query.repo) filter.repositoryFullName = req.query.repo;
    if (req.query.author) filter["author.login"] = req.query.author;

    const range = dateRange(req.query);
    if (range) filter.committedAt = range;

    const [commits, total] = await Promise.all([
      Commit.find(filter)
        .sort({ committedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Commit.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: commits.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: commits,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch commits" });
  }
}
