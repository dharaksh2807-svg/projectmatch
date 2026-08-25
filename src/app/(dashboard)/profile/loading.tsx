import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Profile Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
          <Skeleton className="h-4 w-36 rounded-full" />
        </div>
      </div>

      <div className="border-t border-border/50" />

      {/* Form Fields Skeleton */}
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-16 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <div className="pt-4 flex justify-end">
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
