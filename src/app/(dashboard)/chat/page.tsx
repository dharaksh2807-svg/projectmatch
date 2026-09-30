"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/chatStore";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { AgentConfigPanel } from "@/components/chat/AgentConfigPanel";
import { Button } from "@/components/ui/button";
import { Settings2, Bot, PlusCircle, MessageSquare, Trash2, Menu } from "lucide-react";
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
  const { setModels, activeAgent, setAgent, clearChat, chatList, fetchChats, loadChatHistory, activeChatId } = useChatStore();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
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
          const fetchedAgents = await agentsRes.json();
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
  }, [session, setModels]);

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
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-950">
      
      
      {/* Chat History Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-64 border-r border-white/10 bg-zinc-950/50">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Chat History</span>
          <Button variant="ghost" size="icon" onClick={() => clearChat()} className="h-6 w-6 text-zinc-400 hover:text-white" title="New Chat">
            <PlusCircle className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatList.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChatHistory(chat.id)}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group text-sm transition-colors ${
                activeChatId === chat.id ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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
                className="opacity-0 group-hover:opacity-100 h-6 w-6 text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {chatList.length === 0 && (
            <div className="p-4 text-center text-xs text-zinc-600">No recent chats</div>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-4">
          {/* Mobile Hamburger Menu */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-zinc-950 border-white/10 text-white flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-300">Chat History</span>
                  <Button variant="ghost" size="icon" onClick={() => { clearChat(); setIsMobileMenuOpen(false); }} className="h-6 w-6 text-zinc-400 hover:text-white" title="New Chat">
                    <PlusCircle className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {chatList.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => { loadChatHistory(chat.id); setIsMobileMenuOpen(false); }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group text-sm transition-colors ${
                        activeChatId === chat.id ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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
                        className="h-6 w-6 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {chatList.length === 0 && (
                    <div className="p-4 text-center text-xs text-zinc-600">No recent chats</div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
            <Bot className="w-5 h-5 text-blue-400" />
            <span className="hidden sm:inline">Agent Workspace</span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-white/10 mx-2" />

          {/* Agent Selector */}
          <div className="flex items-center space-x-2">
            <Select
              value={activeAgent?.id}
              onValueChange={handleAgentSelect}
            >
              <SelectTrigger className="w-[200px] h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors">
                <SelectValue placeholder="Select an Agent" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="cursor-pointer">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigOpen(true)}
            className="h-9 border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Agent</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsConfigOpen(true)}
            className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
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
            .then(setAgents)
            .catch(console.error);
        }}
      />
      </div>
    </div>
  );
}
