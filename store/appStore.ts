"use client";
import { create } from "zustand";

export type Tool = "image-resizer" | "doc-compressor" | "gif-studio" | "youtube-thumbnail" | "image-converter";

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: "uploading" | "ready" | "processing" | "done" | "error";
  progress: number;
  result?: {
    url: string;
    size: number;
    name: string;
    width?: number;
    height?: number;
    savings?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "system";
  content: string;
  files?: UploadedFile[];
  timestamp: Date;
  tool?: Tool;
}

interface AppState {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  uploadedFiles: UploadedFile[];
  addFiles: (files: UploadedFile[]) => void;
  updateFile: (id: string, updates: Partial<UploadedFile>) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTool: "image-resizer",
  setActiveTool: (tool) => set({ activeTool: tool }),
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  uploadedFiles: [],
  addFiles: (files) => set((s) => ({ uploadedFiles: [...s.uploadedFiles, ...files] })),
  updateFile: (id, updates) =>
    set((s) => ({
      uploadedFiles: s.uploadedFiles.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeFile: (id) =>
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((f) => f.id !== id) })),
  clearFiles: () => set({ uploadedFiles: [] }),
  isDragging: false,
  setIsDragging: (v) => set({ isDragging: v }),
  darkMode: true,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
