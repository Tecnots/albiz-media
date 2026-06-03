import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/email";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Credentials({
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

        if (user.banned) throw new Error("ACCOUNT_BANNED");

        if (user.deactivatedAt) {
          await prisma.user.update({
            where: { id: user.id },
            data: { deactivatedAt: null, reactivationDate: null },
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
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        try {
          const decoded = await verifyFirebaseIdToken(credentials.idToken as string);
          if (!decoded?.email) return null;

          let user = await prisma.user.findUnique({
            where: { email: decoded.email },
          });

          if (!user) {
            const maxId = await prisma.user.aggregate({ _max: { id: true } });
            const newId = (maxId._max.id ?? 0) + 1;

            const emailName = decoded.email.split("@")[0];
            const baseName = (decoded.name || emailName).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
            let handle = baseName || "user";
            const taken = await prisma.user.findUnique({ where: { handle } });
            if (taken) handle = `${handle}${Date.now() % 10000}`;

            user = await prisma.user.create({
              data: {
                id: newId,
                name: decoded.name || "User",
                email: decoded.email,
                handle,
                password: "",
                title: "",
                avatar: decoded.picture || "",
                emailVerified: new Date(),
              },
            });
          }

          if (user.banned) throw new Error("ACCOUNT_BANNED");

          if (user.deactivatedAt) {
            await prisma.user.update({
              where: { id: user.id },
              data: { deactivatedAt: null, reactivationDate: null },
            });
          }

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            image: user.avatar,
          };
        } catch (error) {
          console.error("[Firebase Auth] Error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google" && profile?.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
          });

          if (!dbUser) {
            const maxId = await prisma.user.aggregate({ _max: { id: true } });
            const newId = (maxId._max.id ?? 0) + 1;

            const emailName = profile.email.split("@")[0];
            const baseName = (profile.name || emailName).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
            let handle = baseName || "user";
            const taken = await prisma.user.findUnique({ where: { handle } });
            if (taken) handle = `${handle}${Date.now() % 10000}`;

            dbUser = await prisma.user.create({
              data: {
                id: newId,
                name: profile.name || "User",
                email: profile.email,
                handle,
                password: "",
                title: "",
                avatar: profile.picture || profile.image || "",
                emailVerified: new Date(),
              },
            });
          } else {
            if (!dbUser.avatar && (profile.picture || profile.image)) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { avatar: profile.picture || profile.image || "" },
              });
            }
          }

          const existingAccount = await prisma.account.findFirst({
            where: { provider: "google", providerAccountId: account.providerAccountId },
          });

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token || null,
                access_token: account.access_token || null,
                expires_at: account.expires_at || null,
                token_type: account.token_type || null,
                scope: account.scope || null,
                id_token: account.id_token || null,
                session_state: account.session_state || null,
              },
            });
          }

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
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});
