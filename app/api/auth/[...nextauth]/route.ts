import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const options = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (user: any) => {
      const maxId = await prisma.user.aggregate({ _max: { id: true } });
      const newId = (maxId._max.id ?? 0) + 1;
      
      const emailName = user.email ? user.email.split("@")[0] : "user";
      const handle = (user.name || emailName).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
        
      let finalHandle = handle || "user";
      const taken = await prisma.user.findUnique({ where: { handle: finalHandle } });
      if (taken) finalHandle = `${finalHandle}${Date.now() % 10000}`;
      
      return prisma.user.create({
        data: {
          id: newId,
          name: user.name || "User",
          email: user.email,
          handle: finalHandle,
          password: "",
          title: "",
          avatar: user.image || "",
          emailVerified: user.emailVerified || new Date(),
        }
      });
    }
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }: any) {
      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: parseInt(token.sub) } });
        if (dbUser) {
          (session.user as any).id = dbUser.id;
          (session.user as any).role = dbUser.role;
          (session.user as any).canPost = dbUser.canPost;
        }
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.id.toString();
      }
      return token;
    }
  },
  pages: {
    signIn: '/login', // Fallback to modal if possible, or standard login path
  }
};

const handler = NextAuth(options as any);

export { handler as GET, handler as POST };
