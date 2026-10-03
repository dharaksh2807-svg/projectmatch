"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flag, Loader2 } from "lucide-react";

interface ReportModalProps {
  reportedUserId?: string;
  projectId?: string;
  targetName: string;
}

export function ReportModal({ reportedUserId, projectId, targetName }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.length < 5) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, projectId, reason }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setReason("");
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Flag className="w-4 h-4 mr-2" /> Report
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report {targetName}</DialogTitle>
        </DialogHeader>
        
        {success ? (
          <div className="py-6 text-center text-emerald-500 font-medium">
            Thank you! Your report has been submitted and will be reviewed by our team.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason for reporting
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 border rounded-md bg-transparent text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Please describe why you are reporting this..."
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading || reason.length < 5}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Report
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
