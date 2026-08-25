import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        Loading ProjectMatch...
      </p>
    </div>
  );
}
