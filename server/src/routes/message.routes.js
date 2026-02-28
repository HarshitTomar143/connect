import express from "express";
import {
  sendMessage,
  getMessages,
  deleteMessage,
} from "../controllers/message.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:conversationId", protect, getMessages);
router.delete("/:messageId", protect, deleteMessage);

export default router;