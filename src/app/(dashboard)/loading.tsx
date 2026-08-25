import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>

      {/* Stats/Quick Actions skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-2xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-44 rounded-lg" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl border border-border/50 p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3 w-72 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-4">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
