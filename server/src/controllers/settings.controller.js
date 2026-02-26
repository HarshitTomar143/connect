import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const getSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "readReceiptsEnabled shareLocation showLastSeen"
  );
  res.json(user);
});

export const updateSettings = asyncHandler(async (req, res) => {
  const { readReceiptsEnabled, shareLocation, showLastSeen } = req.body;
  const updates = {};
  if (typeof readReceiptsEnabled === "boolean")
    updates.readReceiptsEnabled = readReceiptsEnabled;
  if (typeof shareLocation === "boolean") updates.shareLocation = shareLocation;
  if (typeof showLastSeen === "boolean") updates.showLastSeen = showLastSeen;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
    select: "readReceiptsEnabled shareLocation showLastSeen",
  });
  res.json(user);
});

