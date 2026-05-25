"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Download, Trash2, CheckCircle, AlertCircle, Archive } from "lucide-react";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { cn, formatBytes, generateId } from "@/lib/utils";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "custom";
type ResizeMode = "padding" | "crop";

interface ImageItem {
  id: string;
  file: File;
  preview: string;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  resultWidth?: number;
  resultHeight?: number;
  originalSize: number;
}

const RATIO_MAP: Record<AspectRatio, [number, number] | null> = {
  "1:1": [1, 1],
  "3:4": [3, 4],
  "4:3": [4, 3],
  "9:16": [9, 16],
  "16:9": [16, 9],
  custom: null,
};

function resizeImage(
  file: File,
  targetWidth: number,
  targetHeight: number,
  mode: ResizeMode,
  bgColor: string
): Promise<{ url: string; size: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d")!;

      if (mode === "padding") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (targetWidth - sw) / 2, (targetHeight - sh) / 2, sw, sh);
      } else {
        const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        ctx.drawImage(img, (targetWidth - sw) / 2, (targetHeight - sh) / 2, sw, sh);
      }

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error("Failed"));
          resolve({ url: URL.createObjectURL(blob), size: blob.size, width: targetWidth, height: targetHeight });
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")); };
    img.src = url;
  });
}

const pillBtn = (active: boolean, color: "purple" | "blue" = "purple") => ({
  padding: "6px 16px",
  borderRadius: 99,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
  border: active
    ? color === "purple" ? "1px solid rgba(110,110,245,0.3)" : "1px solid rgba(59,130,246,0.3)"
    : "1px solid rgba(0,0,0,0.1)",
  background: active
    ? color === "purple" ? "rgba(110,110,245,0.12)" : "rgba(59,130,246,0.1)"
    : "rgba(0,0,0,0.03)",
  color: active
    ? color === "purple" ? "#4f46e5" : "#2563eb"
    : "rgba(0,0,0,0.5)",
});

