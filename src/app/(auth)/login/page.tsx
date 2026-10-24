"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Sparkles, GitBranch, Globe, Loader2, ArrowLeft } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

import { cn } from "@/lib/utils";

const DEMO_USERS = [
  {
    name: "Eve Johnson (Project Owner)",
    email: "owner@example.com",
    role: "Owner of AI Study Companion",
    badge: "Project Lead",
  },
  {
    name: "Bob Kumar (ML Expert)",
    email: "bob@example.com",
    role: "Top Match for ML Engineer",
    badge: "Candidate",
  },
  {
    name: "Alice Chen (React / UI Dev)",
    email: "alice@example.com",
    role: "Owner of Open Source Tracker",
    badge: "Builder",
  },
];

function LoginForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/discover";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "signup") {
      setMode("signup");
    } else if (urlMode === "signin") {
      setMode("signin");
    }
  }, [searchParams]);

  useEffect(() => {
    if (session?.user) {
      router.replace(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  const handleSignIn = async (provider: string) => {
    setLoadingProvider(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setLoadingProvider(null);
    }
  };

  const handleDemoSignIn = async (email: string) => {
    setLoadingProvider(email);
    try {
      await signIn("credentials", {
        email,
        callbackUrl,
      });
    } catch {
      setLoadingProvider(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-slide-up max-w-md mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <ModeToggle />
      </div>

      {/* Card */}
      <div className="rounded-xl p-6 sm:p-8 border border-border bg-card shadow-xs">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3 shadow-xs">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "signup" ? "Join ProjectMatch" : "Welcome to ProjectMatch"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-xs">
            {mode === "signup"
              ? "Create your account to discover projects and teammates matched to your skills."
              : "Sign in to discover projects and teammates matched to your skills."}
          </p>
        </div>

        {/* Auth mode toggle tabs */}
        <div className="grid grid-cols-2 p-1 bg-secondary/60 rounded-xl mb-6 border border-border/50 text-xs font-semibold">
          <button
            type="button"
            id="tab-signin"
            onClick={() => setMode("signin")}
            className={cn(
              "py-1.5 rounded-lg transition-all text-center",
              mode === "signin"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-signup"
            onClick={() => setMode("signup")}
            className={cn(
              "py-1.5 rounded-lg transition-all text-center",
              mode === "signup"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Create Account
          </button>
        </div>

        {/* 1-Click Demo Personas for Instant Testing */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>{mode === "signup" ? "Instant Test Sign Up" : "Instant Test Login"}</span>
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Demo Mode
            </span>
          </div>

          <div className="space-y-2">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                onClick={() => handleDemoSignIn(user.email)}
                disabled={!!loadingProvider}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all text-left group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {user.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{user.role}</p>
                </div>
                {loadingProvider === user.email ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary ml-2" />
                ) : (
                  <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 rounded bg-background/80 border border-border/40 ml-2">
                    {user.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground font-medium">
              Or OAuth Providers
            </span>
          </div>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          <button
            id="signin-github"
            onClick={() => handleSignIn("github")}
            disabled={!!loadingProvider}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl glass border border-border hover:border-primary/30 hover:bg-white/5 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loadingProvider === "github" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GitBranch className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            {mode === "signup" ? "Sign up with GitHub" : "Continue with GitHub"}
          </button>

          <button
            id="signin-google"
            onClick={() => handleSignIn("google")}
            disabled={!!loadingProvider}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl glass border border-border hover:border-primary/30 hover:bg-white/5 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loadingProvider === "google" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Globe className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
          </button>
        </div>

        {/* Switcher link */}
        <div className="text-center mt-5 text-xs text-muted-foreground">
          {mode === "signup" ? (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-semibold text-primary hover:underline ml-1"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-semibold text-primary hover:underline ml-1"
              >
                Create one
              </button>
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          By continuing, you agree to our{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">
            Privacy Policy
          </span>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
