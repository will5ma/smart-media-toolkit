"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ImageIcon, FileText, Film, Video as Youtube, RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import type { Tool } from "@/store/appStore";

const TOOLS: { tool: Tool; label: string; icon: React.ElementType; desc: string }[] = [
  { tool: "image-resizer",    label: "Image Resizer",   icon: ImageIcon, desc: "비율 조정 & 크롭" },
  { tool: "doc-compressor",   label: "Doc Compressor",  icon: FileText,  desc: "PDF / DOC 압축" },
  { tool: "gif-studio",       label: "GIF Studio",      icon: Film,      desc: "GIF 편집 & 변환" },
  { tool: "youtube-thumbnail",label: "YT Thumbnail",    icon: Youtube,   desc: "썸네일 다운로드" },
  { tool: "image-converter",  label: "Converter",       icon: RefreshCw, desc: "포맷 변환" },
];

export default function Sidebar() {
  const { activeTool, setActiveTool } = useAppStore();

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: "24px 20px 18px" }}>
        <Link
          href="https://www.wearablesearch.co.kr/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`}
              alt="WearableSearch"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>WearableSearch</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.25 }}>Media Toolkit</div>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: "0 12px" }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "14px 10px" }}>
        <div className="section-label" style={{ padding: "6px 10px 10px" }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {TOOLS.map(({ tool, label, icon: Icon, desc }) => {
            const isActive = activeTool === tool;
            return (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-lg)",
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "var(--accent-light)" : "transparent",
                  color: isActive ? "var(--accent-text)" : "var(--text)",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{
                      position: "absolute", left: 0, top: "15%", bottom: "15%",
                      width: 3, borderRadius: 99, background: "var(--accent)",
                    }}
                    transition={{ type: "spring", stiffness: 600, damping: 40 }}
                  />
                )}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? "rgba(94,106,210,0.12)" : "var(--surface-hover)",
                  border: `1px solid ${isActive ? "rgba(94,106,210,0.2)" : "var(--border)"}`,
                }}>
                  <Icon size={16} style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, lineHeight: 1.35, color: isActive ? "var(--accent-text)" : "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: isActive ? "rgba(94,106,210,0.6)" : "var(--text-tertiary)", lineHeight: 1.3, marginTop: 1 }}>{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Smart Media Toolkit v1.0</div>
      </div>
    </aside>
  );
}
