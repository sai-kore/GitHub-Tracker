import mongoose from "mongoose";

const pullRequestSchema = new mongoose.Schema(
  {
    githubPRId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    repositoryId: {
      type: Number,
      required: true,
      index: true,
    },

    repositoryFullName: {
      type: String,
      required: true,
      index: true,
    },

    prNumber: {
      type: Number,
      required: true,
      index: true,
    },

    title: String,

    body: String,

    url: String,

    state: String,

    draft: Boolean,

    author: {
      id: Number,
      githubId: Number,
      username: String,
      name: String,
      avatarUrl: String,
      url: String,
      profileUrl: String,
    },

    sourceBranch: String,

    targetBranch: String,

    labels: [
      {
        id: Number,
        name: String,
        color: String,
        description: String,
      },
    ],
    currentLabels: mongoose.Schema.Types.Mixed,
    labelsAtMerge: mongoose.Schema.Types.Mixed,

    additions: Number,

    deletions: Number,

    changedFiles: Number,

    commits: Number,

    comments: Number,

    reviewComments: Number,

    mergedBy: mongoose.Schema.Types.Mixed,

    assignees: [String],

    requestedReviewers: [String],
    authorRole: String,
    isMaintainer: Boolean,

    merged: {
      type: Boolean,
      default: false,
    },

    mergedAt: Date,

    mergeCommitSha: String,

    closedAt: Date,

    createdAtGithub: Date,

    updatedAtGithub: Date,

    githubPayload: {
      type: mongoose.Schema.Types.Mixed,
    },

    files: [
      {
        sha: String,
        filename: String,
        status: String,
        additions: Number,
        deletions: Number,
        changes: Number,
      },
    ],

    reviews: [
      {
        id: Number,
        user: String,
        state: String,
        submittedAt: Date,
      },
    ],

    lastWebhookAction: String,

    lastWebhookDeliveryId: String,
  },
  {
    timestamps: true,
  }
);

pullRequestSchema.index(
  { repositoryFullName: 1, prNumber: 1 },
  { unique: true }
);
pullRequestSchema.index({ "author.username": 1, createdAtGithub: -1 });
pullRequestSchema.index({ repositoryFullName: 1, createdAtGithub: -1 });
pullRequestSchema.index({ "reviews.user": 1 });

export default mongoose.model(
  "PullRequest",
  pullRequestSchema
);