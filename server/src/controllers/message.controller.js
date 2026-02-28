import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { getIO } from "../config/socket.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.user._id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content,
    });

  
    conversation.lastMessage = content;
    await conversation.save();

    const io = getIO();

    console.log("Sender:", senderId.toString());
  console.log("Participants:", conversation.participants.map(p => p.toString()));

    if (!conversation.participants.includes(senderId)) {
        res.status(403);
        throw new Error("Unauthorized access to conversation");
        }


    const messageData = {
      _id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      senderId: message.senderId.toString(),
      content: message.content,
      createdAt: message.createdAt,
      deliveredTo: message.deliveredTo || [],
      readBy: message.readBy || [],
    };

    io.to(conversationId.toString()).emit("newMessage", messageData);

    conversation.participants.forEach(async (participantId) => {
      if (participantId.toString() !== senderId.toString()) {
        const sockets = io.sockets.adapter.rooms.get(participantId.toString());

        if (sockets) {
          await Message.updateOne(
            { _id: message._id },
            {
              $push: {
                deliveredTo: {
                  userId: participantId,
                  deliveredAt: new Date(),
                },
              },
            }
          );

          io.to(conversationId.toString()).emit("messageDelivered", {
            messageId: message._id.toString(),
            userId: participantId.toString(),
          });
        }
      }
    });

    res.status(201).json(messageData);

  } catch (err) {
    next(err);
  }
};

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const total = await Message.countDocuments({ conversationId });
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }

 
  if (message.senderId.toString() !== userId.toString()) {
    return res.status(403).json({ message: "Unauthorized to delete this message" });
  }

  const conversationId = message.conversationId;


  await Message.findByIdAndDelete(messageId);

  const io = getIO();
  io.to(conversationId.toString()).emit("messageDeleted", {
    messageId: messageId.toString(),
    conversationId: conversationId.toString(),
  });

  res.json({ message: "Message deleted successfully" });
});