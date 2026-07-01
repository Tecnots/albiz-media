"use client";

import { createContext, useContext } from "react";

export interface ShortsUser {
  id: number;
  name: string;
  handle: string;
  role: string;
  avatar?: string;
}

export interface ShortsContextValue {
  user: ShortsUser | null;
  loading: boolean;
}

export const ShortsContext = createContext<ShortsContextValue>({ user: null, loading: true });

export function useShortsContext() {
  return useContext(ShortsContext);
}
