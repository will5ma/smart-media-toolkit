import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Tool } from "@/store/appStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function detectToolFromFile(file: File): Tool {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type.startsWith("image/gif") || name.endsWith(".gif")) return "gif-studio";
  if (type.startsWith("video/") || [".mp4", ".webm", ".mov", ".avi"].some((e) => name.endsWith(e)))
    return "gif-studio";
  if (type.startsWith("image/")) return "image-resizer";
  if (
    type === "application/pdf" ||
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx") ||
    name.endsWith(".hwp")
  )
    return "doc-compressor";

  return "image-resizer";
}

export function detectToolFromText(text: string): Tool | null {
  const lower = text.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube-thumbnail";
  if (
    lower.includes("compress") ||
    lower.includes("pdf") ||
    lower.includes("doc") ||
    lower.includes("ppt")
  )
    return "doc-compressor";
  if (lower.includes("gif") || lower.includes("video") || lower.includes("convert"))
    return "gif-studio";
  if (lower.includes("resize") || lower.includes("image") || lower.includes("photo"))
    return "image-resizer";
  return null;
}

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export const TOOL_LABELS: Record<Tool, string> = {
  "image-resizer": "Smart Image Resizer",
  "doc-compressor": "Smart Doc Compressor",
  "gif-studio": "Smart GIF Studio",
  "youtube-thumbnail": "Smart YouTube Thumbnail Downloader",
  "image-converter": "Smart Image Converter",
};

export const TOOL_ICONS: Record<Tool, string> = {
  "image-resizer": "ImageIcon",
  "doc-compressor": "FileText",
  "gif-studio": "Film",
  "youtube-thumbnail": "Youtube",
  "image-converter": "RefreshCw",
};
