"use client";

import { useEffect, useState } from "react";
import API from "../lib/api";
import { connectSocket } from "../lib/socket";

export default function Home() {
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [conversationId, setConversationId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // 🔐 Login Automatically (Test User)
  useEffect(() => {
    const login = async () => {
      const res = await API.post("/auth/login", {
        email: "test1@mail.com",
        password: "123456",
      });

      const jwtToken = res.data.token;
      setToken(jwtToken);

      const s = connectSocket(jwtToken);

      s.on("connect", () => {
        console.log("✅ Socket Connected:", s.id);
      });

      s.on("newMessage", (data) => {
        console.log("📩 New Message:", data);
        setMessages((prev) => [...prev, data]);
      });

      s.on("messageDelivered", (data) => {
        console.log("📦 Delivered:", data);
      });

      s.on("missedMessages", (data) => {
        console.log("🔄 Missed Messages:", data);
        setMessages((prev) => [...prev, ...data]);
      });

      setSocket(s);
    };

    login();
  }, []);

  // 📥 Join Conversation
  const joinConversation = () => {
    if (!socket) return;
    socket.emit("joinConversation", conversationId);
    console.log("Joined:", conversationId);
  };

  // 📤 Send Message
  const sendMessage = async () => {
    if (!conversationId) return alert("Enter conversation ID");

    const res = await API.post("/messages", {
      conversationId,
      content: message,
    });

    setMessage("");
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Connect - Socket Test</h2>

      <div>
        <input
          placeholder="Conversation ID"
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
        />
        <button onClick={joinConversation}>Join</button>
      </div>

      <br />

      <div>
        <input
          placeholder="Type message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

      <br />

      <h3>Messages</h3>
      {messages.map((msg, index) => (
        <div key={index}>
          <strong>{msg.senderId}</strong>: {msg.content}
        </div>
      ))}
    </div>
  );
}