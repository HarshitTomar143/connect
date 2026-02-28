import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { handlePresence } from "./presence.js";

const onlineUsers = new Map();

const socketHandler = (io) => {

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

  
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    const user = await User.findById(userId);
    await handlePresence(userId, true);
    
  
    io.emit("presence", {
      userId,
      isOnline: true,
      lastSeen: user?.showLastSeen ? new Date() : null,
      location: user?.shareLocation ? user?.location : null,
      showLastSeen: user?.showLastSeen,
      shareLocation: user?.shareLocation,
    });

    
    socket.join(userId);

  
    try {
      const convs = await Conversation.find({ participants: userId }).select("_id");
      convs.forEach((c) => socket.join(c._id.toString()));
    } catch (err) {
      console.error("Failed to join conversation rooms on connect", err);
    }

  
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

    
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId.toString());
    });

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

        
        conversation.lastMessage = content;
        await conversation.save();

      
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

    
    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId.toString()).emit("typing", { userId, conversationId });
    });

    
    socket.on("updateSettings", async (data) => {
      try {
        const { shareLocation, showLastSeen, location } = data;
        const updates = {};
        
        if (typeof shareLocation === "boolean") updates.shareLocation = shareLocation;
        if (typeof showLastSeen === "boolean") updates.showLastSeen = showLastSeen;
        if (shareLocation && location) updates.location = location;
        
        
        const user = await User.findByIdAndUpdate(userId, updates, { new: true });
        
      
        io.emit("userSettingsUpdated", {
          userId,
          showLastSeen: user?.showLastSeen,
          shareLocation: user?.shareLocation,
          location: user?.shareLocation ? user?.location : null,
          lastSeen: user?.showLastSeen ? new Date() : null,
        });
      } catch (err) {
        console.error("Settings update error:", err);
        socket.emit("settingsError", { error: err.message });
      }
    });

    
    socket.on("markAsRead", async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const reader = await User.findById(userId).select("readReceiptsEnabled");
        const sender = await User.findById(message.senderId).select("readReceiptsEnabled");
        
        
        if (!sender?.readReceiptsEnabled) {
          return;
        }

        
        const alreadyRead = message.readBy?.some((r) => r.userId.toString() === userId);
        if (!alreadyRead) {
          await Message.updateOne(
            { _id: messageId },
            {
              $push: {
                readBy: {
                  userId,
                  readAt: new Date(),
                },
              },
            }
          );
        }

      
        io.to(message.senderId.toString()).emit("messageRead", {
          messageId: messageId.toString(),
          userId: userId.toString(),
        });
      } catch (err) {
        console.error("Mark as read error:", err);
      }
    });

    
    socket.on("disconnect", async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const user = await User.findById(userId);
          await handlePresence(userId, false);
          
          
          io.emit("presence", {
            userId,
            isOnline: false,
            lastSeen: user?.showLastSeen ? new Date() : null,
            showLastSeen: user?.showLastSeen,
            shareLocation: user?.shareLocation,
          });
        }
      }
    });
  });
};

export default socketHandler;
