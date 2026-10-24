import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { NotificationsProvider } from "@/components/providers/notifications-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://projectmatch-phi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ProjectMatch — Find Your Dream Team",
    template: "%s | ProjectMatch",
  },
  description:
    "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
  keywords: [
    "team formation",
    "hackathon",
    "project team",
    "skill matching",
    "collaboration",
    "developer matchmaking",
    "hackathon teams",
  ],
  authors: [{ name: "ProjectMatch Team" }],
  creator: "ProjectMatch",
  publisher: "ProjectMatch",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "ProjectMatch",
    title: "ProjectMatch — Find Your Dream Team",
    description:
      "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ProjectMatch — Find Your Dream Team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProjectMatch — Find Your Dream Team",
    description:
      "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
    creator: "@projectmatch",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-primary/20 selection:text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ToastProvider>
              <NotificationsProvider>{children}</NotificationsProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
