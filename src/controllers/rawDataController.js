import PullRequest from "../models/PullRequest.js";
import Commit from "../models/Commit.js";
import Review from "../models/Review.js";
import ReviewComment from "../models/ReviewComment.js";
import Issue from "../models/Issue.js";
import IssueComment from "../models/IssueComment.js";
import PRLabelEvent from "../models/PRLabelEvent.js";
import ContributionEvent from "../models/ContributionEvent.js";
import RepositoryMember from "../models/RepositoryMember.js";
import Repository from "../models/Repository.js";
import User from "../models/User.js";

const models = { pullRequests: PullRequest, commits: Commit, reviews: Review, reviewComments: ReviewComment, issues: Issue, contributions: ContributionEvent };
const pageArgs = (query) => { const page = Math.max(Number(query.page) || 1, 1); const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100); return { page, limit, skip: (page - 1) * limit }; };
const range = (query, field) => { const value = {}; if (query.from) value.$gte = new Date(query.from); if (query.to) value.$lte = new Date(query.to); return Object.keys(value).length ? { [field]: value } : {}; };
const filter = (query, dateField) => { const value = {}; const repo = query.repository || query.repositoryFullName || query.repo; if (repo) value.repositoryFullName = repo; if (query.githubUserId) value["author.githubId"] = Number(query.githubUserId); if (query.author || query.username) value["author.username"] = query.author || query.username; if (query.state) value.state = query.state; if (query.action) value.action = query.action; if (query.label) value["labels.name"] = query.label; return { ...value, ...range(query, dateField) }; };

export async function listModel(req, res, model, dateField, makeFilter = filter, projection = {}) { try { const { page, limit, skip } = pageArgs(req.query); const query = makeFilter(req.query); const [data, total] = await Promise.all([model.find(query, projection).sort({ [dateField]: -1, _id: -1 }).skip(skip).limit(limit).lean(), model.countDocuments(query)]); res.json({ success: true, count: data.length, total, page, limit, totalPages: Math.ceil(total / limit), data }); } catch (error) { console.error(error); res.status(500).json({ success: false, message: "Failed to fetch data" }); } }
export const listPullRequests = (req, res) => listModel(req, res, PullRequest, "createdAtGithub", (q) => { const value = filter(q, "createdAtGithub"); if (q.merged === "true") value.merged = true; if (q.prNumber) value.prNumber = Number(q.prNumber); return value; });
export const listCommits = (req, res) => listModel(req, res, Commit, "committedAt", (q) => { const value = {}; const repo = q.repository || q.repositoryFullName || q.repo; if (repo) value.repositoryFullName = repo; if (q.sha) value.sha = q.sha; if (q.githubUserId) value["author.githubId"] = Number(q.githubUserId); if (q.author || q.username) value["author.login"] = q.author || q.username; return { ...value, ...range(q, "committedAt") }; });
export const listReviews = (req, res) => listModel(req, res, Review, "submittedAt", (q) => { const value = {}; const repo = q.repository || q.repositoryFullName || q.repo; if (repo) value.repositoryFullName = repo; if (q.githubUserId) value["reviewer.githubId"] = Number(q.githubUserId); if (q.username || q.author) value["reviewer.username"] = q.username || q.author; if (q.prNumber) value.prNumber = Number(q.prNumber); if (q.state) value.state = q.state; return { ...value, ...range(q, "submittedAt") }; });
export const listReviewComments = (req, res) => listModel(req, res, ReviewComment, "createdAtGithub", (q) => ({ ...filter(q, "createdAtGithub"), ...(q.prNumber ? { prNumber: Number(q.prNumber) } : {}) }));
export const listIssues = (req, res) => listModel(req, res, Issue, "createdAtGithub");
export const listIssueComments = (req, res) => listModel(req, res, IssueComment, "createdAtGithub", (q) => ({ ...filter(q, "createdAtGithub") }));
export const listContributions = (req, res) => listModel(req, res, ContributionEvent, "occurredAt", (q) => { const value = {}; if (q.repository || q.repositoryFullName) value.repositoryFullName = q.repository || q.repositoryFullName; if (q.githubUserId) value.githubUserId = Number(q.githubUserId); if (q.type) value.eventType = q.type; if (q.action) value.action = q.action; return { ...value, ...range(q, "occurredAt") }; });

