"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/components/ui/toast-provider";

export function ChatInterface() {
  const {
    messages,
    addMessage,
    appendToLastMessage,
    activeAgent,
    activeChatId,
    isStreaming,
    setStreaming,
    availableModels,
  } = useChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setStreaming(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeAgent || isStreaming) return;

    const userMessageContent = input.trim();
    setInput("");
    
    // Add optimistic user message
    addMessage({
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: userMessageContent,
    });

    const controller = new AbortController();
    setAbortController(controller);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent.id,
          chatId: activeChatId,
          message: userMessageContent,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const newChatId = res.headers.get("X-Chat-Id");
      if (newChatId && newChatId !== activeChatId) {
        useChatStore.getState().setActiveChat(newChatId);
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          appendToLastMessage(chunk);
        }
        
        // Final flush
        appendToLastMessage(decoder.decode());
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Stream aborted by user");
      } else {
        console.error(error);
        toast("An error occurred while generating the response.", "error");
        addMessage({
          id: `temp-error-${Date.now()}`,
          role: "ASSISTANT",
          content: "An error occurred while generating the response.",
        });
      }
    } finally {
      setStreaming(false);
      setAbortController(null);
    }
  };

  const getModelName = (modelId: string) => {
    return availableModels.find((m) => m.id === modelId)?.name || modelId;
  };

  if (!activeAgent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/30">
        <Bot className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">Select or configure an agent to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950/50 relative overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-zinc-400" />
            </div>
            <p>Say hello to {activeAgent.name}</p>
            <p className="text-xs mt-2 opacity-70">
              Powered by {getModelName(activeAgent.modelId)}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex w-full ${
                msg.role === "USER" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex max-w-[85%] sm:max-w-[75%] ${
                  msg.role === "USER" ? "flex-row-reverse" : "flex-row"
                } items-end gap-2`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/10">
                  {msg.role === "USER" ? (
                    <User className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-zinc-300" />
                  )}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1">
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                      msg.role === "USER"
                        ? "bg-blue-600/90 text-white rounded-br-sm backdrop-blur-md"
                        : "bg-zinc-800/80 text-zinc-100 rounded-bl-sm backdrop-blur-md border border-white/5"
                    }`}
                  >
                    {msg.role === "USER" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  {/* Metadata for Assistant */}
                  {msg.role === "ASSISTANT" && (
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 pl-1">
                      <span>{getModelName(activeAgent.modelId)}</span>
                      <span>•</span>
                      <span>~{Math.ceil(msg.content.length / 4)} tokens</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Loading Indicator */}
        {isStreaming && (
           <div className="flex w-full justify-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="rounded-full bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-2"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop Generating
            </Button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-4xl mx-auto relative flex items-center"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-black/50 border-white/20 text-white rounded-full pl-6 pr-14 py-6 focus-visible:ring-1 focus-visible:ring-blue-500 shadow-inner"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 rounded-full w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
          >
            <Send className="w-4 h-4 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
