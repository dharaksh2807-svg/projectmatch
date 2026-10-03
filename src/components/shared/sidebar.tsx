"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  User,
  LogOut,
  Sparkles,
  ChevronRight,
  Bell,
  Swords,
  Trophy,
  MessageSquare,
  UserCheck,
  Menu,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/providers/notifications-provider";

const navItems = [
  { href: "/discover", icon: Sparkles, label: "Discover" },
  { href: "/hackathons", icon: Trophy, label: "Hackathons" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/applications", icon: UserCheck, label: "Applications" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: Sparkles, label: "Agent Chat" },
  { href: "/prompt-battles", icon: Swords, label: "Prompt Battles" },
  { href: "/profile", icon: User, label: "My Profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const navigationList = (onNavigate?: () => void) => (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Site navigation">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => onNavigate?.()}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110",
                isActive && "text-primary"
              )}
              aria-hidden="true"
            />
            <span>{label}</span>
            {isActive && (
              <ChevronRight
                className="w-3 h-3 ml-auto text-primary/60"
                aria-hidden="true"
              />
            )}
          </Link>
        );
      })}
      
      {session?.user?.role === "ADMIN" && (
        <div className="pt-4 mt-4 border-t">
          <Link
            href="/admin"
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              pathname.startsWith("/admin")
                ? "bg-destructive/15 text-destructive"
                : "text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Admin Dashboard</span>
          </Link>
        </div>
      )}
    </nav>
  );

  const userFooter = (
    <div className="p-4 border-t border-border/50 space-y-2 shrink-0">
      <Link
        href="/notifications"
        onClick={() => setMobileOpen(false)}
        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="View Notifications"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-4 h-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
              </span>
            )}
          </div>
          <span>Notifications</span>
        </div>
        {unreadCount > 0 && (
          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      {status === "loading" ? (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl animate-pulse">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-2.5 bg-muted rounded w-32" />
          </div>
        </div>
      ) : session?.user ? (
        <>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            {session.user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-8 h-8 rounded-full ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">
                {(session.user.name || session.user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out of ProjectMatch"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </>
      ) : (
        <Link
          href="/login"
          onClick={() => setMobileOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Sign in to ProjectMatch"
        >
          <User className="w-4 h-4" aria-hidden="true" />
          <span>Sign In</span>
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          MOBILE TOP NAVBAR (< md)
          ───────────────────────────────────────────────────────────── */}
      <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-border/50 bg-sidebar/95 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-sidebar-foreground"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            } />
            <SheetContent side="left" className="w-72 p-0 bg-sidebar border-border/60 text-sidebar-foreground flex flex-col h-full">
              <div className="h-14 flex items-center justify-between px-6 border-b border-border/50">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center glow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-sm tracking-tight">ProjectMatch</span>
                </Link>
                <ModeToggle />
              </div>
              {navigationList(() => setMobileOpen(false))}
              {userFooter}
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center glow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">ProjectMatch</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP SIDEBAR (>= md)
          ───────────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border/50 bg-sidebar h-full"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center glow-sm">
              <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-base tracking-tight">ProjectMatch</span>
          </Link>
          <ModeToggle />
        </div>

        {/* Navigation */}
        {navigationList()}

        {/* User section */}
        {userFooter}
      </aside>
    </>
  );
}
