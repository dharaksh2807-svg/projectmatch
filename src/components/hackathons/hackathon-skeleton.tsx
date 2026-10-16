import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HackathonSkeletonGridProps {
  count?: number;
}

export function HackathonSkeletonGrid({ count = 6 }: HackathonSkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="border-border/60 bg-card/60 p-5 space-y-4 rounded-xl flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <Skeleton className="h-6 w-4/5 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />

            <div className="space-y-1.5 pt-2">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  );
}
