import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    avatar: String,
    about: String,
    lastSeen: Date,
    isOnline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);