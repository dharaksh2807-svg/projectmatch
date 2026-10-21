"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Swords, CheckCircle2, Bot, Trophy } from "lucide-react";
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
    <div className="flex flex-col min-h-screen overflow-y-auto bg-background text-foreground p-3.5 sm:p-6 pb-20 md:pb-8 font-sans">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-3.5 sm:gap-4 border-b border-border pb-5 shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Prompt Battles</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Compare AI model responses side-by-side with identical inputs</p>
          </div>
        </div>

        {/* Input Card */}
        <div className="rounded-2xl p-4 sm:p-6 border border-border bg-card shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full flex-1 space-y-1.5">
              <label htmlFor="model-a" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Model A (Left)
              </label>
              <select 
                id="model-a"
                value={modelA} 
                onChange={(e) => setModelA(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-foreground text-base md:text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {models.map(m => (
                  <option key={`a-${m.id}`} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center pt-5">
              <span className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                VS
              </span>
            </div>

            <div className="w-full flex-1 space-y-1.5">
              <label htmlFor="model-b" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Model B (Right)
              </label>
              <select 
                id="model-b"
                value={modelB} 
                onChange={(e) => setModelB(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-foreground text-base md:text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {models.map(m => (
                  <option key={`b-${m.id}`} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="battle-prompt" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Test Prompt
            </label>
            <Textarea 
              id="battle-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Write a clean Python function to parse JSON with error handling..."
              className="bg-background border-input text-foreground min-h-[110px] resize-none focus-visible:ring-primary/20 focus-visible:border-primary/50 rounded-xl"
              disabled={isBattling}
            />
          </div>
          
          <div className="flex justify-end pt-2">
            <Button 
              onClick={startBattle} 
              disabled={isBattling || !prompt}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {isBattling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Battling Models...
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4 mr-2" />
                  Start Battle
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex flex-col md:flex-row gap-5">
          {currentBattle ? (
            <>
              {/* Model A */}
              <div className="flex-1 flex flex-col min-w-0 min-h-[320px] border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
                <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground truncate">
                      {models.find(m => m.id === modelA)?.name || 'Model A'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">Model A</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 prose dark:prose-invert max-w-none text-sm text-foreground leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentBattle.responseA}</ReactMarkdown>
                </div>
                {/* Voting Action */}
                {!currentBattle.winnerId && (
                  <div className="p-3.5 bg-muted/30 border-t border-border shrink-0">
                    <Button 
                      onClick={() => submitVote('modelA')}
                      variant="outline" 
                      className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Vote for Model A
                    </Button>
                  </div>
                )}
                {currentBattle.winnerId === 'modelA' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-center text-sm font-semibold border-t border-emerald-500/20 shrink-0 flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Winner 🏆
                  </div>
                )}
              </div>

              {/* Model B */}
              <div className="flex-1 flex flex-col min-w-0 min-h-[320px] border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
                <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-foreground truncate">
                      {models.find(m => m.id === modelB)?.name || 'Model B'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">Model B</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 prose dark:prose-invert max-w-none text-sm text-foreground leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentBattle.responseB}</ReactMarkdown>
                </div>
                {/* Voting Action */}
                {!currentBattle.winnerId && (
                  <div className="p-3.5 bg-muted/30 border-t border-border shrink-0">
                    <Button 
                      onClick={() => submitVote('modelB')}
                      variant="outline" 
                      className="w-full rounded-xl border-purple-500/30 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Vote for Model B
                    </Button>
                  </div>
                )}
                {currentBattle.winnerId === 'modelB' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-center text-sm font-semibold border-t border-emerald-500/20 shrink-0 flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Winner 🏆
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl p-8 text-center space-y-3 bg-card/40">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <Swords className="w-6 h-6 opacity-60" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">No battle in progress</p>
                <p className="text-xs text-muted-foreground">Select two models above, write a prompt, and click &quot;Start Battle&quot; to test them head-to-head.</p>
              </div>
            </div>
          )}
        </div>

        {/* Tie Action */}
        {currentBattle && !currentBattle.winnerId && (
          <div className="flex justify-center shrink-0 pt-2">
            <Button 
              onClick={() => submitVote('tie')}
              variant="ghost" 
              className="text-muted-foreground hover:text-foreground"
            >
              Both responses are equally good (Tie)
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
