"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import API from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import type { Socket } from "socket.io-client";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, token } = (useAuth() as unknown) as {
    user: { _id?: string; email?: string } | null;
    loading: boolean;
    token: string | null;
  };
  type UserItem = {
    _id: string;
    email?: string;
    displayName?: string;
    nickname?: string;
    avatar?: string;
    isOnline?: boolean;
  };
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ senderId: string; content: string; createdAt?: string }>>([]);
  const [text, setText] = useState("");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    const run = async () => {
      const res = await API.get("/users");
      const list: UserItem[] = res.data || [];
      const meId = user?._id ? String(user._id) : "";
      const meEmail = (user?.email || "").toLowerCase();
      setUsers(
        list.filter(
          (u) =>
            String(u._id) !== meId &&
            (typeof u.email === "undefined" ||
              String(u.email).toLowerCase() !== meEmail)
        )
      );
    };
    if (user) run();
  }, [user]);

  useEffect(() => {
    if (!token) return;
    if (socketRef.current) return;
    const s = (connectSocket(token) as unknown) as Socket;
    s.on("newMessage", (msg: unknown) => {
      const m = msg as { conversationId?: string; senderId?: string; content?: string };
      setMessages((prev) => {
        if (!conversationId) return prev;
        if (m.conversationId !== conversationId) return prev;
        return [...prev, m as { senderId: string; content: string; createdAt?: string }];
      });
    });
    s.on("presence", (payload: unknown) => {
      const p = payload as { userId?: string; isOnline?: boolean };
      if (!p?.userId) return;
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(p.userId) ? { ...u, isOnline: !!p.isOnline } : u
        )
      );
    });
    socketRef.current = s;
    return () => {
      try {
        s.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [token, conversationId]);

  const selectUser = async (uid: string) => {
    try {
      setSelectedUserId(uid);
      const res = await API.post("/conversations", { participantId: uid });
      const cid = res.data._id;
      setConversationId(cid);
      socketRef.current?.emit("joinConversation", cid);
      const msgs = await API.get(`/messages/${cid}`);
      setMessages(msgs.data);
    } catch (e: unknown) {
      const status =
        (e as { response?: { status?: number } })?.response?.status || 0;
      if (status === 401) {
        router.replace("/login");
      }
    }
  };

  const sendMessage = async () => {
    if (!conversationId || !text.trim()) return;
    await API.post("/messages", { conversationId, content: text.trim() });
    setText("");
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">Loading</div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh flex">
      <aside className="w-72 border-r border-gray-200 p-4 space-y-2">
        <div className="text-sm font-semibold mb-2">Users</div>
        <div className="space-y-1">
          {(users || [])
            .filter((u) => {
              const meId = String(user._id);
              const meEmail = String(user?.email || "").toLowerCase();
              return (
                String(u._id) !== meId &&
                (typeof u.email === "undefined" ||
                  String(u.email).toLowerCase() !== meEmail)
              );
            })
            .map((u) => (
            <button
              key={u._id}
              onClick={() => selectUser(u._id)}
              className={`w-full text-left px-3 py-2 rounded-md border ${
                selectedUserId === u._id ? "border-black" : "border-gray-200"
              } hover:bg-gray-50 flex items-center gap-3`}
            >
              {u.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar}
                  alt={(u.nickname || u.displayName || "User") + " avatar"}
                  className="h-6 w-6 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-medium border border-gray-200">
                  <span>👤</span>
                </div>
              )}
              <div className="flex-1 truncate flex items-center gap-2">
                <div className="truncate text-sm">
                  {u.nickname || u.displayName || "User"}
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${
                    u.isOnline ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <div className="h-14 border-b border-gray-200 px-4 flex items-center justify-between">
          <div className="text-sm font-semibold">
            {users.find((x) => x._id === selectedUserId)?.nickname ||
              users.find((x) => x._id === selectedUserId)?.displayName ||
              "Select a user"}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => {
            const mine = m.senderId === user._id;
            return (
              <div
                key={i}
                className={`max-w-[70%] px-3 py-2 rounded-lg border ${mine ? "ml-auto bg-black text-white border-black" : "bg-white border-gray-200"}`}
              >
                {m.content}
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <Input
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </main>
    </div>
  );
}
