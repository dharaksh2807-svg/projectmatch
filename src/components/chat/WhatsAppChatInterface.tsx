"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Search,
  Send,
  Check,
  CheckCheck,
  ArrowLeft,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
  };
  project?: {
    id: string;
    title: string;
    projectType: string;
  } | null;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    isRead: boolean;
    createdAt: string;
  } | null;
  hasUnread: boolean;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
  isOptimistic?: boolean;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Props {
  initialConversationId?: string | null;
}

export function WhatsAppChatInterface({ initialConversationId }: Props) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // New Chat Modal state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState("");
  const [startingChat, setStartingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Fetch Conversations List
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data: ConversationItem[] = await res.json();
        setConversations(data);

        // Auto-select initial or first conversation on desktop if none selected
        if (!activeConversationId && data.length > 0 && typeof window !== "undefined" && window.innerWidth >= 768) {
          setActiveConversationId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (session?.user && !ignore) {
        await fetchConversations();
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [session, fetchConversations]);

  // 2. Fetch Messages for Active Conversation & setup SSE
  useEffect(() => {
    if (!activeConversationId || !session?.user) return;

    let isMounted = true;

    async function loadMessages() {
      try {
        setLoadingMessages(true);
        const res = await fetch(`/api/conversations/${activeConversationId}/messages?limit=60`);
        if (res.ok && isMounted) {
          const data = await res.json();
          // API returns desc, reverse for chronological chat order
          const chronMessages = (data.messages || []).slice().reverse();
          setMessages(chronMessages);
          setTimeout(() => scrollToBottom("auto"), 100);

          // Mark unread as read in local conversation list
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId ? { ...c, hasUnread: false } : c
            )
          );
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }

    loadMessages();

    // Setup Real-Time SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(`/api/conversations/${activeConversationId}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const newMsg: MessageItem = payload.message || payload;

          if (newMsg && newMsg.id) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              // Replace optimistic message if it matches content & sender
              const filtered = prev.filter(
                (m) => !(m.isOptimistic && m.content === newMsg.content)
              );
              return [...filtered, newMsg];
            });

            // Update conversation snippet in left pane
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === activeConversationId) {
                  return {
                    ...c,
                    lastMessage: {
                      id: newMsg.id,
                      content: newMsg.content,
                      senderId: newMsg.senderId,
                      isRead: true,
                      createdAt: newMsg.createdAt,
                    },
                    updatedAt: newMsg.createdAt,
                  };
                }
                return c;
              })
            );

            setTimeout(() => scrollToBottom("smooth"), 100);
          }
        } catch (err) {
          console.error("Failed to parse incoming SSE message:", err);
        }
      });

      es.onerror = () => {
        // SSE dropped, will auto-reconnect or fallback
      };
    } catch (e) {
      console.error("EventSource initialization error:", e);
    }

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [activeConversationId, session]);

  // 3. Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConversationId || sending || !session?.user?.id) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    // Optimistic Message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      content,
      senderId: session.user.id,
      isRead: false,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      sender: {
        id: session.user.id,
        name: session.user.name || "Me",
        image: session.user.image ?? null,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.message || data.error || "Failed to send message", "error");
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputText(content); // restore input
      } else {
        const savedMessage = await res.json();
        // Replace optimistic msg with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? savedMessage : m))
        );

        // Update conversation list preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  lastMessage: {
                    id: savedMessage.id,
                    content: savedMessage.content,
                    senderId: session.user.id,
                    isRead: false,
                    createdAt: savedMessage.createdAt,
                  },
                  updatedAt: savedMessage.createdAt,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
      toast("Network error. Could not send message.", "error");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  // 4. Start New Chat Modal handler
  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatUserId.trim()) return;

    setStartingChat(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newChatUserId.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast("Conversation ready!", "success");
        setIsNewChatOpen(false);
        setNewChatUserId("");
        await fetchConversations();
        setActiveConversationId(data.id);
      } else {
        toast(data.error || "Could not start chat", "error");
      }
    } catch {
      toast("Error creating conversation", "error");
    } finally {
      setStartingChat(false);
    }
  };

  // Active conversation object
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  // Filtered conversations by search query
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const name = c.otherUser?.name?.toLowerCase() || "";
    const email = c.otherUser?.email?.toLowerCase() || "";
    const proj = c.project?.title?.toLowerCase() || "";
    const msg = c.lastMessage?.content?.toLowerCase() || "";
    return name.includes(q) || email.includes(q) || proj.includes(q) || msg.includes(q);
  });

  // Format timestamp helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANE: WhatsApp-style conversation list
          Hidden on mobile if a conversation is selected
          ───────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 flex flex-col border-r border-zinc-800/80 bg-zinc-950 shrink-0 transition-all",
          activeConversationId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Left Header */}
        <div className="h-16 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Avatar
              src={session?.user?.image || undefined}
              alt={session?.user?.name || "My Profile"}
              size="sm"
              className="ring-2 ring-emerald-500/30"
            />
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                Chats
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                  Direct Mode
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNewChatOpen(true)}
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-800/50 bg-zinc-950">
          <div className="relative flex items-center bg-zinc-900 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-emerald-500/50">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="border-0 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 h-7 px-2"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/50">
          {loadingConversations ? (
            <div className="p-6 flex flex-col items-center justify-center space-y-3 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              <p className="text-xs">Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">No chats yet</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                When you accept an applicant or start a direct conversation with a teammate, it will appear here.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewChatOpen(true)}
                className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Start a Chat
              </Button>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConversationId;
              const isSentByMe = c.lastMessage?.senderId === session?.user?.id;

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConversationId(c.id)}
                  className={cn(
                    "flex items-center gap-3 p-3.5 cursor-pointer transition-colors hover:bg-zinc-900/70 select-none",
                    isActive && "bg-zinc-900 border-l-4 border-emerald-500 pl-2.5"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      src={c.otherUser?.image || undefined}
                      alt={c.otherUser?.name || "Teammate"}
                      size="md"
                      className="ring-1 ring-zinc-700"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-medium text-sm text-zinc-100 truncate">
                        {c.otherUser?.name || c.otherUser?.email || "Teammate"}
                      </span>
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        {formatTime(c.lastMessage?.createdAt || c.updatedAt)}
                      </span>
                    </div>

                    {c.project && (
                      <div className="mb-1 flex items-center gap-1">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.2 rounded truncate max-w-[170px]">
                          {c.project.title}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-zinc-400 truncate flex items-center gap-1">
                        {isSentByMe && (
                          <span className="shrink-0 text-zinc-400">
                            {c.lastMessage?.isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" />
                            ) : (
                              <Check className="w-3.5 h-3.5 inline" />
                            )}
                          </span>
                        )}
                        <span className="truncate">
                          {c.lastMessage?.content || "No messages yet"}
                        </span>
                      </p>

                      {c.hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANE: Active Chat Conversation (WhatsApp styling)
          ───────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex-col bg-zinc-950 relative overflow-hidden",
          activeConversationId ? "flex" : "hidden md:flex"
        )}
      >
        {activeConversation ? (
          <>
            {/* WhatsApp Chat Header */}
            <div className="h-16 px-4 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveConversationId(null)}
                  className="md:hidden h-8 w-8 text-zinc-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>

                <Avatar
                  src={activeConversation.otherUser?.image || undefined}
                  alt={activeConversation.otherUser?.name || "Teammate"}
                  size="sm"
                  className="ring-1 ring-emerald-500/40 shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-white truncate">
                      {activeConversation.otherUser?.name || activeConversation.otherUser?.email}
                    </h3>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50 shrink-0">
                      Teammate
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {activeConversation.otherUser?.email || "Active on ProjectMatch"}
                  </p>
                </div>
              </div>

              {/* Context Actions */}
              <div className="flex items-center gap-2">
                {activeConversation.project && (
                  <Link
                    href={`/projects/${activeConversation.project.id}`}
                    className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-300 hover:text-emerald-400 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/60 transition-colors"
                  >
                    <span>{activeConversation.project.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Messages Scroll Area with WhatsApp-style background */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] bg-zinc-950">
              {/* Security Banner */}
              <div className="flex justify-center mb-4">
                <span className="text-[11px] bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-center max-w-md shadow-sm">
                  🔒 Messages are delivered in real time via Upstash Redis & SSE.
                </span>
              </div>

              {loadingMessages ? (
                <div className="flex items-center justify-center h-48 space-x-2 text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                  <span className="text-xs">Loading message history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500 space-y-2">
                  <Sparkles className="w-8 h-8 text-emerald-500/60" />
                  <p className="text-sm font-medium text-zinc-300">Say hello!</p>
                  <p className="text-xs text-zinc-500">
                    Introduce yourself and coordinate your hackathon project milestones.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === session?.user?.id;
                  const showDate =
                    index === 0 ||
                    new Date(messages[index - 1].createdAt).toDateString() !==
                      new Date(msg.createdAt).toDateString();

                  return (
                    <div key={msg.id || index} className="space-y-2">
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] uppercase tracking-wider font-semibold bg-zinc-900/90 text-zinc-400 px-2.5 py-0.5 rounded-md border border-zinc-800">
                            {new Date(msg.createdAt).toLocaleDateString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}

                      <div
                        className={cn(
                          "flex items-end gap-1.5",
                          isMe ? "justify-end" : "justify-start"
                        )}
                      >
                        {!isMe && (
                          <Avatar
                            src={msg.sender?.image || activeConversation.otherUser?.image || undefined}
                            alt={msg.sender?.name || "Sender"}
                            size="sm"
                            className="w-6 h-6 shrink-0 mb-1"
                          />
                        )}

                        <div
                          className={cn(
                            "relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm break-words",
                            isMe
                              ? "bg-emerald-700 text-white rounded-br-none"
                              : "bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-bl-none"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 mt-1 text-[10px]",
                              isMe ? "text-emerald-200" : "text-zinc-400"
                            )}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMe && (
                              <span>
                                {msg.isOptimistic ? (
                                  <Loader2 className="w-3 h-3 animate-spin inline" />
                                ) : msg.isRead ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-300 inline" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp-style Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-zinc-900 border-t border-zinc-800/80 flex items-center gap-2 shrink-0"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white h-9 w-9 shrink-0"
                title="Attach file (demo)"
                onClick={() => toast("Attachment feature coming soon!", "info")}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <div className="flex-1 relative flex items-center">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message... (Press Enter to send)"
                  className="bg-zinc-950 border-zinc-800 focus-visible:ring-emerald-500/60 text-sm h-10 rounded-full px-4 text-zinc-100 placeholder:text-zinc-500"
                />
              </div>

              <Button
                type="submit"
                disabled={!inputText.trim() || sending}
                className={cn(
                  "h-10 w-10 rounded-full shrink-0 p-0 transition-transform active:scale-95",
                  inputText.trim()
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
                title="Send Message"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </>
        ) : (
          /* Empty Right Pane when no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-zinc-950">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl">
              <MessageSquare className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-white">
                ProjectMatch Direct Chat
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Connect and coordinate directly with hackathon teammates, applicants, and project creators. Select a conversation from the left pane to start chatting.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real-time delivery powered by Redis Pub/Sub</span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          NEW CHAT MODAL
          ───────────────────────────────────────────────────────────── */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="font-semibold text-base text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Start New Direct Chat
              </h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Enter the User ID or CUID of a teammate or project collaborator to open a 1-on-1 direct conversation.
            </p>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  User ID / Teammate ID
                </label>
                <Input
                  value={newChatUserId}
                  onChange={(e) => setNewChatUserId(e.target.value)}
                  placeholder="e.g. clx123abc456..."
                  className="bg-zinc-950 border-zinc-800 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsNewChatOpen(false)}
                  className="text-xs text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={startingChat || !newChatUserId.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                >
                  {startingChat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Open Conversation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
