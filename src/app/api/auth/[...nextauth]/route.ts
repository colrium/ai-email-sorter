import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/db/prisma";
import { encrypt } from "@/lib/utils/encryption";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Gmail scopes
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          // Force consent screen to get refresh token
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      try {
        if (!account || account.provider !== "google") {
          return false;
        }

        // Check if user exists
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // Create user if doesn't exist
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
            },
          });
        } else {
          // Update user info
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name,
              image: user.image,
            },
          });
        }

        // Check if Gmail account already connected
        const existingAccount = await prisma.gmailAccount.findFirst({
          where: {
            userId: dbUser.id,
            email: user.email!,
          },
        });

        if (existingAccount) {
          // Update tokens
          await prisma.gmailAccount.update({
            where: { id: existingAccount.id },
            data: {
              accessToken: encrypt(account.access_token!),
              refreshToken: account.refresh_token
                ? encrypt(account.refresh_token)
                : existingAccount.refreshToken,
              tokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scope: account.scope,
            },
          });
        } else {
          // Create new Gmail account connection
          const isPrimary =
            (await prisma.gmailAccount.count({
              where: { userId: dbUser.id },
            })) === 0;

          await prisma.gmailAccount.create({
            data: {
              userId: dbUser.id,
              email: user.email!,
              accessToken: encrypt(account.access_token!),
              refreshToken: account.refresh_token
                ? encrypt(account.refresh_token)
                : null,
              tokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scope: account.scope,
              isPrimary,
            },
          });
        }

        return true;
      } catch (error) {
        console.error("Sign in error:", error);
        return false;
      }
    },

    async session({ session, token }) {
      if (token && session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
          include: {
            gmailAccounts: {
              select: {
                id: true,
                email: true,
                isPrimary: true,
              },
            },
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.email = dbUser.email;
          session.user.gmailAccounts = dbUser.gmailAccounts;
        }
      }
      return session;
    },

    async jwt({ token, account, user }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
