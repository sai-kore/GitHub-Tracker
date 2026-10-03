import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true }, eventType: String, action: String, githubUserId: { type: Number, index: true }, username: String,
  repositoryId: { type: Number, index: true }, repositoryFullName: String, sourceId: { type: mongoose.Schema.Types.Mixed, index: true }, githubPRId: Number, prNumber: Number,
  githubReviewId: Number, githubCommentId: Number, githubIssueId: Number, issueNumber: Number, commitSha: String, labels: [String], occurredAt: { type: Date, index: true }, webhookDeliveryId: String,
}, { timestamps: true });
schema.index({ repositoryId: 1, occurredAt: -1 });
export default mongoose.model("ContributionEvent", schema);
