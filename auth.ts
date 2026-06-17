import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/email";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: {
        idToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        const idToken = credentials?.idToken as string | undefined;
        if (!idToken) return null;

        let firebaseUser;
        try {
          firebaseUser = await verifyFirebaseIdToken(idToken);
        } catch {
          return null;
        }

        let dbUser = await prisma.user.findUnique({
          where: { email: firebaseUser.email },
        });

        if (!dbUser) {
          const maxId = await prisma.user.aggregate({ _max: { id: true } });
          const newId = (maxId._max.id ?? 0) + 1;

          const emailName = firebaseUser.email.split("@")[0];
          const baseName = (firebaseUser.name || emailName).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
          let handle = baseName || "user";
          const taken = await prisma.user.findUnique({ where: { handle } });
          if (taken) handle = `${handle}${Date.now() % 10000}`;

          dbUser = await prisma.user.create({
            data: {
              id: newId,
              name: firebaseUser.name || "User",
              email: firebaseUser.email,
              handle,
              password: "",
              title: "",
              avatar: firebaseUser.picture || "",
              emailVerified: firebaseUser.email_verified ? new Date() : null,
            },
          });
        } else {
          if (!dbUser.avatar && firebaseUser.picture) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { avatar: firebaseUser.picture },
            });
            dbUser.avatar = firebaseUser.picture;
          }
        }

        if (dbUser.banned) throw new Error("ACCOUNT_BANNED");

        if (dbUser.deactivatedAt) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { deactivatedAt: null, reactivationDate: null },
          });
        }

        return {
          id: dbUser.id.toString(),
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.avatar,
        };
      },
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
        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

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
  ],
  session: { strategy: "jwt" },
  callbacks: {
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
          (session.user as any).circleWelcomeSeen = dbUser.circleWelcomeSeen;
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
