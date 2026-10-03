import PullRequest from "../models/PullRequest.js";
import Review from "../models/Review.js";
import ReviewComment from "../models/ReviewComment.js";

import {
  getPullRequest,
  getPullRequestFiles,
  getPullRequestReviews,
  getPullRequestReviewComments,
} from "./githubService.js";


export async function syncPullRequest(
  owner,
  repo,
  pullNumber,
  extraData = {}
) {
  /*
   * Get complete PR.
   */
  const completePR = await getPullRequest(
    owner,
    repo,
    pullNumber
  );

  /*
   * Get files.
   */
  const files = await getPullRequestFiles(
    owner,
    repo,
    pullNumber
  );

  /*
   * Get reviews.
   */
  const reviews = await getPullRequestReviews(
    owner,
    repo,
    pullNumber
  );
  const reviewComments = await getPullRequestReviewComments(owner, repo, pullNumber);

  /*
   * Convert GitHub response
   * into our MongoDB structure.
   */
  const normalizedPR = {
    githubPRId: completePR.id,

    repositoryId:
      completePR.base.repo.id,

    repositoryFullName:
      completePR.base.repo.full_name,

    prNumber:
      completePR.number,

    title:
      completePR.title,

    body:
      completePR.body,

    url:
      completePR.html_url,

    state:
      completePR.state,

    draft:
      completePR.draft,

    author: {
      id:
        completePR.user?.id,

      githubId:
        completePR.user?.id,

      name:
        completePR.user?.name,

      username:
        completePR.user?.login,

      avatarUrl:
        completePR.user?.avatar_url,

      url:
        completePR.user?.html_url,

      profileUrl:
        completePR.user?.html_url,
    },

    sourceBranch:
      completePR.head.ref,

    targetBranch:
      completePR.base.ref,

    labels:
      completePR.labels?.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })) || [],

    additions:
      completePR.additions,

    deletions:
      completePR.deletions,

    changedFiles:
      completePR.changed_files,

    commits:
      completePR.commits,

    comments:
      completePR.comments,

    reviewComments:
      completePR.review_comments,

    mergedBy:
      completePR.merged_by ? {
        githubId: completePR.merged_by.id,
        username: completePR.merged_by.login,
        avatarUrl: completePR.merged_by.avatar_url,
        profileUrl: completePR.merged_by.html_url,
      } : null,

    currentLabels:
      completePR.labels?.map(label => ({ id: label.id, name: label.name, color: label.color, description: label.description })) || [],

    assignees:
      completePR.assignees?.map(a => a.login) || [],

    requestedReviewers:
      completePR.requested_reviewers?.map(r => r.login) || [],

    merged:
      completePR.merged,

    mergedAt:
      completePR.merged_at,

    mergeCommitSha:
      completePR.merge_commit_sha,

    closedAt:
      completePR.closed_at,

    createdAtGithub:
      completePR.created_at,

    updatedAtGithub:
      completePR.updated_at,

    githubPayload:
      completePR,

    files:
      files.map(file => ({
        sha: file.sha,
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      })),

    reviews:
      reviews.map(review => ({
        id: review.id,
        user: review.user?.login,
        state: review.state,
        submittedAt: review.submitted_at,
      })),

    ...extraData,
  };

  /*
   * Upsert means:
   *
   * PR doesn't exist → create
   *
   * PR exists → update
   */
  const savedPR =
    await PullRequest.findOneAndUpdate(
      {
        githubPRId: completePR.id,
      },
      normalizedPR,
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );

  // Snapshot labels at merge time once; never overwrite on later syncs.
  if (completePR.merged) {
    await PullRequest.updateOne(
      { githubPRId: completePR.id, labelsAtMerge: { $exists: false } },
      { $set: { labelsAtMerge: completePR.labels?.map(label => ({ id: label.id, name: label.name, color: label.color, description: label.description })) || [] } }
    );
  }

  await Promise.all(reviews.map((review) => Review.updateOne(
    { githubReviewId: review.id },
    { $set: { repositoryId: completePR.base.repo.id, repositoryFullName: completePR.base.repo.full_name, githubPRId: completePR.id, prNumber: completePR.number, reviewer: { githubId: review.user?.id, username: review.user?.login, name: review.user?.name, avatarUrl: review.user?.avatar_url, profileUrl: review.user?.html_url }, state: review.state, body: review.body, submittedAt: review.submitted_at, updatedAt: review.submitted_at, commitId: review.commit_id, htmlUrl: review.html_url } },
    { upsert: true },
  )));
  await Promise.all(reviewComments.map((comment) => ReviewComment.updateOne(
    { githubCommentId: comment.id },
    { $set: { repositoryId: completePR.base.repo.id, repositoryFullName: completePR.base.repo.full_name, githubPRId: completePR.id, prNumber: completePR.number, author: { githubId: comment.user?.id, username: comment.user?.login, name: comment.user?.name, avatarUrl: comment.user?.avatar_url, profileUrl: comment.user?.html_url }, body: comment.body, path: comment.path, line: comment.line, side: comment.side, commitId: comment.commit_id, createdAtGithub: comment.created_at, updatedAtGithub: comment.updated_at, htmlUrl: comment.html_url } },
    { upsert: true },
  )));

  return savedPR;
}