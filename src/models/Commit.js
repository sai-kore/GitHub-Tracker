import mongoose from "mongoose";

const commitSchema = new mongoose.Schema(
  {
    sha: { type: String, required: true },
    repositoryFullName: { type: String, required: true },
    repositoryId: Number,

    message: String,
    url: String,
    parents: mongoose.Schema.Types.Mixed,
    distinct: Boolean,
    isMergeCommit: Boolean,
    pullRequestNumber: Number,

    author: {
      login: String,
      githubId: Number,
      name: String,
      email: String,
      avatarUrl: String,
    },

    committer: {
      login: String,
      githubId: Number,
      name: String,
      email: String,
    },

    authoredAt: Date,
    committedAt: Date,
  },
  { timestamps: true }
);

commitSchema.index({ repositoryFullName: 1, sha: 1 }, { unique: true });
commitSchema.index({ "author.login": 1, committedAt: -1 });
commitSchema.index({ repositoryFullName: 1, committedAt: -1 });
commitSchema.index({ "author.githubId": 1, committedAt: -1 });

export default mongoose.model("Commit", commitSchema);
