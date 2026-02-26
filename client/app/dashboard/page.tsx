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
    lastSeen?: string | null;
    location?: string | null;
  };
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ _id?: string; senderId: string; content: string; createdAt?: string; readBy?: Array<{ userId: string; readAt: string }> }>>([]);
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [typing, setTyping] = useState(false);
  const [settings, setSettings] = useState<{
    readReceiptsEnabled?: boolean;
    shareLocation?: boolean;
    showLastSeen?: boolean;
  }>({});
  const [recents, setRecents] = useState<
    Array<{
      _id: string;
      other: UserItem;
      lastMessage?: string;
      updatedAt?: string;
    }>
  >([]);
  const socketRef = useRef<Socket | null>(null);
  const geolocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Request geolocation on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          geolocationRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        },
        (error) => {
          console.log("Geolocation error:", error);
        }
      );
    }
  }, []);

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
      const s = await API.get("/settings");
      setSettings(s.data || {});
      const c = await API.get("/conversations");
      const raw: Array<{ _id: string; other: UserItem; lastMessage?: string; updatedAt?: string }> =
        c.data || [];
      // Keep only unique users in recents by 'other._id', most recent first
      const seen = new Set<string>();
      const unique: typeof raw = [];
      for (const item of raw.sort((a, b) => {
        const ta = new Date(a.updatedAt || 0).getTime();
        const tb = new Date(b.updatedAt || 0).getTime();
        return tb - ta;
      })) {
        const key = String(item.other._id);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }
      setRecents(unique);
    };
    if (user) run();
  }, [user]);

  useEffect(() => {
    if (!token) return;
    
    let s = socketRef.current;
    
    // Only create new connection if one doesn't exist
    if (!s) {
      s = (connectSocket(token) as unknown) as Socket;
      socketRef.current = s;
    }

    // Set up event listeners
    const handleConnect = () => {
      console.log("Socket connected");
      
      // Send current location if sharing is enabled
      if (settings.shareLocation && geolocationRef.current) {
        const { latitude, longitude } = geolocationRef.current;
        const locationData = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        socketRef.current?.emit("updateSettings", {
          shareLocation: true,
          location: locationData,
        });
      }
      
      if (conversationId) {
        s.emit("joinConversation", conversationId);
      }
      const last = [...messages].pop()?.createdAt || new Date(0).toISOString();
      s.emit("syncMessages", { lastSyncTime: last });
    };

    const handleNewMessage = (msg: unknown) => {
      const m = msg as {
        _id: string;
        conversationId?: string;
        senderId?: string;
        content?: string;
        createdAt?: string;
        readBy?: Array<{ userId: string; readAt: string }>;
      };
      setMessages((prev) => {
        if (!conversationId) return prev;
        if (String(m.conversationId) !== String(conversationId)) return prev;
        // Avoid duplicates if already added by sendMessage
        if (prev.find((old: any) => old._id === m._id)) return prev;
        return [
          ...prev,
          m as { senderId: string; content: string; createdAt?: string; _id?: string; readBy?: Array<{ userId: string; readAt: string }> },
        ];
      });
    };

    const handleMissedMessages = (items: unknown) => {
      const list = (items as Array<{ conversationId?: string; senderId: string; content: string; createdAt?: string; _id?: string }>) || [];
      setMessages((prev) => {
        if (!conversationId) return prev;
        const add = list.filter((m) => String(m.conversationId) === String(conversationId));
        if (!add.length) return prev;
        return [...prev, ...add];
      });
    };

    const handlePresence = (payload: unknown) => {
      const p = payload as {
        userId?: string;
        isOnline?: boolean;
        lastSeen?: string;
        location?: string;
        showLastSeen?: boolean;
        shareLocation?: boolean;
      };
      if (!p?.userId) return;
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(p.userId)
            ? {
                ...u,
                isOnline: !!p.isOnline,
                lastSeen: p.lastSeen || null,
                location: p.location || null,
              }
            : u
        )
      );
    };

    const handleUserSettingsUpdated = (payload: any) => {
      const { userId, lastSeen, location, showLastSeen, shareLocation, ...rest } = payload;
      setUsers((prev) =>
        prev.map((u) =>
          String(u._id) === String(userId)
            ? {
                ...u,
                lastSeen: lastSeen || u.lastSeen,
                location: location || u.location,
                ...rest,
              }
            : u
        )
      );
    };

    const handleTyping = ({ userId, conversationId: typingCid }: { userId?: string; conversationId?: string }) => {
      if (!selectedUserId || !userId || !conversationId) return;
      if (String(userId) !== String(selectedUserId)) return;
      if (String(typingCid) !== String(conversationId)) return;
      setTyping(true);
      // Clear typing indicator after 2 seconds of inactivity
      if ((window as any).typingTimeout) clearTimeout((window as any).typingTimeout);
      (window as any).typingTimeout = setTimeout(() => setTyping(false), 2000);
    };

    const handleMessageRead = ({ messageId, userId }: { messageId?: string; userId?: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId && !msg.readBy?.find((r) => r.userId === userId)
            ? {
                ...msg,
                readBy: [
                  ...(msg.readBy || []),
                  { userId: userId || "", readAt: new Date().toISOString() },
                ],
              }
            : msg
        )
      );
    };

    // Register all listeners
    s.on("connect", handleConnect);
    s.on("newMessage", handleNewMessage);
    s.on("missedMessages", handleMissedMessages);
    s.on("presence", handlePresence);
    s.on("userSettingsUpdated", handleUserSettingsUpdated);
    s.on("typing", handleTyping);
    s.on("messageRead", handleMessageRead);

    // Clean up listeners on unmount
    return () => {
      s.off("connect", handleConnect);
      s.off("newMessage", handleNewMessage);
      s.off("missedMessages", handleMissedMessages);
      s.off("presence", handlePresence);
      s.off("userSettingsUpdated", handleUserSettingsUpdated);
      s.off("typing", handleTyping);
      s.off("messageRead", handleMessageRead);
    };
  }, [token, conversationId, messages, selectedUserId]);

  const selectUser = async (uid: string) => {
    try {
      setSelectedUserId(uid);
      const res = await API.post("/conversations", { participantId: uid });
      const cid = res.data._id;
      setConversationId(cid);
      socketRef.current?.emit("joinConversation", cid);
      const msgs = await API.get(`/messages/${cid}`);
      setMessages(msgs.data);
      setRecents((prev) => {
        const idx = prev.findIndex((p) => String(p.other._id) === String(uid));
        if (idx > -1) {
          const copy = [...prev];
          const [item] = copy.splice(idx, 1);
          return [item, ...copy];
        }
        const userInfo =
          users.find((u) => String(u._id) === String(uid)) ||
          ({ _id: uid } as UserItem);
        return [
          { _id: cid, other: userInfo, updatedAt: new Date().toISOString() },
          ...prev,
        ];
      });
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
    try {
      // Send message via socket for instant delivery
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("sendMessage", {
          conversationId,
          content: text.trim(),
        });
      } else {
        // Fallback to REST API if socket is not connected
        const res = await API.post("/messages", {
          conversationId,
          content: text.trim(),
        });
        const msg = res.data as {
          _id: string;
          senderId: string;
          content: string;
          createdAt?: string;
          conversationId: string;
        };
        // Optimistically add message if it's for current conversation
        setMessages((prev) => {
          if (prev.find((m: any) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      setText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, selectedUserId]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (!conversationId || !user || !messages.length || settings.readReceiptsEnabled === false) return;

    const unreadMessages = messages.filter(
      (m) => m.senderId !== user._id && !m.readBy?.some((r) => r.userId === user._id)
    );

    unreadMessages.forEach((m) => {
      if (m._id && socketRef.current?.connected) {
        socketRef.current?.emit("markAsRead", { messageId: m._id });
      }
    });
  }, [messages, conversationId, user, settings.readReceiptsEnabled]);

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
              <div className="flex-1 truncate flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm">
                    {u.nickname || u.displayName || "User"}
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      u.isOnline ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
                {u.lastSeen && (
                  <div className="text-xs text-gray-400 truncate">
                    {new Date(u.lastSeen).toLocaleString()}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            <div className="h-14 border-b border-gray-200 px-4 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-semibold">
                  {(users.find((x) => x._id === selectedUserId)?.nickname ||
                    users.find((x) => x._id === selectedUserId)?.displayName) ??
                    recents.find((r) => r.other._id === selectedUserId)?.other
                      ?.nickname ??
                    recents.find((r) => r.other._id === selectedUserId)?.other
                      ?.displayName ??
                    "Chat"}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {(() => {
                    const info =
                      users.find((x) => x._id === selectedUserId) ||
                      recents.find((r) => r.other._id === selectedUserId)?.other;
                    const bits: string[] = [];
                    if (typing) bits.push("typing…");
                    if (info?.location) bits.push(info.location);
                    if (info?.lastSeen) {
                      const dt = new Date(info.lastSeen);
                      bits.push(`last seen ${dt.toLocaleString()}`);
                    }
                    return bits.join(" • ");
                  })()}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const mine = m.senderId === user._id;
                const isRead = m.readBy?.some((r) => r.userId === selectedUserId);
                return (
                  <div
                    key={m._id || Math.random()}
                    className={`max-w-[70%] px-3 py-2 rounded-lg border flex items-end gap-2 ${mine ? "ml-auto bg-black text-white border-black" : "bg-white border-gray-200"}`}
                  >
                    <span>{m.content}</span>
                    {mine && settings.readReceiptsEnabled && (
                      <span className={`text-xs ${isRead ? "text-blue-300" : "text-gray-300"}`}>
                        {isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <Input
                placeholder="Type a message"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (conversationId) {
                    socketRef.current?.emit("typing", { conversationId });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-sm font-semibold mb-3">Recent</div>
            <div className="space-y-2">
              {recents.map((c) => (
                <button
                  key={c._id}
                  onClick={() => selectUser(c.other._id)}
                  className="w-full text-left px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 flex items-center gap-3"
                >
                  {c.other.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.other.avatar}
                      alt={(c.other.nickname || c.other.displayName || "User") + " avatar"}
                      className="h-8 w-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[12px] font-medium border border-gray-200">
                      <span>👤</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.other.nickname || c.other.displayName || "User"}
                    </div>
                    {c.other.lastSeen && (
                      <div className="text-xs text-gray-400 truncate">
                        {new Date(c.other.lastSeen).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      c.other.isOnline ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </button>
              ))}
              {recents.length === 0 ? (
                <div className="text-xs text-gray-500">No recent chats</div>
              ) : null}
            </div>
          </div>
        )}
      </main>
      <aside className="w-72 border-l border-gray-200 p-4 space-y-4">
        <div className="text-sm font-semibold">Settings</div>
        <label className="flex items-center justify-between text-sm">
          <span>Read receipts</span>
          <input
            type="checkbox"
            checked={!!settings.readReceiptsEnabled}
            onChange={async (e) => {
              const next = e.target.checked;
              setSettings((s) => ({ ...s, readReceiptsEnabled: next }));
              await API.put("/settings", { readReceiptsEnabled: next });
            }}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>Share location</span>
          <input
            type="checkbox"
            checked={!!settings.shareLocation}
            onChange={async (e) => {
                const next = e.target.checked;
                setSettings((s) => ({ ...s, shareLocation: next }));
                await API.put("/settings", { shareLocation: next });
                
                // Get location if enabling share location
                let locationData = null;
                if (next && geolocationRef.current) {
                  const { latitude, longitude } = geolocationRef.current;
                  // Use coordinates as fallback, ideally would use reverse geocoding
                  locationData = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                }
                
                socketRef.current?.emit("updateSettings", {
                  shareLocation: next,
                  location: locationData,
                });
              }}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>Show last seen</span>
          <input
            type="checkbox"
            checked={!!settings.showLastSeen}
            onChange={async (e) => {
                const next = e.target.checked;
                setSettings((s) => ({ ...s, showLastSeen: next }));
                await API.put("/settings", { showLastSeen: next });
                socketRef.current?.emit("updateSettings", { showLastSeen: next });
                // Refresh list to reflect lastSeen hiding instantly
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
              }}
          />
        </label>
      </aside>
    </div>
  );
}
