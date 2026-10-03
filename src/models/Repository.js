import mongoose from "mongoose";

const repositorySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, unique: true, index: true },
    githubId: { type: Number, index: true },
    githubRepositoryId: { type: Number, index: true },
    owner: String,
    ownerGithubId: Number,
    name: String,
    description: String,
    htmlUrl: String,
    private: Boolean,
    fork: Boolean,
    archived: Boolean,
    defaultBranch: String,
    language: String,
    stars: Number,
    trackingEnabled: { type: Boolean, default: true },
    lastSyncedAt: Date,

    // Sync bookkeeping
    lastPRSyncAt: Date,
    lastCommitSyncAt: Date,
    lastIssueSyncAt: Date,
    lastMembersSyncAt: Date,
    lastSyncStartedAt: Date,
    lastSyncFinishedAt: Date,
    lastSyncStatus: { type: String, enum: ["success", "ok", "partial", "failed"] },
    lastSyncError: { type: String, default: null },
    lastSyncStats: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.model("Repository", repositorySchema);
