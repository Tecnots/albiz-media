import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/email";
import { upsertOAuthUser } from "@/lib/auth-upsert";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

const options = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      id: "firebase",
      name: "firebase",
      credentials: {
        idToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;
        try {
          const decoded = await verifyFirebaseIdToken(credentials.idToken as string);
          if (!decoded.email) throw new Error("FIREBASE_NO_EMAIL");

          const dbUser = await upsertOAuthUser(
            {
              email: decoded.email,
              name: (decoded.name as string) || decoded.email.split("@")[0],
              picture: (decoded.picture as string) || null,
              emailVerified: decoded.email_verified,
            },
            {
              provider: "firebase",
              providerAccountId: decoded.uid,
              type: "oauth",
            }
          );

          return {
            id: dbUser.id.toString(),
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.avatar,
          };
        } catch (err) {
          console.error("[NextAuth] Firebase authorize error:", err);
          if (err instanceof Error && err.message === "ACCOUNT_BANNED") throw err;
          return null;
        }
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;

        const valid = await comparePassword(credentials.password as string, user.password);
        if (!valid) return null;

        if (user.banned) {
          throw new Error("ACCOUNT_BANNED");
        }

        // Block sign-in until the user has verified their email
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Check if account is deactivated - allow immediate reactivation on sign-in
        if (user.deactivatedAt) {
          // Clear deactivation immediately when user signs in
          await prisma.user.update({
            where: { id: user.id },
            data: {
              deactivatedAt: null,
              reactivationDate: null,
            },
          });
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google" && profile?.email) {
        try {
          const dbUser = await upsertOAuthUser(
            {
              email: profile.email,
              name: profile.name,
              picture: profile.picture || profile.image || null,
              emailVerified: true,
            },
            {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              type: account.type,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            }
          );

          user.id = dbUser.id.toString();
          user.name = dbUser.name;
          user.email = dbUser.email;
          user.image = dbUser.avatar;

          return true;
        } catch (err) {
          console.error("[NextAuth] Google signIn error:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.id.toString();
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: parseInt(token.sub) } });
        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).role = dbUser.role;
          (session.user as any).canPost = dbUser.canPost;
          (session.user as any).handle = dbUser.handle;
          (session.user as any).title = dbUser.title;
          (session.user as any).avatar = dbUser.avatar;
          (session.user as any).verified = dbUser.verified;
          (session.user as any).isPremium = dbUser.isPremium;
<<<<<<< HEAD
=======
          (session.user as any).banned = dbUser.banned;
          (session.user as any).banReason = dbUser.banReason;
          (session.user as any).circleWelcomeSeen = dbUser.circleWelcomeSeen;
>>>>>>> efd3e02cd92e79252f920a387792772aff4cf23f
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(options as any);

export { handler as GET, handler as POST };
