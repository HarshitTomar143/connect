import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } })
    .select("_id email displayName nickname avatar isOnline lastSeen")
    .sort({ displayName: 1 });
  res.json(users);
});

