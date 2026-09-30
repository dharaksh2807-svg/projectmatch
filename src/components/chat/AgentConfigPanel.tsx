"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Settings, Trash2 } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast-provider";

interface AgentConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentConfigPanel({ isOpen, onClose }: AgentConfigPanelProps) {
  const { selectedModelId, setAgent, activeAgent } = useChatStore();
  const [name, setName] = useState("New Agent");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assistant."
  );
  const [temperature, setTemperature] = useState(0.7);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const isCustomAgent = activeAgent && !activeAgent.isPublic;

  useEffect(() => {
    if (isOpen && activeAgent && isCustomAgent) {
      setName(activeAgent.name);
      setSystemPrompt(activeAgent.systemPrompt);
      setTemperature(activeAgent.temperature);
      // The ModelSelector automatically reads selectedModelId from store.
    } else if (isOpen && !isCustomAgent) {
      setName("New Agent");
      setSystemPrompt("You are a helpful AI assistant.");
      setTemperature(0.7);
    }
  }, [isOpen, activeAgent, isCustomAgent]);

  const handleSave = async () => {
    if (!selectedModelId) {
      alert("Please select a model first.");
      return;
    }

    setIsSaving(true);
    try {
      const isUpdate = isCustomAgent;
      const url = isUpdate ? `/api/agents/${activeAgent.id}` : "/api/agents";
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt,
          modelId: selectedModelId,
          temperature,
          isPublic: false,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save agent");
      }

      const agent = await res.json();
      setAgent(agent);
      toast(isUpdate ? "Agent updated successfully" : "Agent created successfully", "success");
      onClose();
    } catch (error) {
      console.error(error);
      toast("Error saving agent.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeAgent || !isCustomAgent) return;
    if (!confirm("Are you sure you want to delete this agent? This cannot be undone.")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      
      setAgent(null as any);
      toast("Agent deleted successfully", "success");
      onClose();
    } catch (error) {
      console.error(error);
      toast("Error deleting agent.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-zinc-950/80 backdrop-blur-2xl border-l border-white/10 z-50 shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] p-6 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">
              {isCustomAgent ? "Edit Agent" : "New Agent"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          <div className="space-y-2">
            <Label className="text-zinc-300">Agent Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black/50 border-white/10 text-white"
              maxLength={50}
            />
          </div>

          <div className="space-y-2 flex flex-col">
            <Label className="text-zinc-300 mb-1">Model Selection</Label>
            <div className="w-full">
              <ModelSelector />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">System Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="bg-black/50 border-white/10 text-white min-h-[150px] resize-none"
              maxLength={2000}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-zinc-300">Temperature</Label>
              <span className="text-xs text-zinc-500 font-mono">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white"
            />
            <p className="text-xs text-zinc-500">
              Higher values make output more random, lower values make it more
              deterministic.
            </p>
          </div>
        </div>

        <div className="pt-6 mt-auto border-t border-white/10 space-y-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-white text-black hover:bg-zinc-200 font-medium"
          >
            {isSaving ? "Saving..." : isCustomAgent ? "Update Agent" : "Create Agent"}
          </Button>
          {isCustomAgent && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Agent"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
