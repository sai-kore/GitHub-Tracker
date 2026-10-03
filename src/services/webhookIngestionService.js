import PullRequest from "../models/PullRequest.js";
import Review from "../models/Review.js";
import ReviewComment from "../models/ReviewComment.js";
import Issue from "../models/Issue.js";
import IssueComment from "../models/IssueComment.js";
import PRLabelEvent from "../models/PRLabelEvent.js";
import Commit from "../models/Commit.js";
import User from "../models/User.js";
import ContributionEvent from "../models/ContributionEvent.js";

const user = (value) => value && {
  githubId: value.id,
  username: value.login,
  name: value.name,
  email: value.email,
  avatarUrl: value.avatar_url,
  profileUrl: value.html_url,
};
const label = (value) => value && ({ id: value.id, name: value.name, color: value.color, description: value.description });
const repoInfo = (payload) => ({ repositoryId: payload.repository?.id, repositoryFullName: payload.repository?.full_name });

async function saveUser(value) {
  if (!value?.id) return;
  await User.updateOne({ githubId: value.id }, { $set: user(value) }, { upsert: true });
}

async function event({ eventType, action, sourceId, actor, payload, labels = [], occurredAt = new Date(), ids = {} }) {
  await ContributionEvent.updateOne(
    { eventId: `${eventType}:${sourceId}:${action || ""}:${payload.deliveryId || ""}` },
    { $setOnInsert: { eventId: `${eventType}:${sourceId}:${action || ""}:${payload.deliveryId || ""}`, eventType, action, sourceId, githubUserId: actor?.id, username: actor?.login, ...repoInfo(payload), labels, occurredAt, webhookDeliveryId: payload.deliveryId, ...ids } },
    { upsert: true },
  );
}

function prDocument(pr, payload, action, deliveryId) {
  return {
    githubPRId: pr.id, repositoryId: pr.base?.repo?.id || payload.repository?.id, repositoryFullName: pr.base?.repo?.full_name || payload.repository?.full_name,
    prNumber: pr.number, title: pr.title, body: pr.body, url: pr.html_url, state: pr.state, draft: pr.draft,
    author: { ...user(pr.user), id: pr.user?.id }, sourceBranch: pr.head?.ref, targetBranch: pr.base?.ref,
    labels: (pr.labels || []).map(label), currentLabels: (pr.labels || []).map(label), additions: pr.additions, deletions: pr.deletions,
    changedFiles: pr.changed_files, commits: pr.commits, comments: pr.comments, reviewComments: pr.review_comments,
    merged: pr.merged, mergedAt: pr.merged_at, closedAt: pr.closed_at, createdAtGithub: pr.created_at, updatedAtGithub: pr.updated_at,
    mergedBy: user(pr.merged_by), assignees: (pr.assignees || []).map((a) => a.login), requestedReviewers: (pr.requested_reviewers || []).map((r) => r.login),
    mergeCommitSha: pr.merge_commit_sha, lastWebhookAction: action, lastWebhookDeliveryId: deliveryId,
  };
}

