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

    // Update conversation lastMessage
    conversation.lastMessage = content;
    await conversation.save();

    const io = getIO();

    console.log("Sender:", senderId.toString());
  console.log("Participants:", conversation.participants.map(p => p.toString()));

    if (!conversation.participants.includes(senderId)) {
        res.status(403);
        throw new Error("Unauthorized access to conversation");
        }

    // Emit to conversation room
    io.to(conversationId).emit("newMessage", message);

    // 🔥 Delivery Status
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

          io.to(conversationId).emit("messageDelivered", {
            messageId: message._id,
            userId: participantId,
          });
        }
      }
    });

    res.status(201).json(message);

  } catch (err) {
    next(err);
  }
};

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json(messages.reverse());
});