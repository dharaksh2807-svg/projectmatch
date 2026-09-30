import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard — Prompt Wars" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Welcome back, {session.user.name?.split(" ")[0] || "Builder"} 👋
      </h1>
      <p className="text-muted-foreground">
        Your AI Agent workspace is ready. Head to the chat to get started.
      </p>
    </div>
  );
}