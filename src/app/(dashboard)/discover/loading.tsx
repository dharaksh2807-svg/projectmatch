import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filter Skeleton */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl border border-border/50 p-5 space-y-6">
            <Skeleton className="h-5 w-24 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16 rounded" />
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-7 w-16 rounded-lg" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-lg" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-7 w-14 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Roles Grid Skeleton */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-44 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="glass-card rounded-2xl border border-border/50 p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-5/6 rounded" />
                </div>

                <div className="space-y-3 pt-3 border-t border-border/30">
                  <div className="flex gap-1.5 flex-wrap">
                    <Skeleton className="h-5 w-12 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-14 rounded" />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-6 h-6 rounded-full" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </div>
                    <Skeleton className="h-8 w-18 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
