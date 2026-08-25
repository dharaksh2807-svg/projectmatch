import Link from "next/link";
import { ArrowRight, Sparkles, Users, Zap, Star, Code2, Palette, Brain } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Smart Matching",
    description:
      "Our algorithm scores compatibility across skills, availability, interests, and experience — not just keyword search.",
  },
  {
    icon: Users,
    title: "Role-Based Teams",
    description:
      "Project owners define exact roles they need. Find teammates who fill specific gaps, not just anyone available.",
  },
  {
    icon: Star,
    title: "Reputation System",
    description:
      "Post-project ratings build verifiable reputations. Work with people who have a proven track record.",
  },
  {
    icon: Sparkles,
    title: "Instant Recommendations",
    description:
      "As soon as you build your profile, get ranked project recommendations tailored to exactly who you are.",
  },
];

const useCases = [
  { icon: Code2, label: "Hackathons" },
  { icon: Brain, label: "Research" },
  { icon: Palette, label: "Startups" },
  { icon: Users, label: "Open Source" },
];

const stats = [
  { value: "2K+", label: "Projects Posted" },
  { value: "8K+", label: "Members" },
  { value: "94%", label: "Match Rate" },
  { value: "72hr", label: "Avg. Team Formed" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center glow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">ProjectMatch</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg brand-gradient text-white hover:opacity-90 transition-opacity glow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden py-32">
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-chart-5/10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 text-sm text-primary mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Team Formation</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
            Find your{" "}
            <span className="brand-gradient-text">perfect team.</span>
            <br />
            Ship something{" "}
            <span className="brand-gradient-text">great.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            ProjectMatch connects builders, designers, and researchers with the right
            projects — matched algorithmically on skills, availability, and experience.
            No more relying on who you already know.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              id="hero-cta-primary"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl brand-gradient text-white font-semibold text-lg hover:opacity-90 transition-all glow hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Matching
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/browse"
              id="hero-cta-secondary"
              className="flex items-center gap-2 px-8 py-4 rounded-xl glass border border-border hover:border-primary/30 text-foreground font-semibold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Browse Projects
            </Link>
          </div>

          {/* Use cases */}
          <div className="flex items-center justify-center gap-6 mt-12 flex-wrap">
            {useCases.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4 text-primary" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold brand-gradient-text mb-2">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Matching that actually works
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Built around a weighted compatibility algorithm — not just a directory of profiles.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group glass-card rounded-2xl p-6 hover:border-primary/20 hover:bg-white/5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center mb-4 glow-sm group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="brand-gradient p-px rounded-3xl">
              <div className="bg-background rounded-3xl p-12 text-center relative overflow-hidden">
                <div className="absolute inset-0 brand-gradient opacity-5" />
                <div className="relative">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                    Ready to find your team?
                  </h2>
                  <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                    Join thousands of builders who've found their dream collaborators on
                    ProjectMatch.
                  </p>
                  <Link
                    href="/login"
                    id="bottom-cta"
                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl brand-gradient text-white font-semibold text-lg hover:opacity-90 transition-all glow hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Create Your Profile
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md brand-gradient flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold">ProjectMatch</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ProjectMatch. Built to connect great teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
