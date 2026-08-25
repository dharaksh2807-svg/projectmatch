import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-6 w-48 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-96 rounded" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="flex gap-4 pt-2 border-t border-border/30">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
