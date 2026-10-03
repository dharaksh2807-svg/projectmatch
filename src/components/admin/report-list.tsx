"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldBan, CheckCircle, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface Report {
  id: string;
  reporter: { id: string; name: string; email: string };
  reportedUser?: { id: string; name: string; email: string; isBanned: boolean };
  project?: { id: string; title: string };
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
}

export function ReportList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const updateStatus = async (id: string, status: "RESOLVED" | "DISMISSED") => {
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchReports();
  };

  const toggleBan = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? "unban" : "ban"} this user?`)) return;
    
    await fetch(`/api/admin/users/${userId}/ban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBanned: !currentStatus }),
    });
    fetchReports();
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" />;

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-semibold">No Reports</h3>
          <p className="text-muted-foreground mt-1">All clear! No pending reports to review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <Badge variant={report.status === "PENDING" ? "destructive" : "secondary"}>
                  {report.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Reported on {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="text-sm">
                <span className="font-medium">Reporter:</span> {report.reporter.name} ({report.reporter.email})
              </div>

              {report.reportedUser && (
                <div className="text-sm flex items-center gap-2">
                  <span className="font-medium text-destructive">Reported User:</span> 
                  <Link href={`/profile/${report.reportedUser.id}`} className="hover:underline flex items-center gap-1">
                    {report.reportedUser.name} <ExternalLink className="w-3 h-3" />
                  </Link>
                  {report.reportedUser.isBanned && (
                    <Badge variant="destructive" className="text-[10px] h-5">BANNED</Badge>
                  )}
                </div>
              )}

              {report.project && (
                <div className="text-sm flex items-center gap-2">
                  <span className="font-medium text-amber-500">Reported Project:</span>
                  <Link href={`/projects/${report.project.id}`} className="hover:underline flex items-center gap-1">
                    {report.project.title} <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              <div className="mt-2 p-3 bg-muted/40 rounded-md border text-sm text-foreground/90 italic">
                "{report.reason}"
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[140px]">
              {report.status === "PENDING" && (
                <>
                  <Button size="sm" onClick={() => updateStatus(report.id, "RESOLVED")}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(report.id, "DISMISSED")}>
                    Dismiss
                  </Button>
                </>
              )}
              {report.reportedUser && (
                <Button 
                  size="sm" 
                  variant={report.reportedUser.isBanned ? "outline" : "destructive"}
                  className="gap-2 mt-4"
                  onClick={() => toggleBan(report.reportedUser!.id, report.reportedUser!.isBanned)}
                >
                  <ShieldBan className="w-4 h-4" /> 
                  {report.reportedUser.isBanned ? "Unban User" : "Ban User"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
