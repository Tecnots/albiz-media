import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/",
    error: "/",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }: any) {
      if (trigger === "signIn" && user?.id) {
        token.sub = user.id?.toString();
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token?.sub) {
        if (!session.user) session.user = {} as any;
        (session.user as any).id = parseInt(token.sub);
        (session.user as any).role = token.role;
        (session.user as any).sessionVersion = token.sessionVersion ?? 1;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
