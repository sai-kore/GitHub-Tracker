import mongoose from "mongoose";

const schema = new mongoose.Schema({
  githubPRId: { type: Number, required: true, index: true }, repositoryId: Number, repositoryFullName: { type: String, index: true }, prNumber: Number,
  action: { type: String, enum: ["labeled", "unlabeled"] }, label: { id: Number, name: String, color: String, description: String },
  occurredAt: { type: Date, default: Date.now }, webhookDeliveryId: { type: String, required: true, index: true },
}, { timestamps: true });
schema.index({ githubPRId: 1, occurredAt: 1 });
export default mongoose.model("PRLabelEvent", schema);
