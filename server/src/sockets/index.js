import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
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
      socket.join(conversationId);
    });

    // Typing
    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId).emit("typing", { userId });
    });

    // Read Receipt
    socket.on("markAsRead", async ({ messageId }) => {
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
