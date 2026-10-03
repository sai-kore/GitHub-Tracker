import mongoose from "mongoose";

const user = { githubId: Number, username: String, name: String, avatarUrl: String, profileUrl: String };
const label = { id: Number, name: String, color: String, description: String };
const schema = new mongoose.Schema({
  githubIssueId: { type: Number, required: true, unique: true, index: true }, repositoryId: Number, repositoryFullName: { type: String, index: true }, issueNumber: Number,
  author: user, title: String, body: String, state: String, createdAtGithub: Date, updatedAtGithub: Date, closedAt: Date,
  labels: [label], assignees: [user], milestone: mongoose.Schema.Types.Mixed, htmlUrl: String, action: String, webhookDeliveryId: String,
}, { timestamps: true });
schema.index({ "author.githubId": 1, createdAtGithub: -1 });
export default mongoose.model("Issue", schema);
