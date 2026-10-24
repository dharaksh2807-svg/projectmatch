"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Eye, EyeOff, Trash2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

function ByokModalForm({ onClose }: { onClose: () => void }) {
  const { userKeys, setUserKeys, clearUserKeys } = useChatStore();
  const { toast } = useToast();

  const [geminiKey, setGeminiKey] = useState(userKeys.geminiApiKey || "");
  const [claudeKey, setClaudeKey] = useState(userKeys.claudeApiKey || "");
  const [openaiKey, setOpenaiKey] = useState(userKeys.openaiApiKey || "");

  const [showGemini, setShowGemini] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);

  const handleSave = () => {
    setUserKeys({
      geminiApiKey: geminiKey.trim(),
      claudeApiKey: claudeKey.trim(),
      openaiApiKey: openaiKey.trim(),
    });
    toast("BYOK session keys saved successfully", "success");
    onClose();
  };

  const handleClear = () => {
    clearUserKeys();
    setGeminiKey("");
    setClaudeKey("");
    setOpenaiKey("");
    toast("All API keys removed from session memory", "success");
  };

  const activeKeyCount = [userKeys.geminiApiKey, userKeys.claudeApiKey, userKeys.openaiApiKey].filter(Boolean).length;

  return (
    <DialogContent className="max-w-lg w-full bg-card border-border p-6 shadow-2xl rounded-2xl">
      <DialogHeader className="gap-1.5">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Bring Your Own Key (BYOK)
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Configure custom API keys to use your own provider quotas. Keys remain strictly within your browser&apos;s ephemeral <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono">sessionStorage</code> and are cleared when you close the tab.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Google Gemini */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="byok-gemini" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              Google Gemini API Key
            </Label>
            {userKeys.geminiApiKey ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">Optional</span>
            )}
          </div>
          <div className="relative flex items-center">
            <Input
              id="byok-gemini"
              type={showGemini ? "text" : "password"}
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10 bg-background border-input font-mono text-xs rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowGemini(!showGemini)}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              title={showGemini ? "Hide Key" : "Show Key"}
            >
              {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Anthropic Claude */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="byok-claude" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              Anthropic Claude API Key
            </Label>
            {userKeys.claudeApiKey ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">Optional</span>
            )}
          </div>
          <div className="relative flex items-center">
            <Input
              id="byok-claude"
              type={showClaude ? "text" : "password"}
              placeholder="sk-ant-..."
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10 bg-background border-input font-mono text-xs rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowClaude(!showClaude)}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              title={showClaude ? "Hide Key" : "Show Key"}
            >
              {showClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* OpenAI / Compatible OSS */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="byok-openai" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              OpenAI / OSS API Key
            </Label>
            {userKeys.openaiApiKey ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground">Optional</span>
            )}
          </div>
          <div className="relative flex items-center">
            <Input
              id="byok-openai"
              type={showOpenai ? "text" : "password"}
              placeholder="sk-... or Together API key"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10 bg-background border-input font-mono text-xs rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowOpenai(!showOpenai)}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              title={showOpenai ? "Hide Key" : "Show Key"}
            >
              {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Security Guarantee Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Zero-Leakage Security Guarantee</p>
            <p>
              Keys are never saved to database, never exposed in URL parameters, and never logged. They are passed directly via secure HTTPS headers.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
        {activeKeyCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="w-full sm:w-auto rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear All Keys
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1 sm:flex-none rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="flex-1 sm:flex-none rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save Keys
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function ByokModal() {
  const { isByokModalOpen, setByokModalOpen } = useChatStore();

  return (
    <Dialog open={isByokModalOpen} onOpenChange={setByokModalOpen}>
      {isByokModalOpen && (
        <ByokModalForm onClose={() => setByokModalOpen(false)} />
      )}
    </Dialog>
  );
}
