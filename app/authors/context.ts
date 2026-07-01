"use client";

import { createContext, useContext } from "react";

export interface AuthorUser {
  id: number;
  name: string;
  handle: string;
  role: string;
  avatar?: string;
  title?: string;
  canPost?: boolean;
}

export interface AuthorContextValue {
  user: AuthorUser | null;
  loading: boolean;
}

export const AuthorContext = createContext<AuthorContextValue>({ user: null, loading: true });

export function useAuthorContext() {
  return useContext(AuthorContext);
}
