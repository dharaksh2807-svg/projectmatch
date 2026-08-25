import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-secondary/80 border border-border/80 flex items-center justify-center mb-6 text-primary shadow-xl shadow-primary/5">
        <Compass className="w-10 h-10 animate-spin-slow text-primary" />
      </div>

      <span className="text-xs uppercase tracking-widest font-bold text-primary mb-2">
        404 — Page Not Found
      </span>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
        Lost in the codebase?
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        The page you are looking for doesn&apos;t exist or has been moved. Explore open projects or return to the dashboard.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/discover">
          <Button className="brand-gradient text-white gap-2 font-medium shadow-sm hover:opacity-90 transition-all">
            <Search className="w-4 h-4" />
            Discover Projects
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
