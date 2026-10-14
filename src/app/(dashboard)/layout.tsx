import { Sidebar } from "@/components/shared/sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | ProjectMatch",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}

