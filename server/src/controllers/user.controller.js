import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } })
    .select("_id email displayName nickname avatar isOnline lastSeen showLastSeen shareLocation location")
    .sort({ displayName: 1 });
  const shaped = users.map((u) => ({
    _id: u._id,
    email: u.email,
    displayName: u.displayName,
    nickname: u.nickname,
    avatar: u.avatar,
    isOnline: u.isOnline,
    lastSeen: u.showLastSeen ? u.lastSeen : null,
    location: u.shareLocation ? u.location || null : null,
  }));
  res.json(shaped);
});
