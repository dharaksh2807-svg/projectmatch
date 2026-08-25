import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

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

export const metadata: Metadata = {
  title: {
    default: "ProjectMatch — Find Your Dream Team",
    template: "%s | ProjectMatch",
  },
  description:
    "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
  keywords: ["team formation", "hackathon", "project team", "skill matching", "collaboration"],
  openGraph: {
    type: "website",
    siteName: "ProjectMatch",
    title: "ProjectMatch — Find Your Dream Team",
    description:
      "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProjectMatch — Find Your Dream Team",
    description:
      "Connect with talented individuals and project owners. Find your perfect team based on skills, interests, and availability.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
