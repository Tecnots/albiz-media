"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/app/lib/contexts";
import { users } from "@/app/lib/data";

export default function ProfilePage() {
  const router = useRouter();
  const { currentUserId, isSignedIn } = useContext(AuthContext);

  useEffect(() => {
    if (!isSignedIn) { router.replace("/"); return; }
    const user = users.find(u => u.id === currentUserId);
    router.replace(user ? `/${user.handle}` : "/");
  }, [currentUserId, isSignedIn, router]);

  return (
    <main className="flex-1 min-w-0 bg-white overflow-y-auto flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#e5e5e5] border-t-[#F44444] rounded-full animate-spin" />
    </main>
  );
}
