import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    eventType: String,

    action: String,

    repository: String,

    repositoryId: Number,

    repositoryFullName: String,

    status: {
      type: String,
      enum: [
        "received",
        "processed",
        "ignored",
        "failed",
      ],
      default: "received",
    },

    error: String,

    receivedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "WebhookEvent",
  webhookEventSchema
);