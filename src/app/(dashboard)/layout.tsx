import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | ProjectMatch",
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user && process.env.NODE_ENV === "production") {
      redirect("/login");
    }

    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  } catch (err: unknown) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-red-500 mb-4">DEBUG: Dashboard Layout Error</h1>
        <pre className="bg-red-950/50 text-red-200 p-4 rounded-xl text-xs overflow-auto whitespace-pre-wrap">
          {message}
          {"\n\n"}
          {stack}
        </pre>
      </div>
    );
  }
}
