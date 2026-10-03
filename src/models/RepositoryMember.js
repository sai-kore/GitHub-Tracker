import mongoose from "mongoose";

const schema = new mongoose.Schema({
  repositoryId: { type: Number, required: true },
  repositoryFullName: String,
  githubId: { type: Number, required: true },
  username: String,
  roleName: String,
  permission: String,
  isRepositoryOwner: Boolean,
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ repositoryId: 1, githubId: 1 }, { unique: true });
schema.index({ githubId: 1, repositoryId: 1 });
export default mongoose.model("RepositoryMember", schema);
