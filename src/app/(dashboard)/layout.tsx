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
}
