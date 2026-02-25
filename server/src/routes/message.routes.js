import express from "express";
import {
  sendMessage,
  getMessages,
} from "../controllers/message.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:conversationId", protect, getMessages);

export default router;