export async function getById(req, res, model, field) {
  try {
    const raw = req.params.id;
    const value = field === "sha" || Number.isNaN(Number(raw)) ? raw : Number(raw);
    const query = { [field]: value };
    // same commit can exist in several repos -> allow ?repo=owner/name
    if (req.query.repo && model.schema.path("repositoryFullName")) query.repositoryFullName = req.query.repo;
    const record = await model.findOne(query).lean();
    if (!record) return res.status(404).json({ success: false, message: "Record not found" });
    return res.json({ success: true, data: record });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch record" });
  }
}
export const getPRLabels = (req, res) => listModel(req, res, PullRequest, "updatedAtGithub", (q) => ({ githubPRId: Number(req.params.id) }), { githubPayload: 0 });
export const getPRLabelEvents = (req, res) => listModel(req, res, PRLabelEvent, "occurredAt", () => ({ githubPRId: Number(req.params.id) }));
export const getPRReviews = (req, res) => listModel(req, res, Review, "submittedAt", () => ({ githubPRId: Number(req.params.id) }));
export const getPRReviewComments = (req, res) => listModel(req, res, ReviewComment, "createdAtGithub", () => ({ githubPRId: Number(req.params.id) }));

export async function getRepositoryMembers(req, res) { return listModel(req, res, RepositoryMember, "syncedAt", () => ({ repositoryId: Number(req.params.id) })); }
export async function getRepositoryLabels(req, res) {
  try {
    const data = await PullRequest.aggregate([
      { $match: { repositoryId: Number(req.params.id) } },
      { $unwind: "$labels" },
      { $group: { _id: "$labels.name", id: { $first: "$labels.id" }, color: { $first: "$labels.color" }, description: { $first: "$labels.description" } } },
      { $project: { _id: 0, name: "$_id", id: 1, color: 1, description: 1 } },
      { $sort: { name: 1 } },
    ]);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch labels" });
  }
}

export async function getUser(req, res) { const record = await User.findOne({ githubId: Number(req.params.githubId) }).lean(); return record ? res.json({ success: true, data: record }) : res.status(404).json({ success: false, message: "User not found" }); }
export const userContributions = (req, res) => listModel(req, res, ContributionEvent, "occurredAt", () => ({ githubUserId: Number(req.params.githubId) }));
export const userPullRequests = (req, res) => listModel(req, res, PullRequest, "createdAtGithub", () => ({ "author.githubId": Number(req.params.githubId) }), { githubPayload: 0 });
export const userReviews = (req, res) => listModel(req, res, Review, "submittedAt", () => ({ "reviewer.githubId": Number(req.params.githubId) }));
export async function userComments(req, res) {
	try {
		const { page, limit, skip } = pageArgs(req.query);
		const query = { "author.githubId": Number(req.params.githubId) };
		const [reviewComments, issueComments] = await Promise.all([
			ReviewComment.find(query).lean(),
			IssueComment.find(query).lean(),
		]);
		const data = [...reviewComments.map((item) => ({ ...item, commentType: "review" })), ...issueComments.map((item) => ({ ...item, commentType: "issue" }))]
			.sort((left, right) => new Date(right.createdAtGithub) - new Date(left.createdAtGithub))
			.slice(skip, skip + limit);
		const total = reviewComments.length + issueComments.length;
		return res.json({ success: true, count: data.length, total, page, limit, totalPages: Math.ceil(total / limit), data });
	} catch {
		return res.status(500).json({ success: false, message: "Failed to fetch user comments" });
	}
}
export const userCommits = (req, res) => listModel(req, res, Commit, "committedAt", () => ({ "author.githubId": Number(req.params.githubId) }));
export async function userRepositories(req, res) {
  try {
    const id = Number(req.params.githubId);
    const [a, b, c] = await Promise.all([
      PullRequest.distinct("repositoryId", { "author.githubId": id }),
      Review.distinct("repositoryId", { "reviewer.githubId": id }),
      Commit.distinct("repositoryId", { "author.githubId": id }),
    ]);
    const ids = [...new Set([...a, ...b, ...c].filter(Boolean))];
    const data = await Repository.find({ githubId: { $in: ids } }).sort({ fullName: 1 }).lean();
    return res.json({ success: true, count: data.length, total: data.length, page: 1, limit: data.length, totalPages: 1, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch user repositories" });
  }
}
export const userActivity = userContributions;
