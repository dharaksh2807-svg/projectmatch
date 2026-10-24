"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useChatStore, Agent } from "@/store/chatStore";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { AgentConfigPanel } from "@/components/chat/AgentConfigPanel";
import { WhatsAppChatInterface } from "@/components/chat/WhatsAppChatInterface";
import { ByokModal } from "@/components/chat/ByokModal";
import { Button } from "@/components/ui/button";
import { Settings2, Bot, PlusCircle, MessageSquare, Trash2, Menu, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast-provider";

export default function ChatPage() {
  const { data: session } = useSession();
  const [chatTab, setChatTab] = useState<"direct" | "agent">("direct");
  const {
    setModels,
    activeAgent,
    setAgent,
    clearChat,
    chatList,
    fetchChats,
    loadChatHistory,
    activeChatId,
    userKeys,
    setByokModalOpen,
  } = useChatStore();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [modelsRes, agentsRes] = await Promise.all([
          fetch("/api/models"),
          fetch("/api/agents"),
        ]);

        if (modelsRes.ok) {
          const models = await modelsRes.json();
          setModels(models);
        }

        if (agentsRes.ok) {
          const fetchedAgents: Agent[] = await agentsRes.json();
          setAgents(fetchedAgents);
        }
      } catch (error) {
        console.error("Failed to fetch initial data", error);
        toast("Failed to load models and agents", "error");
      }
    }

    if (session?.user) {
      fetchInitialData();
    }
  }, [session, setModels, toast]);

  const handleAgentSelect = (agentId: string | null) => {
    if (!agentId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      setAgent(agent);
      clearChat();
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/${id}`, { method: "DELETE" });
      if (activeChatId === id) {
        clearChat();
      }
      fetchChats();
    } catch (err) {
      console.error(err);
      toast("Failed to delete chat", "error");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Top Mode Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border">
            <button
              onClick={() => setChatTab("direct")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                chatTab === "direct"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Direct / Team Chat
            </button>
            <button
              onClick={() => setChatTab("agent")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                chatTab === "agent"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bot className="w-3.5 h-3.5" />
              AI Agent Chat
            </button>
          </div>
        </div>

        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {chatTab === "direct" ? "Direct & Team Messaging" : "AI Multi-Agent Workspace"}
        </span>
      </div>

      {chatTab === "direct" ? (
        <div className="flex-1 overflow-hidden">
          <WhatsAppChatInterface />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
      
      
      {/* Chat History Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Chat History</span>
          <Button variant="ghost" size="icon" onClick={() => clearChat()} className="h-6 w-6 text-muted-foreground hover:text-foreground" title="New Chat">
            <PlusCircle className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatList.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChatHistory(chat.id)}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group text-sm transition-colors ${
                activeChatId === chat.id ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{chat.title || "New Chat"}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteChat(e, chat.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {chatList.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">No recent chats</div>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-4">
          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger render={
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <Menu className="w-5 h-5" />
                </Button>
              } />
              <SheetContent side="left" className="w-72 p-0 bg-sidebar border-border text-foreground flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Chat History</span>
                  <Button variant="ghost" size="icon" onClick={() => { clearChat(); setIsMobileMenuOpen(false); }} className="h-6 w-6 text-muted-foreground hover:text-foreground" title="New Chat">
                    <PlusCircle className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {chatList.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => { loadChatHistory(chat.id); setIsMobileMenuOpen(false); }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group text-sm transition-colors ${
                        activeChatId === chat.id ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="truncate">{chat.title || "New Chat"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {chatList.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">No recent chats</div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center space-x-2 text-foreground font-semibold">
            <Bot className="w-5 h-5 text-primary" />
            <span className="hidden sm:inline">Agent Workspace</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-border mx-2" />

          {/* Agent Selector */}
          <div className="flex items-center space-x-2">
            <Select
              value={activeAgent?.id}
              onValueChange={handleAgentSelect}
            >
              <SelectTrigger className="w-[200px] h-9 bg-background border-border text-foreground hover:bg-accent transition-colors">
                <SelectValue placeholder="Select an Agent" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="cursor-pointer">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setByokModalOpen(true)}
            className="h-9 border-border bg-transparent text-foreground hover:bg-accent flex items-center gap-1.5"
            title="Configure BYOK API Keys (Session Only)"
          >
            <Key className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">BYOK Keys</span>
            {(userKeys.geminiApiKey || userKeys.claudeApiKey || userKeys.openaiApiKey) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-9 border-border bg-transparent text-foreground hover:bg-accent"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Agent</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsConfigOpen(true)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
            title="Configure Agent"
          >
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Chat Area */}
      <ChatInterface />

      {/* Slide-in Config Panel */}
      <AgentConfigPanel
        isOpen={isConfigOpen}
        onClose={() => {
          setIsConfigOpen(false);
          // Refetch agents after panel closes in case one was created
          fetch("/api/agents")
            .then((res) => res.json())
            .then((data: Agent[]) => setAgents(data))
            .catch(console.error);
        }}
      />

      {/* Bring Your Own Key (BYOK) Modal */}
      <ByokModal />
          </div>
        </div>
      )}
    </div>
  );
}
