import mongoose from "mongoose";

const user = { githubId: Number, username: String, name: String, avatarUrl: String, profileUrl: String };
const schema = new mongoose.Schema({
  githubReviewId: { type: Number, required: true, unique: true, index: true },
  repositoryId: Number, repositoryFullName: { type: String, index: true }, githubPRId: { type: Number, index: true }, prNumber: Number,
  reviewer: user, state: String, body: String, submittedAt: Date, updatedAt: Date, commitId: String, htmlUrl: String,
  action: String, webhookDeliveryId: String, authorRole: String, isMaintainer: Boolean,
}, { timestamps: true });
schema.index({ "reviewer.githubId": 1, submittedAt: -1 });
export default mongoose.model("Review", schema);
