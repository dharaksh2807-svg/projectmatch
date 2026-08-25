import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      <div className="flex gap-2 border-b border-border/40 pb-3">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl border border-border/50 p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-60 rounded" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border/30">
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
