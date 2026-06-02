"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Download, Trash2, CheckCircle, AlertCircle, Archive, ImageIcon } from "lucide-react";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { formatBytes, generateId } from "@/lib/utils";

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
  "1:1": [1, 1], "3:4": [3, 4], "4:3": [4, 3],
  "9:16": [9, 16], "16:9": [16, 9], custom: null,
};

function resizeImage(
  file: File, targetWidth: number, targetHeight: number, mode: ResizeMode, bgColor: string
): Promise<{ url: string; size: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth; canvas.height = targetHeight;
      const ctx = canvas.getContext("2d")!;
      if (mode === "padding") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
        ctx.drawImage(img, (targetWidth - img.width * scale) / 2, (targetHeight - img.height * scale) / 2, img.width * scale, img.height * scale);
      } else {
        const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
        ctx.drawImage(img, (targetWidth - img.width * scale) / 2, (targetHeight - img.height * scale) / 2, img.width * scale, img.height * scale);
      }
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error("Failed"));
        resolve({ url: URL.createObjectURL(blob), size: blob.size, width: targetWidth, height: targetHeight });
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")); };
    img.src = url;
  });
}

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
    setImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: generateId(), file,
        preview: URL.createObjectURL(file),
        status: "idle" as const, progress: 0, originalSize: file.size,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] },
    multiple: true,
  });

  const processAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const [tw, th] = ratio === "custom" ? [customW, customH] : [outputSize, Math.round((outputSize * RATIO_MAP[ratio]![1]) / RATIO_MAP[ratio]![0])];
    for (const img of images) {
      if (img.status === "done") continue;
      setImages((p) => p.map((i) => i.id === img.id ? { ...i, status: "processing", progress: 30 } : i));
      try {
        await new Promise((r) => setTimeout(r, 60));
        const result = await resizeImage(img.file, tw, th, mode, bgColor);
        setImages((p) => p.map((i) => i.id === img.id ? { ...i, status: "done", progress: 100, ...result } : i));
      } catch {
        setImages((p) => p.map((i) => i.id === img.id ? { ...i, status: "error", progress: 0 } : i));
        toast.error(`처리 실패: ${img.file.name}`);
      }
    }
    processingRef.current = false;
    toast.success("완료!");
  };

  const downloadAll = async () => {
    const done = images.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    if (done.length === 1) { const a = document.createElement("a"); a.href = done[0].resultUrl!; a.download = `resized-${done[0].file.name}`; a.click(); return; }
    toast.loading("ZIP 생성 중...", { id: "zip" });
    const zip = new JSZip();
    for (const img of done) { const blob = await (await fetch(img.resultUrl!)).blob(); zip.file(`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`, blob); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" })); a.download = "resized-images.zip"; a.click();
    toast.success("다운로드 완료!", { id: "zip" });
  };

  const allDone = images.length > 0 && images.every((i) => i.status === "done");

  const RATIOS: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9", "custom"];
  const MODES: [ResizeMode, string][] = [["padding", "여백 추가"], ["crop", "크롭"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`drop-zone${isDragActive ? " active" : ""}`}
        style={{ padding: "64px 40px", textAlign: "center" }}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -6 : 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, border: "1px solid var(--border)",
            background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ImageIcon size={28} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              {isDragActive ? "여기에 놓으세요" : "이미지를 드래그하거나 클릭해 업로드"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>JPG, PNG, WebP, GIF · 여러 파일 동시 가능</p>
          </div>
          <button
            className="btn-ghost"
            style={{ fontSize: 14, padding: "9px 22px" }}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            파일 선택
          </button>
        </motion.div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files) onDrop(Array.from(e.target.files)); e.target.value = ""; }} />

      {/* Settings */}
      <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Ratio */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>캔버스 비율</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RATIOS.map((r) => (
              <button key={r} onClick={() => setRatio(r)} className={`pill${ratio === r ? " active" : ""}`}>
                {r === "custom" ? "커스텀" : r}
              </button>
            ))}
          </div>
          {ratio === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <input type="number" value={customW} onChange={(e) => setCustomW(Number(e.target.value))} className="notion-input" style={{ width: 80 }} />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>×</span>
              <input type="number" value={customH} onChange={(e) => setCustomH(Number(e.target.value))} className="notion-input" style={{ width: 80 }} />
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>px</span>
            </div>
          )}
          {ratio !== "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>출력 너비</span>
              <input type="number" value={outputSize} onChange={(e) => setOutputSize(Number(e.target.value))} className="notion-input" style={{ width: 90 }} />
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>px</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Mode */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>편집 모드</div>
          <div style={{ display: "flex", gap: 6 }}>
            {MODES.map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} className={`pill${mode === m ? " active" : ""}`}>{label}</button>
            ))}
          </div>
          {mode === "padding" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>배경색</span>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", padding: 2 }} />
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{bgColor}</span>
            </div>
          )}
        </div>
      </div>

      {/* Image list */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflow: "hidden" }}>
            {images.map((img, idx) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 16px",
                  borderBottom: idx < images.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", background: "var(--surface-hover)", flexShrink: 0, border: "1px solid var(--border)" }}>
                  <img src={img.resultUrl || img.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }} className="truncate">{img.file.name}</span>
                    {img.status === "done" && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    {img.status === "error" && <AlertCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                    <span>{formatBytes(img.originalSize)}</span>
                    {img.resultSize && <><span>→</span><span style={{ color: "#16a34a" }}>{formatBytes(img.resultSize)}</span></>}
                    {img.resultWidth && <span style={{ color: "var(--accent)" }}>{img.resultWidth}×{img.resultHeight}</span>}
                  </div>
                  {img.status === "processing" && (
                    <div className="progress-track" style={{ height: 2, marginTop: 6 }}>
                      <motion.div className="progress-fill" style={{ height: "100%" }}
                        initial={{ width: "0%" }} animate={{ width: `${img.progress}%` }} transition={{ duration: 0.4 }} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {img.status === "done" && img.resultUrl && (
                    <a href={img.resultUrl} download={`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`}
                      style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", color: "#16a34a", display: "flex", background: "var(--surface)" }}>
                      <Download size={13} />
                    </a>
                  )}
                  <button onClick={() => setImages((p) => p.filter((i) => i.id !== img.id))}
                    style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--surface)", cursor: "pointer", display: "flex" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.98 }}
            onClick={processAll} className="btn-primary"
            style={{ flex: 1, padding: "12px", fontSize: 15, borderRadius: 9 }}>
            리사이즈 실행
          </motion.button>
          {allDone && (
            <motion.button initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              onClick={downloadAll} className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Archive size={14} /> 전체 다운로드
            </motion.button>
          )}
          <button onClick={() => setImages([])} className="btn-ghost">초기화</button>
        </div>
      )}
    </div>
  );
}
