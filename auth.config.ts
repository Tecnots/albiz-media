import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/",
    error: "/",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