export default function ImageResizer() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [mode, setMode] = useState<ResizeMode>("padding");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [outputSize, setOutputSize] = useState(1920);
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: ImageItem[] = accepted.map((file) => ({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file),
      status: "idle",
      progress: 0,
      originalSize: file.size,
    }));
    setImages((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] },
    multiple: true,
  });

  const processAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    const getRatioDims = (): [number, number] => {
      if (ratio === "custom") return [customW, customH];
      const r = RATIO_MAP[ratio]!;
      return [outputSize, Math.round((outputSize * r[1]) / r[0])];
    };

    const [tw, th] = getRatioDims();

    for (const img of images) {
      if (img.status === "done") continue;
      setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, status: "processing", progress: 10 } : i));
      try {
        await new Promise((r) => setTimeout(r, 100));
        setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, progress: 50 } : i));
        const result = await resizeImage(img.file, tw, th, mode, bgColor);
        setImages((prev) => prev.map((i) => i.id === img.id
          ? { ...i, status: "done", progress: 100, resultUrl: result.url, resultSize: result.size, resultWidth: result.width, resultHeight: result.height }
          : i
        ));
      } catch {
        setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, status: "error", progress: 0 } : i));
        toast.error(`처리 실패: ${img.file.name}`);
      }
    }
    processingRef.current = false;
    toast.success("모든 이미지 처리 완료!");
  };

  const downloadAll = async () => {
    const done = images.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    if (done.length === 1) {
      const a = document.createElement("a");
      a.href = done[0].resultUrl!;
      a.download = `resized-${done[0].file.name}`;
      a.click();
      return;
    }
    toast.loading("ZIP 생성 중...", { id: "zip" });
    const zip = new JSZip();
    for (const img of done) {
      const res = await fetch(img.resultUrl!);
      const blob = await res.blob();
      zip.file(`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "resized-images.zip";
    a.click();
    toast.success("다운로드 완료!", { id: "zip" });
  };

  const allDone = images.length > 0 && images.every((i) => i.status === "done");

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.35)",
    marginBottom: 8,
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        style={{
          ...cardStyle,
          padding: "56px 32px",
          textAlign: "center",
          cursor: "pointer",
          border: isDragActive ? "2px dashed rgba(110,110,245,0.5)" : "1.5px dashed rgba(0,0,0,0.1)",
          background: isDragActive ? "rgba(110,110,245,0.03)" : "#ffffff",
          transition: "all 0.2s",
        }}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -6 : 0 }} className="flex flex-col items-center gap-4">
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg, #6e6ef5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(110,110,245,0.35)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#1d1d2e", marginBottom: 6 }}>
              {isDragActive ? "여기에 놓으세요!" : "이미지를 여기에 드래그하세요"}
            </p>
            <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>
              JPG, PNG, WebP, GIF · 여러 파일 동시 업로드 가능
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              padding: "10px 28px",
              borderRadius: 99,
              background: "linear-gradient(135deg, #6e6ef5, #4f46e5)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(110,110,245,0.35)",
            }}
          >
            + 파일 선택
          </button>
        </motion.div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) onDrop(Array.from(e.target.files)); e.target.value = ""; }} />

      {/* Canvas Ratio */}
      <div style={{ ...cardStyle, padding: "20px 24px" }}>
        <p style={labelStyle}>캔버스 비율</p>
        <div className="flex gap-2 flex-wrap">
          {(["1:1", "3:4", "4:3", "9:16", "16:9", "custom"] as AspectRatio[]).map((r) => (
            <button key={r} onClick={() => setRatio(r)} style={pillBtn(ratio === r, "purple")}>
              {r === "custom" ? "커스텀" : r}
            </button>
          ))}
        </div>
        {ratio === "custom" && (
          <div className="flex items-center gap-2 mt-3">
            <input type="number" value={customW} onChange={(e) => setCustomW(Number(e.target.value))}
              style={{ width: 80, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, color: "#1d1d2e", background: "#fff" }} />
            <span style={{ color: "rgba(0,0,0,0.35)", fontSize: 14 }}>×</span>
            <input type="number" value={customH} onChange={(e) => setCustomH(Number(e.target.value))}
              style={{ width: 80, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, color: "#1d1d2e", background: "#fff" }} />
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)" }}>px</span>
          </div>
        )}
        {ratio !== "custom" && (
          <div className="flex items-center gap-2 mt-3">
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>출력 너비</span>
            <input type="number" value={outputSize} onChange={(e) => setOutputSize(Number(e.target.value))}
              style={{ width: 90, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, color: "#1d1d2e", background: "#fff" }} />
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)" }}>px</span>
          </div>
        )}
      </div>

      {/* Edit Mode */}
      <div style={{ ...cardStyle, padding: "20px 24px" }}>
        <p style={labelStyle}>편집 모드</p>
        <div className="flex gap-2">
          {([["padding", "여백 추가"], ["crop", "크롭"]] as [ResizeMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={pillBtn(mode === m, "blue")}>{label}</button>
          ))}
        </div>
        {mode === "padding" && (
          <div className="flex items-center gap-3 mt-3">
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>배경색</span>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", fontFamily: "monospace" }}>{bgColor}</span>
          </div>
        )}
      </div>

      {/* Image List */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {images.map((img) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ ...cardStyle, padding: "12px 16px" }}
              >
                <div className="flex items-center gap-3">
                  <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.04)", flexShrink: 0 }}>
                    <img src={img.resultUrl || img.preview} alt={img.file.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#1d1d2e" }} className="truncate max-w-[180px]">{img.file.name}</span>
                      {img.status === "done" && <CheckCircle size={13} style={{ color: "#22c55e", flexShrink: 0 }} />}
                      {img.status === "error" && <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />}
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: 11, color: "rgba(0,0,0,0.38)" }}>
                      <span>{formatBytes(img.originalSize)}</span>
                      {img.resultSize && <><span>→</span><span style={{ color: "#16a34a" }}>{formatBytes(img.resultSize)}</span></>}
                      {img.resultWidth && <span style={{ color: "#2563eb" }}>{img.resultWidth}×{img.resultHeight}</span>}
                    </div>
                    {img.status === "processing" && (
                      <div style={{ marginTop: 6, height: 3, background: "rgba(0,0,0,0.07)", borderRadius: 99, overflow: "hidden" }}>
                        <motion.div style={{ height: "100%", background: "linear-gradient(90deg, #6e6ef5, #60a5fa)", borderRadius: 99 }}
                          initial={{ width: "0%" }} animate={{ width: `${img.progress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {img.status === "done" && img.resultUrl && (
                      <a href={img.resultUrl} download={`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`}
                        style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(34,197,94,0.1)", color: "#16a34a", display: "flex" }}>
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                      style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.38)", border: "none", cursor: "pointer", display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      {images.length > 0 && (
        <div className="flex gap-2 pt-1">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={processAll}
            style={{ flex: 1, padding: "14px", borderRadius: 99, background: "linear-gradient(135deg, #6e6ef5, #4f46e5)", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(110,110,245,0.35)" }}>
            이미지 리사이즈
          </motion.button>
          {allDone && (
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={downloadAll}
              style={{ padding: "14px 20px", borderRadius: 99, background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Archive size={16} /> 전체 다운로드
            </motion.button>
          )}
          <button onClick={() => setImages([])}
            style={{ padding: "14px 20px", borderRadius: 99, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.45)", fontSize: 15, cursor: "pointer" }}>
            초기화
          </button>
        </div>
      )}
    </div>
  );
}
