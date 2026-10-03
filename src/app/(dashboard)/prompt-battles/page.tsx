"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Swords, CheckCircle2, Bot } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface Battle {
  id: string;
  responseA: string;
  responseB: string;
  winnerId: string | null;
}

export default function PromptBattlesPage() {
  const { toast } = useToast();
  
  const [models, setModels] = useState<Model[]>([]);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isBattling, setIsBattling] = useState(false);
  const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data: Model[]) => {
        setModels(data);
        if (data.length >= 2) {
          setModelA(data[0].id);
          setModelB(data[1].id);
        }
      })
      .catch(() => toast("Failed to load models", "error"));
  }, [toast]);

  const startBattle = async () => {
    if (!prompt.trim()) return toast("Please enter a prompt", "error");
    if (!modelA || !modelB || modelA === modelB) return toast("Select two different models", "error");
    
    setIsBattling(true);
    setCurrentBattle(null);
    try {
      const res = await fetch("/api/prompt-battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelAId: modelA, modelBId: modelB }),
      });
      if (!res.ok) throw new Error();
      const battle = await res.json();
      setCurrentBattle(battle);
    } catch {
      toast("Battle failed to start", "error");
    } finally {
      setIsBattling(false);
    }
  };

  const submitVote = async (winnerId: string) => {
    if (!currentBattle) return;
    try {
      const res = await fetch(`/api/prompt-battles/${currentBattle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      if (!res.ok) throw new Error();
      toast("Vote recorded!", "success");
      setCurrentBattle({ ...currentBattle, winnerId });
    } catch {
      toast("Failed to record vote", "error");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950 p-6">
      <div className="max-w-6xl w-full mx-auto flex flex-col h-full gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-4 shrink-0">
          <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center glow">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Prompt Battles</h1>
            <p className="text-zinc-400 text-sm">Test and compare AI models head-to-head</p>
          </div>
        </div>

        {/* Input Section */}
        <div className="glass-card rounded-2xl p-4 border border-border/50 shadow-xl shrink-0">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Model A (Left)</label>
              <select 
                value={modelA} 
                onChange={(e) => setModelA(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white text-sm"
              >
                {models.map(m => <option key={`a-${m.id}`} value={m.id}>{m.name} ({m.provider})</option>)}
              </select>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-zinc-600 font-bold hidden md:block">VS</span>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Model B (Right)</label>
              <select 
                value={modelB} 
                onChange={(e) => setModelB(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white text-sm"
              >
                {models.map(m => <option key={`b-${m.id}`} value={m.id}>{m.name} ({m.provider})</option>)}
              </select>
            </div>
          </div>
          
          <Textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt to test both models..."
            className="bg-zinc-900/50 border-white/10 text-white min-h-[100px] mb-4 resize-none focus-visible:ring-primary"
            disabled={isBattling}
          />
          
          <div className="flex justify-end">
            <Button 
              onClick={startBattle} 
              disabled={isBattling || !prompt}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isBattling ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Battling...</>
              ) : (
                <><Swords className="w-4 h-4 mr-2" /> Start Battle</>
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex-1 min-h-0 flex gap-4">
          {currentBattle ? (
            <>
              {/* Model A */}
              <div className="flex-1 flex flex-col min-w-0 border border-white/10 rounded-2xl bg-zinc-950 overflow-hidden">
                <div className="p-3 bg-zinc-900 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-medium text-white truncate">{models.find(m => m.id === modelA)?.name || 'Model A'}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 prose prose-invert max-w-none text-sm text-zinc-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentBattle.responseA}</ReactMarkdown>
                </div>
                {/* Voting Action */}
                {!currentBattle.winnerId && (
                  <div className="p-3 bg-zinc-900 border-t border-white/10 shrink-0">
                    <Button 
                      onClick={() => submitVote('modelA')}
                      variant="outline" 
                      className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Model A is Better
                    </Button>
                  </div>
                )}
                {currentBattle.winnerId === 'modelA' && (
                  <div className="p-3 bg-green-900/20 text-green-400 text-center text-sm font-semibold border-t border-green-500/20 shrink-0">
                    Winner 🏆
                  </div>
                )}
              </div>

              {/* Model B */}
              <div className="flex-1 flex flex-col min-w-0 border border-white/10 rounded-2xl bg-zinc-950 overflow-hidden">
                <div className="p-3 bg-zinc-900 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-medium text-white truncate">{models.find(m => m.id === modelB)?.name || 'Model B'}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 prose prose-invert max-w-none text-sm text-zinc-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentBattle.responseB}</ReactMarkdown>
                </div>
                {/* Voting Action */}
                {!currentBattle.winnerId && (
                  <div className="p-3 bg-zinc-900 border-t border-white/10 shrink-0">
                    <Button 
                      onClick={() => submitVote('modelB')}
                      variant="outline" 
                      className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Model B is Better
                    </Button>
                  </div>
                )}
                {currentBattle.winnerId === 'modelB' && (
                  <div className="p-3 bg-green-900/20 text-green-400 text-center text-sm font-semibold border-t border-green-500/20 shrink-0">
                    Winner 🏆
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-white/10 rounded-2xl">
              <Swords className="w-12 h-12 mb-4 opacity-20" />
              <p>Select two models, enter a prompt, and start the battle!</p>
            </div>
          )}
        </div>

        {/* Tie Action */}
        {currentBattle && !currentBattle.winnerId && (
          <div className="flex justify-center shrink-0">
            <Button 
              onClick={() => submitVote('tie')}
              variant="ghost" 
              className="text-zinc-400 hover:text-white"
            >
              It's a Tie
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
