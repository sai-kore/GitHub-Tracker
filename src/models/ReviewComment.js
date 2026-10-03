import mongoose from "mongoose";

const user = { githubId: Number, username: String, name: String, avatarUrl: String, profileUrl: String };
const schema = new mongoose.Schema({
  githubCommentId: { type: Number, required: true, unique: true, index: true }, repositoryId: Number, repositoryFullName: { type: String, index: true },
  githubPRId: { type: Number, index: true }, prNumber: Number, author: user, body: String, path: String, line: Number, side: String,
  commitId: String, createdAtGithub: Date, updatedAtGithub: Date, htmlUrl: String, action: String, webhookDeliveryId: String,
}, { timestamps: true });
schema.index({ "author.githubId": 1, createdAtGithub: -1 });
export default mongoose.model("ReviewComment", schema);
