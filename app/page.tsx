"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Header from "@/components/layout/Header";
import AuroraBackground from "@/components/layout/AuroraBackground";
import InputComposer from "@/components/layout/InputComposer";
import ImageResizer from "@/components/tools/ImageResizer";
import DocCompressor from "@/components/tools/DocCompressor";
import GIFStudio from "@/components/tools/GIFStudio";
import YoutubeThumbnail from "@/components/tools/YoutubeThumbnail";
import ImageConverter from "@/components/tools/ImageConverter";
import { useAppStore } from "@/store/appStore";
import { TOOL_LABELS } from "@/lib/utils";
import { ImageIcon, FileText, Film, Video as Youtube, Sparkles, RefreshCw } from "lucide-react";
import type { Tool } from "@/store/appStore";

const TOOL_ICON: Record<Tool, React.ElementType> = {
  "image-resizer": ImageIcon,
  "doc-compressor": FileText,
  "gif-studio": Film,
  "youtube-thumbnail": Youtube,
  "image-converter": RefreshCw,
};

const TOOL_GRADIENT: Record<Tool, string> = {
  "image-resizer":   "from-violet-500/20 to-blue-500/10",
  "doc-compressor":  "from-blue-500/20 to-sky-500/10",
  "gif-studio":      "from-fuchsia-500/20 to-violet-500/10",
  "youtube-thumbnail":"from-rose-500/20 to-orange-500/10",
  "image-converter": "from-emerald-500/20 to-teal-500/10",
};

const TOOL_COLOR: Record<Tool, string> = {
  "image-resizer":   "#a78bfa",
  "doc-compressor":  "#60a5fa",
  "gif-studio":      "#e879f9",
  "youtube-thumbnail":"#fb7185",
  "image-converter": "#34d399",
};

const TOOL_DESC: Record<Tool, string> = {
  "image-resizer":    "Resize, crop, or pad images to any aspect ratio with batch ZIP export.",
  "doc-compressor":   "Compress PDF, DOC, PPT, and HWP files while preserving quality.",
  "gif-studio":       "Edit GIFs or convert videos to animated GIFs with pro controls.",
  "youtube-thumbnail":"Extract YouTube thumbnails in all qualities — max resolution included.",
  "image-converter":  "JPG · PNG · WEBP · GIF · SVG 형식 간 변환. 배치 처리 및 ZIP 다운로드 지원.",
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
  const Icon = TOOL_ICON[activeTool];
  const color = TOOL_COLOR[activeTool];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTool}
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 14 }}
        transition={{ duration: 0.22 }}
        className="mb-16 flex items-center gap-8"
      >
        <div
          className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${TOOL_GRADIENT[activeTool]} flex items-center justify-center shrink-0`}
          style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: `0 12px 48px ${color}33` }}
        >
          <Icon size={32} style={{ color }} />
        </div>
        <div>
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{ color: "#f5f5f7", letterSpacing: "-0.04em", lineHeight: 1.1 }}
          >
            {TOOL_LABELS[activeTool]}
          </h1>
          <p className="text-base mt-3" style={{ color: "rgba(255,255,255,0.48)", lineHeight: 1.6 }}>
            {TOOL_DESC[activeTool]}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function HeroBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="mb-14"
    >
      <span className="chip" style={{ fontSize: 12, padding: "5px 14px", gap: 7 }}>
        <Sparkles size={13} style={{ color: "#a78bfa" }} />
        AI-Powered Media Workspace
      </span>
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative" style={{ background: "#060608" }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(20,20,28,0.92)",
            color: "#f5f5f7",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            fontSize: "13px",
            backdropFilter: "blur(20px)",
          },
        }}
      />

      {/* Aurora gradient background */}
      <AuroraBackground />

      {/* All content above aurora */}
      <div className="relative z-20 flex flex-col min-h-screen w-full">
        <Header />
        <InputComposer />

        <main className="flex-1 w-full py-24">
          <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 48px" }}>
            <HeroBadge />
            <ToolHeader />
            <ToolContent />
          </div>
        </main>
      </div>
    </div>
  );
}
