import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Users,
  Zap,
  Star,
  Compass,
  Bot,
  Clock,
  Layers,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
          ───────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">ProjectMatch</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/discover"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary hidden sm:inline-flex"
            >
              Discover Roles
            </Link>
            <Link
              href="/hackathons"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary hidden sm:inline-flex"
            >
              Hackathons
            </Link>
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
            >
              Sign In
            </Link>
            <Link href="/login">
              <Button size="sm" className="font-semibold shadow-xs">
                Get Started
              </Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ─────────────────────────────────────────────────────────────
            2. FOCUSED HERO SECTION
            ───────────────────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20 border-b border-border/60 bg-gradient-to-b from-secondary/40 via-background to-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Skill-Based Team Formation Platform</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
              Find your ideal teammates.{" "}
              <span className="text-primary">Build something exceptional.</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              ProjectMatch connects students, developers, designers, and researchers with
              open project roles — matched algorithmically on skills, availability, and
              experience.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link href="/discover" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-xs">
                  <Compass className="w-4 h-4" />
                  Find a Project
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 font-semibold">
                  <Users className="w-4 h-4 text-primary" />
                  Build a Team
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            3. COMPACT PRODUCT PREVIEW (CLEARLY LABELED AS EXAMPLE)
            ───────────────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-6">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary px-2.5 py-1 rounded-full border border-border">
              Illustrative Preview — Example Role Listing
            </span>
          </div>

          <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="purple">Hackathon</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 1–3 months
                  </span>
                </div>
                <h3 className="font-semibold text-base sm:text-lg text-foreground mt-1.5">
                  Full-Stack TypeScript & AI Engineer
                </h3>
                <p className="text-xs text-muted-foreground">
                  In project: <span className="text-foreground font-medium">Smart MedAssist</span> by Alex Chen
                </p>
              </div>

              <Badge variant="success" className="text-xs">
                92% Compatibility Fit
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Looking for a collaborator experienced with Next.js App Router and Python backend APIs to build an offline-first assistive diagnosis prototype for an upcoming national hackathon.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Next.js", "TypeScript", "Python", "FastAPI", "Tailwind CSS"].map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md bg-secondary text-foreground text-xs font-medium border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Part-time (10–15 hrs/wk) · 1 open spot</span>
              <span className="font-semibold text-primary inline-flex items-center gap-1">
                View Role Details <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            4. THREE-STEP WORKFLOW
            ───────────────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16 border-t border-border/60 bg-secondary/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                How ProjectMatch Works
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                A structured, transparent pathway from concept to high-performing team.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  1
                </div>
                <h3 className="font-semibold text-base text-foreground">Build Your Profile</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  List your verified technical skills, experience level, weekly availability, and portfolio links.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  2
                </div>
                <h3 className="font-semibold text-base text-foreground">Discover Opportunities</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Browse open team vacancies scored algorithmically against your profile, or post your own project roles.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  3
                </div>
                <h3 className="font-semibold text-base text-foreground">Apply & Collaborate</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Send applications with proof-of-work links, chat with teammates directly, and build peer reputation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            5. CORE PLATFORM CAPABILITIES
            ───────────────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Built for Engineering Excellence
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Practical developer features designed to remove team friction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Deterministic Compatibility Matching</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evaluates weighted skill overlap, experience fit, time availability, and domain interests. Transparent factors instead of arbitrary black-box scores.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Granular Role-Based Recruitment</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Project owners define specific vacancies with required technologies and exact weekly hours. Find the missing puzzle piece, not just anyone available.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Star className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Peer-Reviewed Reputation</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Teammates endorse skills and rate collaboration after project milestones. Build verifiable reputation capital that showcases interpersonal reliability.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Multi-Model AI Workspace (BYOK)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use your personal API keys for Google Gemini, Anthropic Claude, and OpenAI. Run side-by-side prompt battles to evaluate code and architecture designs.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            6. CONCISE CLOSING CALL TO ACTION
            ───────────────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-16 border-t border-border bg-gradient-to-b from-secondary/30 to-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Ready to assemble your project squad?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
              Join students, developers, and researchers building impactful software projects and winning hackathons.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link href="/login">
                <Button size="lg" className="font-semibold shadow-xs">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/hackathons">
                <Button variant="outline" size="lg" className="font-semibold">
                  Browse Hackathons
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          7. MINIMAL FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-6 bg-background text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
              P
            </div>
            <span>© {new Date().getFullYear()} ProjectMatch. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/discover" className="hover:text-foreground transition-colors">
              Discover
            </Link>
            <Link href="/hackathons" className="hover:text-foreground transition-colors">
              Hackathons
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
