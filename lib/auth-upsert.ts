import { prisma } from "@/lib/prisma";

export type OAuthProfile = {
  email: string;
  name?: string | null;
  picture?: string | null;
  emailVerified?: boolean;
};

export type LinkAccountInput = {
  provider: string;
  providerAccountId: string;
  type?: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
};

/**
 * Find-or-create a User by email for an OAuth sign-in, and link the provider Account row.
 * Returns the resolved DB user. Throws on banned accounts; reactivates deactivated accounts.
 */
export async function upsertOAuthUser(
  profile: OAuthProfile,
  account: LinkAccountInput
) {
  if (!profile.email) throw new Error("OAUTH_NO_EMAIL");

  let dbUser = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!dbUser) {
    const maxId = await prisma.user.aggregate({ _max: { id: true } });
    const newId = (maxId._max.id ?? 0) + 1;

    const emailName = profile.email.split("@")[0];
    const baseName = (profile.name || emailName)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20);
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
        avatar: profile.picture || "",
        emailVerified: new Date(),
      },
    });
  } else if (!dbUser.avatar && profile.picture) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { avatar: profile.picture },
    });
  }

  if (dbUser.banned) {
    throw new Error("ACCOUNT_BANNED");
  }

  if (dbUser.deactivatedAt) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { deactivatedAt: null, reactivationDate: null },
    });
  }

  const existing = await prisma.account.findFirst({
    where: { provider: account.provider, providerAccountId: account.providerAccountId },
  });

  if (!existing) {
    await prisma.account.create({
      data: {
        userId: dbUser.id,
        type: account.type || "oauth",
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? null,
        access_token: account.access_token ?? null,
        expires_at: account.expires_at ?? null,
        token_type: account.token_type ?? null,
        scope: account.scope ?? null,
        id_token: account.id_token ?? null,
        session_state: account.session_state ?? null,
      },
    });
  }

  return dbUser;
}
