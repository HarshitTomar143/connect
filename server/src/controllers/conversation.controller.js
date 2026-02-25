import Conversation from "../models/Conversation.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!participantId) {
    res.status(400);
    throw new Error("Participant ID required");
  }

  // Prevent duplicate conversations
  const existing = await Conversation.findOne({
    participants: { $all: [userId, participantId] },
  });

  if (existing) {
    return res.json(existing);
  }

  const conversation = await Conversation.create({
    participants: [userId, participantId],
  });

  res.status(201).json(conversation);
});

export const getUserConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const conversations = await Conversation.find({
    participants: userId,
  })
    .populate("participants", "displayName email isOnline lastSeen")
    .sort({ updatedAt: -1 });

  res.json(conversations);
});