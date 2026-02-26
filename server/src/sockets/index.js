import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { handlePresence } from "./presence.js";

const onlineUsers = new Map(); 
// userId -> Set(socketIds)

const socketHandler = (io) => {

  // 🔐 Socket Authentication
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token && socket.handshake.headers?.cookie) {
        const cookieHeader = socket.handshake.headers.cookie;
        const parts = cookieHeader.split(";").map((c) => c.trim());
        for (const p of parts) {
          if (p.startsWith("token=")) {
            token = decodeURIComponent(p.slice("token=".length));
            break;
          }
        }
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // 🧠 Multi-device handling
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    await handlePresence(userId, true);
    io.emit("presence", { userId, isOnline: true });

    // Personal room (ALL devices join)
    socket.join(userId);

    // 🔄 Reconnection Sync
    socket.on("syncMessages", async ({ lastSyncTime }) => {
      try {
        const missedMessages = await Message.find({
          createdAt: { $gt: lastSyncTime },
          senderId: { $ne: userId },
        }).sort({ createdAt: 1 });

        socket.emit("missedMessages", missedMessages);
      } catch (err) {
        console.error("Sync error:", err);
      }
    });

    // Join conversation room
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId.toString());
    });

    // 📨 Send message via socket
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, content } = data;
        const senderId = userId;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          socket.emit("messageError", { error: "Conversation not found" });
          return;
        }

        if (!conversation.participants.some(p => p.toString() === senderId)) {
          socket.emit("messageError", { error: "Unauthorized access to conversation" });
          return;
        }

        const message = await Message.create({
          conversationId,
          senderId,
          content,
        });

        // Update conversation lastMessage
        conversation.lastMessage = content;
        await conversation.save();

        // Convert ObjectIds to strings for socket emission
        const messageData = {
          _id: message._id.toString(),
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          content: message.content,
          createdAt: message.createdAt,
          deliveredTo: message.deliveredTo || [],
          readBy: message.readBy || [],
        };

        // Emit to all participants in conversation (including sender)
        io.to(conversationId.toString()).emit("newMessage", messageData);

        // Mark as delivered for other participants
        conversation.participants.forEach(async (participantId) => {
          if (participantId.toString() !== senderId) {
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
      } catch (err) {
        console.error("Socket message error:", err);
        socket.emit("messageError", { error: err.message });
      }
    });

    // Typing
    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId.toString()).emit("typing", { userId, conversationId });
    });

    // Update Profile/Settings (Location/LastSeen)
    socket.on("updateSettings", async (data) => {
      // Broadcast settings change to all users so they can update their lists
      io.emit("userSettingsUpdated", { userId, ...data });
    });

    // Read Receipt
    socket.on("markAsRead", async ({ messageId }) => {
      const me = await User.findById(userId).select("readReceiptsEnabled");
      if (!me?.readReceiptsEnabled) {
        return; // user disabled read receipts
      }
      await Message.updateOne(
        { _id: messageId, "readBy.userId": { $ne: userId } },
        {
          $push: {
            readBy: {
              userId,
              readAt: new Date(),
            },
          },
        }
      );

      io.to(messageId).emit("messageRead", {
        messageId,
        userId,
      });
    });

    // Disconnect
    socket.on("disconnect", async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await handlePresence(userId, false);
          io.emit("presence", { userId, isOnline: false });
        }
      }
    });
  });
};

export default socketHandler;
