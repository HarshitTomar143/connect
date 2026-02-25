import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },

    // Delivery tracking
    deliveredTo: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deliveredAt: Date,
      },
    ],

    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: Date,
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);