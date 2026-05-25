"use client";

import { createContext } from "react";

export const FollowingContext = createContext<{
  following: Set<number>;
  toggleFollow: (userId: number) => void;
}>({ following: new Set(), toggleFollow: () => { } });

export const ArticleContext = createContext<{
  selectedArticle: number | null;
  setSelectedArticle: (id: number | null) => void;
}>({ selectedArticle: null, setSelectedArticle: () => { } });

export const CreatePostContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => { } });

export const CreateStoryContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => { } });

export type UserRoleType = "CIRCLE" | "NORMAL" | "ADMIN" | "AUTHOR" | null;

export type UserProfile = {
  name: string;
  avatar: string;
  title: string;
  handle: string;
  verified: boolean;
  isPremium: boolean;
  email: string;
  circleWelcomeSeen?: boolean;
} | null;

export const AuthContext = createContext<{
  isSignedIn: boolean;
  userRole: UserRoleType;
  currentUserId: number;
  canPost: boolean;
  userProfile: UserProfile;
  isAuthInitialized: boolean;
  signOut: (options?: { callbackUrl?: string }) => void;
  signIn: (role?: UserRoleType, userId?: number, canPost?: boolean, profile?: UserProfile) => void;
  openAuthModal: (mode: "signin" | "signup") => void;
  updateUserProfile: (profile: UserProfile) => void;
  setIsAuthInitialized: (v: boolean) => void;
}>({ isSignedIn: false, userRole: null, currentUserId: 0, canPost: false, userProfile: null, isAuthInitialized: false, signOut: () => { }, signIn: () => { }, openAuthModal: () => { }, updateUserProfile: () => { }, setIsAuthInitialized: () => { } });

export const StoryContext = createContext<{
  hasActiveStory: boolean;
  setHasActiveStory: (v: boolean) => void;
  showStoryViewer: boolean;
  setShowStoryViewer: (v: boolean) => void;
  storyViewingUserId: number | null;
  setStoryViewingUserId: (id: number | null) => void;
  showStoryCreator: boolean;
  setShowStoryCreator: (v: boolean) => void;
  showCreatePost: boolean;
  setShowCreatePost: (v: boolean) => void;
}>({ hasActiveStory: true, setHasActiveStory: () => { }, showStoryViewer: false, setShowStoryViewer: () => { }, storyViewingUserId: null, setStoryViewingUserId: () => { }, showStoryCreator: false, setShowStoryCreator: () => { }, showCreatePost: false, setShowCreatePost: () => { } });

export const MobileContext = createContext<{
  isMobile: boolean;
}>({ isMobile: false });
