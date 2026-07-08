import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/auth-crypto";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { authConfig } from "./auth.config";
import { blobStorageService } from "@/lib/blob-storage";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          role: dbUser.role,
        };
      },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;

        const valid = await comparePassword(credentials.password as string, user.password);
        if (!valid) return null;

        if (user.banned) throw new Error("ACCOUNT_BANNED");
        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

        if (user.twoFactorEnabled) {
          const twoFactorCode = credentials.twoFactorCode as string | undefined;
          if (!twoFactorCode) throw new Error("2FA_REQUIRED");
          if (
            !user.twoFactorEmailCode ||
            !user.twoFactorEmailCodeExpiry ||
            user.twoFactorEmailCodeExpiry < new Date() ||
            user.twoFactorEmailCode !== String(twoFactorCode)
          ) {
            throw new Error("2FA_INVALID");
          }
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEmailCode: null, twoFactorEmailCodeExpiry: null },
          });
        }

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
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }: any) {
      if (trigger === "signIn" && user?.id) {
        // Fetch all session-relevant fields once at sign-in and store them in the JWT
        // so the session() callback never needs to hit the DB on every page request (H-18)
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: parseInt(user.id) },
            select: {
              sessionVersion: true,
              role: true,
              canPost: true,
              handle: true,
              title: true,
              avatar: true,
              verified: true,
              isPremium: true,
              circleWelcomeSeen: true,
            },
          });
          if (dbUser) {
            token.sessionVersion = dbUser.sessionVersion ?? 1;
            token.role = dbUser.role;
            token.canPost = dbUser.canPost;
            token.handle = dbUser.handle;
            token.title = dbUser.title;
            token.avatar = blobStorageService.resolveMediaUrl(dbUser.avatar) ?? dbUser.avatar;
            token.verified = dbUser.verified;
            token.isPremium = dbUser.isPremium;
            token.circleWelcomeSeen = dbUser.circleWelcomeSeen ?? true;
          }
        } catch {}
        token.sub = user.id?.toString();
      }
      // On explicit session update trigger, re-fetch to get fresh values
      if (trigger === "update" && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: parseInt(token.sub) },
            select: {
              sessionVersion: true,
              role: true,
              canPost: true,
              handle: true,
              title: true,
              avatar: true,
              verified: true,
              isPremium: true,
              circleWelcomeSeen: true,
            },
          });
          if (dbUser) {
            token.sessionVersion = dbUser.sessionVersion ?? 1;
            token.role = dbUser.role;
            token.canPost = dbUser.canPost;
            token.handle = dbUser.handle;
            token.title = dbUser.title;
            token.avatar = blobStorageService.resolveMediaUrl(dbUser.avatar) ?? dbUser.avatar;
            token.verified = dbUser.verified;
            token.isPremium = dbUser.isPremium;
            token.circleWelcomeSeen = dbUser.circleWelcomeSeen ?? true;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user && token.sub) {
        // Hydrate session entirely from the JWT — no DB query needed here (H-18)
        (session.user as any).id = parseInt(token.sub);
        (session.user as any).role = token.role;
        (session.user as any).sessionVersion = token.sessionVersion ?? 1;
        (session.user as any).canPost = token.canPost;
        (session.user as any).handle = token.handle;
        (session.user as any).title = token.title;
        (session.user as any).avatar = token.avatar;
        (session.user as any).verified = token.verified;
        (session.user as any).isPremium = token.isPremium;
        (session.user as any).circleWelcomeSeen = token.circleWelcomeSeen ?? true;
      }
      return session;
    },
  },
});
