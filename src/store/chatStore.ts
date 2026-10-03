import { create } from "zustand";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  tier: string;
  isActive: boolean;
  contextWindow: number;
}

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  isPublic: boolean;
}

export interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

interface ChatState {
  availableModels: AIModel[];
  selectedModelId: string | null;
  activeAgent: Agent | null;
  messages: Message[];
  isStreaming: boolean;
  activeChatId: string | null;
  chatList: ChatSummary[];

  setModels: (models: AIModel[]) => void;
  setModel: (modelId: string) => void;
  setAgent: (agent: Agent) => void;
  setActiveChat: (chatId: string) => void;
  addMessage: (message: Message) => void;
  appendToLastMessage: (chunk: string) => void;
  clearChat: () => void;
  setStreaming: (streaming: boolean) => void;
  fetchChats: () => Promise<void>;
  loadChatHistory: (chatId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  availableModels: [],
  selectedModelId: null,
  activeAgent: null,
  messages: [],
  isStreaming: false,
  activeChatId: null,
  chatList: [],

  setModels: (models) => set({ availableModels: models }),
  setModel: (modelId) => set({ selectedModelId: modelId }),
  setAgent: (agent) => set({ activeAgent: agent, selectedModelId: agent.modelId }),
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
    
  appendToLastMessage: (chunk) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === "ASSISTANT") {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: messages[lastIndex].content + chunk,
        };
      } else {
        // If the last message is not from assistant, create a new one
        messages.push({
          id: `temp-${Date.now()}`,
          role: "ASSISTANT",
          content: chunk,
        });
      }
      return { messages };
    }),

  clearChat: () => set({ messages: [], activeChatId: null }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  
  fetchChats: async () => {
    try {
      const res = await fetch("/api/chat/list");
      if (res.ok) {
        const chats = await res.json();
        set({ chatList: chats });
      }
    } catch (error) {
      console.error("Failed to fetch chats", error);
    }
  },

  loadChatHistory: async (chatId: string) => {
    try {
      const res = await fetch(`/api/chat/${chatId}`);
      if (res.ok) {
        const chat = await res.json();
        set({
          activeChatId: chat.id,
          messages: chat.messages,
          activeAgent: chat.agent,
          selectedModelId: chat.agent.modelId,
        });
      }
    } catch (error) {
      console.error("Failed to load chat history", error);
    }
  },
}));
