"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { Loader2, Link as LinkIcon, Unlink, RefreshCw } from "lucide-react";

interface Connection {
  platform: string;
  handle: string;
  profileUrl: string | null;
  source: "oauth" | "handle";
  connected: boolean;
  lastSyncedAt: string | null;
}

const PLATFORMS = [
  { id: "github", name: "GitHub", source: "oauth" },
  { id: "linkedin", name: "LinkedIn", source: "oauth" },
  { id: "leetcode", name: "LeetCode", source: "handle" },
  { id: "codeforces", name: "Codeforces", source: "handle" },
  { id: "kaggle", name: "Kaggle", source: "handle" },
  { id: "stackoverflow", name: "StackOverflow", source: "handle" },
  { id: "devto", name: "Dev.to", source: "handle" },
  { id: "medium", name: "Medium", source: "handle" },
  { id: "hashnode", name: "Hashnode", source: "handle" },
  { id: "hackerrank", name: "HackerRank", source: "handle" },
  { id: "gitlab", name: "GitLab", source: "handle" },
  { id: "twitter", name: "Twitter / X", source: "handle" },
] as const;

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { data: session } = useSession();

  // Auto-sync OAuth providers if they are freshly connected but missing metadata
  useEffect(() => {
    let isMounted = true;
    const autoSync = async () => {
      try {
        const res = await fetch("/api/connections/sync", { method: "POST" });
        if (res.ok && isMounted) {
          fetchConnections();
        }
      } catch (e) {
        console.error("Auto-sync failed", e);
      }
    };
    
    // Only fire if we have connections loaded, to check if we are missing any
    if (Object.keys(connections).length > 0) {
      // Just fire a background sync silently
      autoSync();
    }
  }, [session]); // Runs when session loads

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
        
        // Initialize inputs with existing handles
        const initialInputs: Record<string, string> = {};
        data.forEach((c: Connection) => {
          if (c.connected && c.source === "handle") {
            initialInputs[c.platform] = c.handle;
          }
        });
        setInputs(initialInputs);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleConnect = async (platformId: string, source: string) => {
    if (source === "oauth") {
      await signIn(platformId);
      return;
    }

    const handle = inputs[platformId];
    if (!handle) return;

    setSyncing((prev) => ({ ...prev, [platformId]: true }));
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId, handle }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to connect");
      }

      toast(`Successfully linked ${platformId}.`, "success");
      
      // Immediately trigger a sync for this new platform
      await fetch("/api/connections/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });
      
      await fetchConnections();
    } catch (error: any) {
      toast(error.message, "error");
    } finally {
      setSyncing((prev) => ({ ...prev, [platformId]: false }));
    }
  };

  const handleDisconnect = async (platformId: string, source: string) => {
    if (source === "oauth") {
      toast("Disconnect OAuth platforms in your provider settings.", "info");
      return;
    }

    setSyncing((prev) => ({ ...prev, [platformId]: true }));
    try {
      const res = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });
      if (res.ok) {
        toast(`Unlinked ${platformId}.`, "info");
        setInputs((prev) => {
          const next = { ...prev };
          delete next[platformId];
          return next;
        });
        await fetchConnections();
      }
    } finally {
      setSyncing((prev) => ({ ...prev, [platformId]: false }));
    }
  };

  const syncAll = async () => {
    setSyncing({ all: true });
    try {
      const res = await fetch("/api/connections/sync", { method: "POST" });
      const data = await res.json();
      toast(`Successfully synced ${data.synced}/${data.total} platforms.`, "success");
      await fetchConnections();
    } finally {
      setSyncing({});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Link your developer profiles to give AI agents context about your skills.
          </p>
        </div>
        <Button onClick={syncAll} disabled={syncing.all} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing.all ? "animate-spin" : ""}`} />
          Sync All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const connection = connections.find((c) => c.platform === platform.id);
          const isConnected = connection?.connected;
          const isSyncing = syncing[platform.id];

          return (
            <Card key={platform.id} className="relative overflow-hidden group border-white/5 bg-black/20 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {platform.name}
                  </CardTitle>
                  {isConnected && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </div>
                <CardDescription className="text-xs">
                  {isConnected && connection.lastSyncedAt 
                    ? `Synced: ${new Date(connection.lastSyncedAt).toLocaleDateString()}` 
                    : "Not connected"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {platform.source === "oauth" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isConnected ? "outline" : "default"}
                      className="w-full"
                      onClick={() => isConnected ? handleDisconnect(platform.id, platform.source) : handleConnect(platform.id, platform.source)}
                    >
                      {isConnected ? (
                        <>
                          <Unlink className="w-4 h-4 mr-2" /> Disconnect
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4 mr-2" /> Connect via OAuth
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Username / Handle"
                        value={inputs[platform.id] || ""}
                        onChange={(e) => setInputs((p) => ({ ...p, [platform.id]: e.target.value }))}
                        disabled={isConnected || isSyncing}
                        className="bg-black/40 border-white/10"
                      />
                    </div>
                    {isConnected ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            if (connection?.profileUrl) {
                              window.open(connection.profileUrl, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          View Profile
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect(platform.id, platform.source)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleConnect(platform.id, platform.source)}
                        disabled={!inputs[platform.id] || isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
