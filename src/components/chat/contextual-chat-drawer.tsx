"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Send,
  MessageSquare,
  ExternalLink,
  X,
  Loader2,
  Check,
  CheckCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

export interface ContextualChatContext {
  recipientId: string;
  recipientName: string | null;
  recipientImage?: string | null;
  projectId?: string;
  projectTitle?: string;
  roleId?: string;
  roleTitle?: string;
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

interface ContextualChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: ContextualChatContext | null;
}

export function ContextualChatDrawer({
  isOpen,
  onClose,
  context,
}: ContextualChatDrawerProps) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const { toast } = useToast();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Format message timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // 1. When drawer opens, check for existing conversation with this recipient
  useEffect(() => {
    if (!isOpen || !context?.recipientId || !currentUserId) return;

    let isMounted = true;
    setLoadingHistory(true);
    setSendError(null);

    async function loadConversationAndMessages() {
      try {
        // Query existing conversations
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to load conversations");

        const convs = await res.json();
        const existing = convs.find(
          (c: any) => c.otherUser?.id === context?.recipientId
        );

        if (existing && isMounted) {
          setConversationId(existing.id);

          // Fetch messages for this conversation
          const msgRes = await fetch(
            `/api/conversations/${existing.id}/messages?limit=60`
          );
          if (msgRes.ok && isMounted) {
            const data = await msgRes.json();
            // Reverse from descending order to chronological order
            const chronMessages = (data.messages || []).slice().reverse();
            setMessages(chronMessages);
            setTimeout(() => scrollToBottom("auto"), 60);
          }
        } else if (isMounted) {
          setConversationId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Error loading chat context:", err);
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
          // Focus input on open
          setTimeout(() => textareaRef.current?.focus(), 120);
        }
      }
    }

    loadConversationAndMessages();

    return () => {
      isMounted = false;
    };
  }, [isOpen, context?.recipientId, currentUserId, scrollToBottom]);

  // 2. Real-time updates via EventSource when conversationId is established
  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/conversations/${conversationId}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const newMsg: MessageItem = payload.message || payload;

          if (newMsg && newMsg.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              const filtered = prev.filter(
                (m) => !(m.isOptimistic && m.content === newMsg.content)
              );
              return [...filtered, newMsg];
            });
            setTimeout(() => scrollToBottom("smooth"), 50);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      });
    } catch (e) {
      console.error("EventSource failed:", e);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, conversationId, scrollToBottom]);

  // 3. Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || !context?.recipientId || !currentUserId) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);
    setSendError(null);

    // Create optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      content,
      senderId: currentUserId,
      isRead: false,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      sender: {
        id: currentUserId,
        name: session?.user?.name || "Me",
        image: session?.user?.image ?? null,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      let activeId = conversationId;

      // If conversation does not exist yet, create it on first message
      if (!activeId) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: context.recipientId,
            projectId: context.projectId || undefined,
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create conversation");
        }

        const newConv = await createRes.json();
        activeId = newConv.id;
        setConversationId(newConv.id);
      }

      // Send message
      const sendRes = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to send message");
      }

      const savedMessage = await sendRes.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? savedMessage : m))
      );
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setSendError(err.message || "Failed to send. Please try again.");
      toast(err.message || "Could not send message", "error");
      // Restore input and remove optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content);
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!context) return null;

  const recipientDisplayName = context.recipientName || "Project Lead";
  const fullConversationHref = conversationId
    ? `/messages?c=${conversationId}`
    : `/messages?userId=${context.recipientId}${
        context.projectId ? `&projectId=${context.projectId}` : ""
      }`;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-md md:max-w-[430px] p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border h-full shadow-2xl z-50 animate-in slide-in-from-right duration-200"
      >
        {/* ── Top Header ── */}
        <SheetHeader className="p-3.5 sm:p-4 border-b border-border bg-sidebar shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                src={context.recipientImage}
                alt={recipientDisplayName}
                size="sm"
                className="w-9 h-9 shrink-0 ring-1 ring-border"
              />
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold text-foreground truncate block leading-tight">
                  {recipientDisplayName}
                </SheetTitle>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Active Opportunity Lead
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={fullConversationHref}
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Open full conversation in Messages"
                aria-label="Open full conversation in Messages workspace"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close conversation drawer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Context Banner: Real Project and Role Information */}
          <div className="px-2.5 py-1.5 rounded-lg bg-secondary/70 border border-border/80 text-[11px] flex items-center justify-between gap-2">
            <div className="truncate text-foreground font-medium flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">
                Regarding:{" "}
                <strong className="text-primary font-semibold">
                  {context.projectTitle || "Project"}
                </strong>
                {context.roleTitle ? ` — ${context.roleTitle}` : ""}
              </span>
            </div>
            {context.roleTitle && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Role
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* ── Scrollable Conversation Area ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-background/50">
          {loadingHistory ? (
            <div className="space-y-3 p-2">
              <div className="flex gap-2">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <Skeleton className="h-10 w-44 rounded-xl" />
              </div>
              <div className="flex gap-2 justify-end">
                <Skeleton className="h-12 w-52 rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <Skeleton className="h-8 w-36 rounded-xl" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5 text-muted-foreground">
              <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-semibold text-foreground">
                  No prior messages
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Send a message to ask{" "}
                  <strong className="text-foreground">{recipientDisplayName}</strong>{" "}
                  about the open role or collaborate on{" "}
                  <strong className="text-foreground">
                    {context.projectTitle || "this project"}
                  </strong>
                  .
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-0.5",
                    isMe ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] break-words shadow-2xs",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-tr-xs"
                        : "bg-secondary text-secondary-foreground rounded-tl-xs border border-border"
                    )}
                  >
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && (
                      <span>
                        {msg.isOptimistic ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : msg.isRead ? (
                          <CheckCheck className="w-3 h-3 text-primary" />
                        ) : (
                          <Check className="w-3 h-3 text-muted-foreground" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Error Banner if any ── */}
        {sendError && (
          <div className="mx-3 mb-1 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{sendError}</span>
          </div>
        )}

        {/* ── Bottom Composer ── */}
        <div className="p-3 border-t border-border bg-sidebar shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-card p-1.5 rounded-xl border border-input focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${recipientDisplayName}...`}
              disabled={sending}
              aria-label={`Message input for ${recipientDisplayName}`}
              className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none px-2 py-1.5 min-h-[38px] max-h-28"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!inputText.trim() || sending}
              className="h-8.5 px-3 rounded-lg text-xs font-semibold gap-1.5 shrink-0"
              aria-label="Send message"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="sr-only sm:not-sr-only">Sending</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 px-1">
            <span>Press Enter to send, Shift+Enter for newline</span>
            {context.projectId && (
              <span className="truncate max-w-[150px]">
                {context.projectTitle}
              </span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
