import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getIO } from "../config/socket.js";

export const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = req.body;
  const userId = req.user._id;

  if (!participantId) {
    res.status(400);
    throw new Error("Participant ID required");
  }

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
    .populate(
      "participants",
      "displayName nickname email avatar isOnline lastSeen showLastSeen shareLocation location"
    )
    .sort({ updatedAt: -1 });

  
  const shaped = await Promise.all(
    conversations.map(async (c) => {
    
      const unreadCount = await Message.countDocuments({
        conversationId: c._id,
        senderId: { $ne: userId },
        "readBy.userId": { $ne: userId },
      });

      const parts = c.participants.map((p) => p.toObject());
      const other = parts.find((p) => String(p._id) !== String(userId)) || parts[0];
      const otherShaped = {
        _id: other._id,
        displayName: other.displayName,
        nickname: other.nickname,
        email: other.email,
        avatar: other.avatar,
        isOnline: other.isOnline,
        lastSeen: other.showLastSeen ? other.lastSeen : null,
        location: other.shareLocation ? other.location || null : null,
      };
      return {
        _id: c._id,
        other: otherShaped,
        lastMessage: c.lastMessage || "",
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        unreadCount,
      };
    })
  );

  res.json(shaped);
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    res.status(404);
    throw new Error("Conversation not found");
  }

  
  if (!conv.participants.map((p) => p.toString()).includes(userId.toString())) {
    res.status(403);
    throw new Error("Unauthorized");
  }


  await Message.deleteMany({ conversationId });
  await Conversation.findByIdAndDelete(conversationId);


  const io = getIO();
  io.to(conversationId.toString()).emit("conversationDeleted", { conversationId: conversationId.toString() });

  res.json({ message: "Conversation deleted" });
});
