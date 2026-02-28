"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import API from "../../lib/api";
import { connectSocket } from "../../lib/socket";
import { sanitizeContent } from "../../lib/sanitize";
import type { Socket } from "socket.io-client";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, token, logout } = (useAuth() as unknown) as {
    user: { _id?: string; email?: string; displayName?: string; nickname?: string; avatar?: string } | null;
    loading: boolean;
    token: string | null;
    logout: () => Promise<void>;
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
  const [usersSearch, setUsersSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ _id?: string; senderId: string; content: string; createdAt?: string; readBy?: Array<{ userId: string; readAt: string }> }>>([]);
  const [messagesPagination, setMessagesPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
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
      unreadCount?: number;
    }>
  >([]);
  const socketRef = useRef<Socket | null>(null);
  const geolocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // theme preference (must declare unconditionally before early returns)
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(() => {
    try {
      const saved = localStorage.getItem("theme");
      return (saved as any) || "auto";
    } catch (e) {
      return "auto";
    }
  });

  useEffect(() => {
    const apply = (t: string) => {
      const el = document.documentElement;
      el.classList.remove("theme-light", "theme-dark");
      if (t === "light") el.classList.add("theme-light");
      else if (t === "dark") el.classList.add("theme-dark");
      else {
        const isDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isDark) el.classList.add("theme-dark");
        else el.classList.add("theme-light");
      }
    };

    apply(theme);

    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "auto") apply("auto");
    };
    if (mq && mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq && mq.addListener) mq.addListener(onChange as any);

    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}

    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq && mq.removeListener) mq.removeListener(onChange as any);
    };
  }, [theme]);

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

  // helper to load recent conversations with unread counts
  const loadRecents = useCallback(async () => {
    try {
      const c = await API.get("/conversations");
      const raw: Array<{
        _id: string;
        other: UserItem;
        lastMessage?: string;
        updatedAt?: string;
        unreadCount?: number;
      }> = c.data || [];
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
    } catch (err) {
      console.error("Failed loading recents", err);
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
      await loadRecents();
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

      // if this message belongs to the current open conversation, append it
      if (conversationId && String(m.conversationId) === String(conversationId)) {
        setMessages((prev) => {
          if (prev.find((old: any) => old._id === m._id)) return prev;
          return [
            ...prev,
            m as { senderId: string; content: string; createdAt?: string; _id?: string; readBy?: Array<{ userId: string; readAt: string }> },
          ];
        });
        return;
      }

      // otherwise it's for another conversation – reload recents to update unread counts
      loadRecents();
    };

    const handleMissedMessages = (items: unknown) => {
      const list = (items as Array<{ conversationId?: string; senderId: string; content: string; createdAt?: string; _id?: string }>) || [];
      setMessages((prev) => {
        if (!conversationId) return prev;
        const add = list.filter((m) => String(m.conversationId) === String(conversationId));
        if (!add.length) return prev;
        return [...prev, ...add];
      });

      // any missed messages may change unread counts; refresh recents
      loadRecents();
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

    const handleMessageDeleted = ({ messageId }: { messageId?: string }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    };

    // Register all listeners
    s.on("connect", handleConnect);
    s.on("newMessage", handleNewMessage);
    s.on("missedMessages", handleMissedMessages);
    s.on("presence", handlePresence);
    s.on("userSettingsUpdated", handleUserSettingsUpdated);
    s.on("typing", handleTyping);
    s.on("messageRead", handleMessageRead);
    s.on("messageDeleted", handleMessageDeleted);

    // Clean up listeners on unmount
    return () => {
      s.off("connect", handleConnect);
      s.off("newMessage", handleNewMessage);
      s.off("missedMessages", handleMissedMessages);
      s.off("presence", handlePresence);
      s.off("userSettingsUpdated", handleUserSettingsUpdated);
      s.off("typing", handleTyping);
      s.off("messageRead", handleMessageRead);
      s.off("messageDeleted", handleMessageDeleted);
    };
  }, [token, conversationId, messages, selectedUserId, loadRecents]);

  const selectUser = async (uid: string) => {
    try {
      setSelectedUserId(uid);
      const res = await API.post("/conversations", { participantId: uid });
      const cid = res.data._id;
      setConversationId(cid);
      socketRef.current?.emit("joinConversation", cid);
      const msgs = await API.get(`/messages/${cid}?page=1&limit=20`);
      setMessages(msgs.data.messages || msgs.data);
      setMessagesPagination(msgs.data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
      setRecents((prev) => {
        const idx = prev.findIndex((p) => String(p.other._id) === String(uid));
        if (idx > -1) {
          const copy = [...prev];
          let [item] = copy.splice(idx, 1);
          // clear unread count when opening conversation
          item = { ...item, unreadCount: 0 };
          return [item, ...copy];
        }
        const userInfo =
          users.find((u) => String(u._id) === String(uid)) ||
          ({ _id: uid } as UserItem);
        return [
          { _id: cid, other: userInfo, updatedAt: new Date().toISOString(), unreadCount: 0 },
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

  const loadMoreMessages = async () => {
    if (!conversationId || loadingMoreMessages || messagesPagination.page >= messagesPagination.pages) return;
    try {
      setLoadingMoreMessages(true);
      const nextPage = messagesPagination.page + 1;
      const msgs = await API.get(`/messages/${conversationId}?page=${nextPage}&limit=20`);
      setMessages((prev) => [
        ...(msgs.data.messages || msgs.data),
        ...prev,
      ]);
      setMessagesPagination(msgs.data.pagination || messagesPagination);
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setLoadingMoreMessages(false);
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

    // also clear unread badge for this conversation in recents
    setRecents((prev) =>
      prev.map((c) =>
        c._id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, [messages, conversationId, user, settings.readReceiptsEnabled]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">Loading</div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-11 flex items-center justify-between px-2 app-surface border-b border-transparent" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg font-bold">💬 Connect</span>
        </div>
        <div className="flex items-center gap-1">
          {/* theme selector: light / auto / dark */}
          <div className="flex items-center rounded-lg p-0.5 gap-0.5 bg-[var(--surface)]" role="tablist" aria-label="Theme">
            <button
              onClick={() => setTheme("light")}
              role="tab"
              aria-selected={theme === "light"}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${theme === "light" ? "bg-white text-[var(--text)] font-semibold shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("auto")}
              role="tab"
              aria-selected={theme === "auto"}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${theme === "auto" ? "bg-white text-[var(--text)] font-semibold shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
            >
              Auto
            </button>
            <button
              onClick={() => setTheme("dark")}
              role="tab"
              aria-selected={theme === "dark"}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${theme === "dark" ? "bg-white text-[var(--text)] font-semibold shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
            >
              Dark
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-1" style={{ background: 'var(--bg)' }}>
        <aside className="w-72 border-r border-transparent flex flex-col app-surface">
        {/* header/search section */}
        <div className="p-4 flex-shrink-0 sticky top-0 z-10" style={{ background: 'var(--surface)' }}>
          {/* profile display */}
          <div className="flex items-center gap-2 mb-4">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt="Your avatar"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
                👤
              </div>
            )}
            <span className="font-medium text-sm truncate">
              {user?.nickname || user?.displayName || user?.email}
            </span>
          </div>
          <div className="text-sm font-semibold mb-2">Users</div>
            <Input
            placeholder="Search users..."
            value={usersSearch}
            onChange={(e) => setUsersSearch(e.target.value)}
            className="mb-2"
          />
        </div>
        {/* scrollable user list */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {(users || [])
            .filter((u) => {
              const meId = String(user._id);
              const meEmail = String(user?.email || "").toLowerCase();
              const searchLower = usersSearch.toLowerCase();
              const matches =
                !searchLower ||
                u.displayName?.toLowerCase().includes(searchLower) ||
                u.nickname?.toLowerCase().includes(searchLower) ||
                u.email?.toLowerCase().includes(searchLower);
              return (
                String(u._id) !== meId &&
                (typeof u.email === "undefined" ||
                  String(u.email).toLowerCase() !== meEmail) &&
                matches
              );
            })
            .map((u) => (
            <button
              key={u._id}
              onClick={() => selectUser(u._id)}
              className={`w-full text-left px-3 py-2 rounded-md border flex items-center gap-3 ${selectedUserId === u._id ? "border-[var(--accent)]" : "border-[rgba(15,23,42,0.06)]"}`}
            >
              {u.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar}
                  alt={(u.nickname || u.displayName || "User") + " avatar"}
                  className="h-6 w-6 rounded-full object-cover"
                  style={{ border: '1px solid rgba(15,23,42,0.06)' }}
                />
              ) : (
                <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium" style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <span>👤</span>
                </div>
              )}
              <div className="flex-1 truncate flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm">
                    {u.nickname || u.displayName || "User"}
                  </div>
                  <span className={`h-2 w-2 rounded-full ${u.isOnline ? "bg-[var(--accent)]" : "bg-[rgba(15,23,42,0.06)]"}`} />
                </div>
                {u.isOnline ? (
                  <div className="text-xs text-[var(--accent)] truncate">Online</div>
                ) : u.lastSeen ? (
                  <div className="text-xs text-[var(--muted)] truncate">
                    {new Date(u.lastSeen).toLocaleString()}
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            <div className="h-14 border-b px-4 flex items-center justify-between" style={{ borderColor: 'rgba(15,23,42,0.06)', background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
              <div>
                <div className="font-semibold">
                  {(users.find((x) => x._id === selectedUserId)?.nickname ||
                    users.find((x) => x._id === selectedUserId)?.displayName) ??
                    recents.find((r) => r.other._id === selectedUserId)?.other
                      ?.nickname ??
                    recents.find((r) => r.other._id === selectedUserId)?.other
                      ?.displayName ??
                    "Chat"}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {(() => {
                    const info =
                      users.find((x) => x._id === selectedUserId) ||
                      recents.find((r) => r.other._id === selectedUserId)?.other;
                    const bits: string[] = [];
                    if (typing) bits.push("typing…");
                    if (info?.isOnline) {
                      bits.push("Online");
                    } else if (info?.lastSeen) {
                      const dt = new Date(info.lastSeen);
                      bits.push(`last seen ${dt.toLocaleString()}`);
                    }
                    if (info?.location) bits.push(info.location);
                    return bits.join(" • ");
                  })()}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-y-contain" style={{ background: 'transparent' }}>
              {messagesPagination.pages > 1 && messagesPagination.page < messagesPagination.pages && (
                <div className="flex justify-center">
                  <Button
                    onClick={loadMoreMessages}
                    disabled={loadingMoreMessages}
                    className="text-xs px-3 py-1 rounded-md bg-[var(--surface)] text-[var(--text)] hover:brightness-105"
                  >
                    {loadingMoreMessages ? "Loading..." : "Load Earlier Messages"}
                  </Button>
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user._id;
                const isRead = m.readBy?.some((r) => r.userId === selectedUserId);
                const messageTime = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div
                    key={m._id || Math.random()}
                    className="group flex items-end gap-2"
                    style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}
                  >
                    <div
                      className={`max-w-[70%] px-3 py-2 flex flex-col gap-1 break-words whitespace-pre-wrap shadow-sm border ${mine ? "ml-auto bg-[var(--accent)] text-white border-transparent rounded-tl-xl rounded-br-xl" : "bg-[var(--surface)] text-[var(--text)] border-[rgba(15,23,42,0.06)] rounded-tr-xl rounded-bl-xl"}`}
                    >
                      <span>{sanitizeContent(m.content)}</span>
                      <div className={`flex items-center gap-2 text-xs ${mine ? "text-[rgba(255,255,255,0.8)]" : "text-[var(--muted)]"}`}>
                        <span>{messageTime}</span>
                        {mine && settings.readReceiptsEnabled && (
                          <span className={isRead ? "text-blue-300" : "text-gray-300"}>
                            {isRead ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                    {mine && (
                      <button
                        onClick={async () => {
                          try {
                            await API.delete(`/messages/${m._id}`);
                            setMessages((prev) => prev.filter((msg) => msg._id !== m._id));
                          } catch (err) {
                            console.error("Failed to delete message:", err);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded flex-shrink-0"
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <Input
                placeholder="Type a message"
                className="text-sm md:text-base"
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
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={sendMessage}>Send</Button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 overscroll-y-contain" style={{ background: 'transparent' }}>
            <div className="text-sm font-semibold mb-3">Recent</div>
            <div className="space-y-2">
              {recents.map((c) => {
                const unread = c.unreadCount || 0;
                const badgeText =
                  unread === 1
                    ? "new"
                    : unread > 3
                    ? "4+"
                    : unread > 0
                    ? `${unread}`
                    : null;
                const timeLabel = c.updatedAt
                  ? new Date(c.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                return (
                  <button
                    key={c._id}
                    onClick={() => selectUser(c.other._id)}
                    className="w-full text-left px-3 py-2 rounded-md border flex items-center gap-3" style={{ border: '1px solid rgba(15,23,42,0.06)' }}
                  >
                    {c.other.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.other.avatar}
                        alt={(c.other.nickname || c.other.displayName || "User") + " avatar"}
                        className="h-8 w-8 rounded-full object-cover"
                        style={{ border: '1px solid rgba(15,23,42,0.06)' }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-medium" style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <span>👤</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="truncate text-sm font-medium">
                          {c.other.nickname || c.other.displayName || "User"}
                        </span>
                        {timeLabel && (
                          <span className="text-xs text-[var(--muted)] ml-2">
                            {timeLabel}
                          </span>
                        )}
                      </div>
                      {c.lastMessage && (
                        <div className="text-xs text-[var(--muted)] truncate">
                          {c.lastMessage}
                        </div>
                      )}
                      {c.other.isOnline ? (
                        <div className="text-xs text-[var(--accent)] truncate">Online</div>
                      ) : c.other.lastSeen ? (
                        <div className="text-xs text-[var(--muted)] truncate">
                          {new Date(c.other.lastSeen).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end">
                      {badgeText && (
                        <span className="text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5">
                          {badgeText}
                        </span>
                      )}
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 mt-1 ${c.other.isOnline ? "bg-[var(--accent)]" : "bg-[rgba(15,23,42,0.06)]"}`}></span>
                    </div>
                  </button>
                );
              })}
              {recents.length === 0 ? (
                <div className="text-xs text-gray-500">No recent chats</div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      <aside className="w-72 border-l border-transparent flex flex-col app-surface">
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
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
          <div className="mt-6">
            <Button
              className="w-full bg-red-500 hover:bg-red-600"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </div>
  </div>
  );
}
