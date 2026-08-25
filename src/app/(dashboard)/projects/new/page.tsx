import { ProjectForm } from "@/components/projects/project-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Project" };

export default function NewProjectPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          My Projects
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Post a New Project</h1>
        <p className="text-muted-foreground text-sm">
          Define your project and the roles you need. Our matching engine will surface the best
          candidates for each role.
        </p>
      </div>

      <div className="border-t border-border/50 mb-8" />

      <ProjectForm />
    </div>
  );
}
