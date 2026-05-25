"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Header from "@/components/layout/Header";
import InputComposer from "@/components/layout/InputComposer";
import ImageResizer from "@/components/tools/ImageResizer";
import DocCompressor from "@/components/tools/DocCompressor";
import GIFStudio from "@/components/tools/GIFStudio";
import YoutubeThumbnail from "@/components/tools/YoutubeThumbnail";
import ImageConverter from "@/components/tools/ImageConverter";
import { useAppStore } from "@/store/appStore";
import { Sparkles, Image as ImageIcon, FileText, Film, Video as Youtube, RefreshCw } from "lucide-react";
import type { Tool } from "@/store/appStore";

const TOOL_NAV_ITEMS: { tool: Tool; label: string; icon: React.ElementType }[] = [
  { tool: "image-resizer",    label: "Image Resizer",   icon: ImageIcon },
  { tool: "doc-compressor",   label: "Doc Compressor",  icon: FileText },
  { tool: "gif-studio",       label: "GIF Studio",      icon: Film },
  { tool: "youtube-thumbnail",label: "YT Thumbnail",    icon: Youtube },
  { tool: "image-converter",  label: "Converter",       icon: RefreshCw },
];

function ToolNav() {
  const { activeTool, setActiveTool } = useAppStore();
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 24px 0" }}>
      <div style={{
        display: "flex",
        gap: 8,
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 99,
        padding: "6px 8px",
      }}>
        {TOOL_NAV_ITEMS.map(({ tool, label, icon: Icon }) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: activeTool === tool ? "#4f46e5" : "rgba(0,0,0,0.45)",
              transition: "color 0.15s",
            }}
          >
            {activeTool === tool && (
              <motion.div
                layoutId="tool-nav-pill"
                style={{
                  position: "absolute", inset: 0, borderRadius: 99,
                  background: "rgba(110,110,245,0.1)",
                  border: "1px solid rgba(110,110,245,0.2)",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon size={13} />
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const TOOL_HERO: Record<Tool, string> = {
  "image-resizer":    "이미지를 완벽하게.",
  "doc-compressor":   "문서를 가볍게.",
  "gif-studio":       "GIF를 자유롭게.",
  "youtube-thumbnail":"썸네일을 바로.",
  "image-converter":  "형식을 바꾸다.",
};

const TOOL_DESC: Record<Tool, string> = {
  "image-resizer":    "원하는 비율로 자르거나 여백을 추가해 완성도 높은 이미지를 만드세요.",
  "doc-compressor":   "PDF, DOC, PPT 파일을 원본 품질을 유지하면서 용량을 줄이세요.",
  "gif-studio":       "GIF를 편집하거나 동영상을 움직이는 GIF로 바로 변환하세요.",
  "youtube-thumbnail":"유튜브 영상의 썸네일을 최고 해상도로 즉시 다운로드하세요.",
  "image-converter":  "JPG, PNG, WEBP, GIF 등 다양한 이미지 형식으로 손쉽게 변환하세요.",
};

function ToolContent() {
  const { activeTool } = useAppStore();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTool}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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

function ToolHeader() {
  const { activeTool } = useAppStore();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTool}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.24 }}
        style={{ textAlign: "center", marginBottom: "52px" }}
      >
        <h1
          style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            marginBottom: "16px",
            background: "linear-gradient(135deg, #2d2a7a 0%, #6e6ef5 60%, #7c3aed 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {TOOL_HERO[activeTool]}
        </h1>
        <p
          style={{
            fontSize: "18px",
            color: "rgba(0,0,0,0.48)",
            lineHeight: 1.65,
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          {TOOL_DESC[activeTool]}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

function HeroBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
      style={{ textAlign: "center", marginBottom: "28px" }}
    >
      <span className="chip">
        <Sparkles size={12} />
        AI-Powered Media Workspace
      </span>
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative" style={{ background: "var(--bg)" }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#ffffff",
            color: "#1d1d2e",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "14px",
            fontSize: "13px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          },
        }}
      />

      <div className="flex flex-col min-h-screen w-full">
        <Header />
        <ToolNav />
        <InputComposer />

        <main className="flex-1 w-full py-36">
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 40px" }}>
            <HeroBadge />
            <ToolHeader />
            <ToolContent />
          </div>
        </main>
      </div>
    </div>
  );
}
