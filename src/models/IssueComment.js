import mongoose from "mongoose";

const schema = new mongoose.Schema({
  githubCommentId: { type: Number, required: true, unique: true, index: true }, repositoryId: Number, repositoryFullName: { type: String, index: true }, issueOrPrNumber: Number,
  author: { githubId: Number, username: String, name: String, avatarUrl: String, profileUrl: String }, body: String, createdAtGithub: Date, updatedAtGithub: Date,
  action: String, isPullRequest: Boolean, webhookDeliveryId: String,
}, { timestamps: true });
schema.index({ "author.githubId": 1, createdAtGithub: -1 });
export default mongoose.model("IssueComment", schema);
