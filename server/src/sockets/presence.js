import User from "../models/User.js";

export const handlePresence = async (userId, isOnline) => {
  await User.findByIdAndUpdate(userId, {
    isOnline,
    lastSeen: isOnline ? null : new Date(),
  });
};