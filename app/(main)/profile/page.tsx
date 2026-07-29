"use client";

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AuthContext } from "@/app/lib/contexts";

export default function ProfilePage() {
  const router = useRouter();
  const { userProfile, isSignedIn } = useContext(AuthContext);
  const { update } = useSession();
  const refreshed = useRef(false);

  // If signed in but handle is missing, force a session refresh.
  // This triggers the JWT callback's backfill logic which fetches handle from DB.
  // AuthSyncWrapper will then re-set userProfile with the updated handle.
  useEffect(() => {
    if (isSignedIn && !userProfile?.handle?.trim() && !refreshed.current) {
      refreshed.current = true;
      update();
    }
  }, [isSignedIn, userProfile?.handle, update]);

  // Redirect to the user's profile page when handle becomes available
  useEffect(() => {
    const handle = userProfile?.handle?.trim();
    if (handle) {
      router.replace(`/${handle}`);
    }
  }, [router, userProfile?.handle]);

  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" />
    </main>
  );
}
