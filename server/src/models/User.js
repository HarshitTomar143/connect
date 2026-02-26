import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, index: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    nickname: String,
    avatar: String,
    about: String,
    lastSeen: Date,
    isOnline: { type: Boolean, default: false },
    readReceiptsEnabled: { type: Boolean, default: true },
    shareLocation: { type: Boolean, default: false },
    showLastSeen: { type: Boolean, default: true },
    location: String,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
