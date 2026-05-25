"use client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Image as ImageIcon, FileText, Film, Video as Youtube, Menu, X, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { Tool } from "@/store/appStore";
import { cn, TOOL_LABELS as toolLabels } from "@/lib/utils";

const TOOL_LABELS_SHORT: Record<Tool, string> = {
  "image-resizer": "Image Resizer",
  "doc-compressor": "Doc Compressor",
  "gif-studio": "GIF Studio",
  "youtube-thumbnail": "YT Thumbnail",
  "image-converter": "Converter",
};

const TOOL_ICONS_MAP: Record<Tool, React.ReactNode> = {
  "image-resizer": <ImageIcon size={13} />,
  "doc-compressor": <FileText size={13} />,
  "gif-studio": <Film size={13} />,
  "youtube-thumbnail": <Youtube size={13} />,
  "image-converter": <RefreshCw size={13} />,
};

const TOOLS: Tool[] = ["image-resizer", "doc-compressor", "gif-studio", "youtube-thumbnail", "image-converter"];

export default function Header() {
  const { activeTool, setActiveTool, sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        background: "rgba(6,6,8,0.72)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link
          href="https://www.wearablesearch.co.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-8 h-8 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`}
              alt="WearableSearch"
              className="w-full h-full object-contain"
            />
          </motion.div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white/90 tracking-tight">WearableSearch</div>
            <div className="text-[9px] text-white/35 tracking-wide">웨어러블서치</div>
          </div>
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-2xl p-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              className="relative px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors"
              style={{ color: activeTool === tool ? "#fff" : "rgba(255,255,255,0.42)" }}
            >
              {activeTool === tool && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {TOOL_ICONS_MAP[tool]}
                {TOOL_LABELS_SHORT[tool]}
              </span>
            </button>
          ))}
        </nav>

        {/* Right: active title */}
        <div className="flex items-center gap-3 shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTool}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="hidden lg:block text-right"
            >
              <span className="text-[11px] font-medium"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                {toolLabels[activeTool]}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="px-5 py-3 flex flex-col gap-1">
              {TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => { setActiveTool(tool); setSidebarOpen(false); }}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left"
                  )}
                  style={{
                    background: activeTool === tool ? "rgba(110,110,245,0.15)" : "transparent",
                    color: activeTool === tool ? "#fff" : "rgba(255,255,255,0.5)",
                    border: activeTool === tool ? "1px solid rgba(110,110,245,0.25)" : "1px solid transparent",
                  }}
                >
                  {TOOL_ICONS_MAP[tool]}
                  {TOOL_LABELS_SHORT[tool]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
