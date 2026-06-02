"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Sidebar from "@/components/layout/Sidebar";
import ImageResizer from "@/components/tools/ImageResizer";
import DocCompressor from "@/components/tools/DocCompressor";
import GIFStudio from "@/components/tools/GIFStudio";
import YoutubeThumbnail from "@/components/tools/YoutubeThumbnail";
import ImageConverter from "@/components/tools/ImageConverter";
import { useAppStore } from "@/store/appStore";
import { ImageIcon, FileText, Film, Video as Youtube, RefreshCw } from "lucide-react";
import type { Tool } from "@/store/appStore";

const TOOL_META: Record<Tool, { label: string; desc: string; icon: React.ElementType; color: string }> = {
  "image-resizer":    { label: "Image Resizer",   desc: "원하는 비율로 자르거나 여백을 추가해 완성도 높은 이미지를 만드세요.", icon: ImageIcon, color: "#5e6ad2" },
  "doc-compressor":   { label: "Doc Compressor",  desc: "PDF, DOC, PPT 파일을 원본 품질을 유지하면서 용량을 줄이세요.",       icon: FileText,  color: "#0ea5e9" },
  "gif-studio":       { label: "GIF Studio",      desc: "GIF를 편집하거나 동영상을 움직이는 GIF로 바로 변환하세요.",           icon: Film,      color: "#f43f5e" },
  "youtube-thumbnail":{ label: "YT Thumbnail",    desc: "유튜브 영상의 썸네일을 최고 해상도로 즉시 다운로드하세요.",           icon: Youtube,   color: "#ef4444" },
  "image-converter":  { label: "Converter",       desc: "JPG, PNG, WEBP, GIF 등 다양한 이미지 형식으로 손쉽게 변환하세요.",   icon: RefreshCw, color: "#10b981" },
};

function ToolHeader() {
  const { activeTool } = useAppStore();
  const { label, desc, icon: Icon, color } = TOOL_META[activeTool];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTool}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${color}14`,
          border: `1px solid ${color}22`,
        }}>
          <Icon size={22} style={{ color }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.025em", lineHeight: 1.3 }}>
            {label}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.55 }}>
            {desc}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ToolContent() {
  const { activeTool } = useAppStore();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTool}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {activeTool === "image-resizer"    && <ImageResizer />}
        {activeTool === "doc-compressor"   && <DocCompressor />}
        {activeTool === "gif-studio"       && <GIFStudio />}
        {activeTool === "youtube-thumbnail"&& <YoutubeThumbnail />}
        {activeTool === "image-converter"  && <ImageConverter />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Home() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            fontSize: "13px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        }}
      />

      <Sidebar />

      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "52px 48px" }}>
          <ToolHeader />
          <ToolContent />
        </div>
      </main>
    </div>
  );
}
