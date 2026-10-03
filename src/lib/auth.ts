import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "demo-google-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "demo-google-secret",
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "demo-github-id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "demo-github-secret",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "alice@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        
        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Auto-create demo users if they don't exist
        if (!user && ["owner@example.com", "bob@example.com", "alice@example.com"].includes(credentials.email)) {
          const names: Record<string, string> = {
            "owner@example.com": "Eve Johnson",
            "bob@example.com": "Bob Kumar",
            "alice@example.com": "Alice Chen",
          };
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: names[credentials.email],
              reputationScore: 75,
            },
          });
        }

        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
