"use client";

import { createContext, useContext } from "react";

export interface EditorUser {
  id: number;
  name: string;
  handle: string;
  role: string;
  avatar?: string;
  title?: string;
  editorSections?: { sectionId: number; canPublish: boolean }[];
}

export interface EditorContextValue {
  user: EditorUser | null;
  loading: boolean;
}

export const EditorContext = createContext<EditorContextValue>({ user: null, loading: true });

export function useEditorContext() {
  return useContext(EditorContext);
}