export async function ingestGithubEvent(eventType, action, payload, deliveryId) {
  payload.deliveryId = deliveryId;
  const repository = repoInfo(payload);
  await saveUser(payload.sender);

  if (eventType === "pull_request") {
    const pr = payload.pull_request;
    await saveUser(pr?.user); await saveUser(pr?.merged_by);
    const document = prDocument(pr, payload, action, deliveryId);
    if (action === "closed" && pr.merged) document.labelsAtMerge = document.currentLabels;
    await PullRequest.updateOne({ githubPRId: pr.id }, { $set: document }, { upsert: true });
    if (["labeled", "unlabeled"].includes(action) && payload.label) {
      await PRLabelEvent.updateOne({ githubPRId: pr.id, webhookDeliveryId: deliveryId }, { $set: { ...repository, prNumber: pr.number, action, label: label(payload.label), occurredAt: new Date() } }, { upsert: true });
    }
    await event({ eventType, action, sourceId: pr.id, actor: payload.sender, payload, labels: (pr.labels || []).map((item) => item.name), occurredAt: pr.updated_at || new Date(), ids: { githubPRId: pr.id, prNumber: pr.number } });
    return;
  }

  if (eventType === "pull_request_review") {
    const review = payload.review; const pr = payload.pull_request;
    await saveUser(review?.user);
    await Review.updateOne({ githubReviewId: review.id }, { $set: { ...repository, githubPRId: pr?.id, prNumber: pr?.number, reviewer: user(review.user), state: review.state, body: review.body, submittedAt: review.submitted_at, updatedAt: review.updated_at, commitId: review.commit_id, htmlUrl: review.html_url, action, webhookDeliveryId: deliveryId } }, { upsert: true });
    await event({ eventType, action, sourceId: review.id, actor: review.user, payload, occurredAt: review.submitted_at || new Date(), ids: { githubReviewId: review.id, githubPRId: pr?.id, prNumber: pr?.number } });
    return;
  }

  if (eventType === "pull_request_review_comment") {
    const comment = payload.comment; const pr = payload.pull_request;
    await saveUser(comment?.user);
    await ReviewComment.updateOne({ githubCommentId: comment.id }, { $set: { ...repository, githubPRId: pr?.id, prNumber: pr?.number, author: user(comment.user), body: comment.body, path: comment.path, line: comment.line, side: comment.side, commitId: comment.commit_id, createdAtGithub: comment.created_at, updatedAtGithub: comment.updated_at, htmlUrl: comment.html_url, action, webhookDeliveryId: deliveryId } }, { upsert: true });
    await event({ eventType, action, sourceId: comment.id, actor: comment.user, payload, occurredAt: comment.created_at || new Date(), ids: { githubCommentId: comment.id, githubPRId: pr?.id, prNumber: pr?.number } });
    return;
  }

  if (eventType === "issues") {
    const issue = payload.issue;
    await saveUser(issue?.user);
    await Issue.updateOne({ githubIssueId: issue.id }, { $set: { ...repository, issueNumber: issue.number, author: user(issue.user), title: issue.title, body: issue.body, state: issue.state, createdAtGithub: issue.created_at, updatedAtGithub: issue.updated_at, closedAt: issue.closed_at, labels: (issue.labels || []).map(label), assignees: (issue.assignees || []).map(user), milestone: issue.milestone, htmlUrl: issue.html_url, action, webhookDeliveryId: deliveryId } }, { upsert: true });
    await event({ eventType, action, sourceId: issue.id, actor: issue.user, payload, labels: (issue.labels || []).map((item) => item.name), occurredAt: issue.updated_at || new Date(), ids: { githubIssueId: issue.id, issueNumber: issue.number } });
    return;
  }

  if (eventType === "issue_comment") {
    const comment = payload.comment; const issue = payload.issue;
    await saveUser(comment?.user);
    await IssueComment.updateOne({ githubCommentId: comment.id }, { $set: { ...repository, issueOrPrNumber: issue.number, author: user(comment.user), body: comment.body, createdAtGithub: comment.created_at, updatedAtGithub: comment.updated_at, action, isPullRequest: Boolean(issue.pull_request), webhookDeliveryId: deliveryId } }, { upsert: true });
    await event({ eventType, action, sourceId: comment.id, actor: comment.user, payload, occurredAt: comment.created_at || new Date(), ids: { githubCommentId: comment.id, githubIssueId: issue.id, issueNumber: issue.number } });
    return;
  }

  if (eventType === "push") {
    // Only default-branch commits, same as the polling sync (keeps data consistent)
    if (payload.ref !== `refs/heads/${payload.repository?.default_branch}`) return;
    for (const commit of payload.commits || []) {
      await saveUser(commit.author); await saveUser(commit.committer);
      const document = { sha: commit.id, repositoryFullName: repository.repositoryFullName, repositoryId: repository.repositoryId, message: commit.message, url: `${payload.repository?.html_url}/commit/${commit.id}`, author: { ...user(commit.author), login: commit.author?.username }, committer: { ...user(commit.committer), login: commit.committer?.username }, authoredAt: commit.timestamp, committedAt: commit.timestamp, distinct: commit.distinct };
      await Commit.updateOne({ repositoryFullName: repository.repositoryFullName, sha: commit.id }, { $set: document }, { upsert: true });
      await event({ eventType, action: "commit", sourceId: commit.id, actor: commit.author, payload, occurredAt: commit.timestamp || new Date(), ids: { commitSha: commit.id } });
    }
  }
}
