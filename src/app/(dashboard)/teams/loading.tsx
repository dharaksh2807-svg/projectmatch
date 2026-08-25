import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-6 w-44 rounded" />
                <Skeleton className="h-4 w-60 rounded" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-3 pt-3 border-t border-border/30">
              <Skeleton className="h-4 w-28 rounded" />
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((m) => (
                  <Skeleton key={m} className="w-8 h-8 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
