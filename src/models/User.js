import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  githubId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, index: true },
  name: String,
  email: String,
  avatarUrl: String,
  profileUrl: String,
}, { timestamps: true });

export default mongoose.model("User", userSchema);
