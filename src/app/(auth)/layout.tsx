import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to ProjectMatch to find your perfect team.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-chart-5/10 blur-[100px]" />
      </div>
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
