"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Search,
  FolderOpen,
  User,
  LogOut,
  Sparkles,
  ChevronRight,
  Bell,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/discover", icon: Search, label: "Discover" },
  { href: "/projects", icon: FolderOpen, label: "My Projects" },
  { href: "/teams", icon: Users, label: "My Teams" },
  { href: "/profile", icon: User, label: "My Profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border/50 bg-sidebar min-h-screen" aria-label="Main navigation">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center glow-sm">
            <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-base tracking-tight">ProjectMatch</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Site navigation">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
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
              />
              <span>{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary/60" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border/50 space-y-2">
        <Link
          href="/notifications"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-accent transition-all"
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </Link>

        {session?.user && (
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
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          aria-label="Sign out of ProjectMatch"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
