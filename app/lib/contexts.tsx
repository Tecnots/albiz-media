"use client";

import { createContext } from "react";

export const FollowingContext = createContext<{
  following: Set<number>;
  toggleFollow: (userId: number) => void;
}>({ following: new Set(), toggleFollow: () => {} });

export const ArticleContext = createContext<{
  selectedArticle: number | null;
  setSelectedArticle: (id: number | null) => void;
}>({ selectedArticle: null, setSelectedArticle: () => {} });

export const CreatePostContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

export const CreateStoryContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

export type UserRoleType = "CIRCLE" | "NORMAL" | "ADMIN" | "AUTHOR" | null;

export const AuthContext = createContext<{
  isSignedIn: boolean;
  userRole: UserRoleType;
  currentUserId: number;
  signOut: () => void;
  signIn: (role?: UserRoleType, userId?: number) => void;
  openAuthModal: (mode: "signin" | "signup") => void;
}>({ isSignedIn: true, userRole: "CIRCLE", currentUserId: 1, signOut: () => {}, signIn: () => {}, openAuthModal: () => {} });
