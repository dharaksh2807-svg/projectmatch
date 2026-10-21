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
  Bell,
  Swords,
  Trophy,
  MessageSquare,
  UserCheck,
  Menu,
  ShieldAlert,
  FolderGit2,
  Compass,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/providers/notifications-provider";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const navigationGroups: NavGroup[] = [
    {
      title: "Explore",
      items: [
        { href: "/discover", icon: Compass, label: "Discover" },
        { href: "/hackathons", icon: Trophy, label: "Hackathons" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { href: "/projects", icon: FolderGit2, label: "My Projects" },
        { href: "/applications", icon: UserCheck, label: "Applications" },
        {
          href: "/messages",
          icon: MessageSquare,
          label: "Messages",
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
      ],
    },
    {
      title: "AI Tools",
      items: [
        { href: "/chat", icon: Bot, label: "Agent Chat" },
        { href: "/prompt-battles", icon: Swords, label: "Prompt Battles" },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/profile", icon: User, label: "My Profile" },
        {
          href: "/notifications",
          icon: Bell,
          label: "Notifications",
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
      ],
    },
  ];

  const mobileBottomNavItems = [
    { href: "/discover", icon: Compass, label: "Discover" },
    { href: "/hackathons", icon: Trophy, label: "Hackathons" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/projects", icon: FolderGit2, label: "Projects" },
    { href: "/messages", icon: MessageSquare, label: "Messages", badge: unreadCount },
  ];

  const renderNavList = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto" aria-label="Site navigation">
      {navigationGroups.map((group) => (
        <div key={group.title} className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
            {group.title}
          </div>
          {group.items.map(({ href, icon: Icon, label, badge }) => {
            const isActive =
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => onNavigate?.()}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground font-medium"
                )}
              >
                {/* Non-color active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
                {typeof badge === "number" && badge > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {session?.user?.role === "ADMIN" && (
        <div className="pt-2 border-t border-border/60">
          <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Administration
          </div>
          <Link
            href="/admin"
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              pathname.startsWith("/admin")
                ? "bg-destructive/10 text-destructive font-semibold"
                : "text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Admin Center</span>
          </Link>
        </div>
      )}
    </nav>
  );

  const renderUserFooter = (onNavigate?: () => void) => (
    <div className="p-3 border-t border-border bg-sidebar shrink-0 space-y-2.5">
      {status === "loading" ? (
        <div className="flex items-center gap-3 px-2 py-1.5 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-2.5 bg-muted rounded w-28" />
          </div>
        </div>
      ) : session?.user ? (
        <div className="space-y-2">
          {/* User Account Tile */}
          <Link
            href="/profile"
            onClick={() => onNavigate?.()}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-secondary transition-colors group"
          >
            {session.user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt=""
                className="w-8 h-8 rounded-xl object-cover ring-1 ring-border shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {(session.user.name || session.user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {session.user.name || "User Profile"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
            </div>
          </Link>

          {/* Prominent, Clearly Discoverable Theme Switcher */}
          <div className="px-1">
            <ModeToggle showLabel={true} />
          </div>

          {/* Account Sub-actions */}
          <div className="flex items-center justify-between pt-0.5 px-2 text-xs">
            <Link
              href="/profile"
              onClick={() => onNavigate?.()}
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              aria-label="Sign out of ProjectMatch"
              className="flex items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-1">
          <ModeToggle showLabel={true} />
          <Link
            href="/login"
            onClick={() => onNavigate?.()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <User className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign In</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          MOBILE TOP BAR (< md)
          ───────────────────────────────────────────────────────────── */}
      <header className="flex md:hidden h-14 items-center justify-between px-3 border-b border-border bg-sidebar/95 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-foreground"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            } />
            <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-border text-foreground flex flex-col h-full">
              <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm tracking-tight">ProjectMatch</span>
                </Link>
              </div>
              {renderNavList(() => setMobileOpen(false))}
              {renderUserFooter(() => setMobileOpen(false))}
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight">ProjectMatch</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            )}
          </Link>
          <ModeToggle />
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE BOTTOM TOOLBAR (< md)
          ───────────────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-sidebar/95 backdrop-blur-md border-t border-border flex md:hidden items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Mobile primary navigation"
      >
        {mobileBottomNavItems.map(({ href, icon: Icon, label, badge }) => {
          const isActive =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-xs font-medium transition-colors relative min-w-[52px] min-h-[44px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-105 text-primary"
                  )}
                  aria-hidden="true"
                />
                {typeof badge === "number" && badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] mt-0.5", isActive && "font-bold text-primary")}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP SIDEBAR (>= md)
          Width: 240px (meets 232–248px constraint)
          ───────────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar h-full select-none"
        aria-label="Main navigation"
      >
        {/* Header with Brand Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-foreground">ProjectMatch</span>
              <span className="text-[10px] text-muted-foreground -mt-0.5">Team Collaboration</span>
            </div>
          </Link>
        </div>

        {/* Grouped Navigation List */}
        {renderNavList()}

        {/* User Account / Footer */}
        {renderUserFooter()}
      </aside>
    </>
  );
}
