import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/app/lib/email";

const options = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
          // Find existing user by email
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
          });

          if (!dbUser) {
            // Create new user from Google profile
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
            // Update avatar from Google if user has none
            if (!dbUser.avatar && (profile.picture || profile.image)) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { avatar: profile.picture || profile.image || "" },
              });
            }
          }

          // Link Google account if not already linked
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

          // Set the user id so the jwt callback can use it
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
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(options as any);

export { handler as GET, handler as POST };
