"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Download, Trash2, ImageIcon, CheckCircle, AlertCircle, Settings2, Archive } from "lucide-react";
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
        const dx = (targetWidth - sw) / 2;
        const dy = (targetHeight - sh) / 2;
        ctx.drawImage(img, dx, dy, sw, sh);
      } else {
        const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const dx = (targetWidth - sw) / 2;
        const dy = (targetHeight - sh) / 2;
        ctx.drawImage(img, dx, dy, sw, sh);
      }

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error("Failed"));
          resolve({
            url: URL.createObjectURL(blob),
            size: blob.size,
            width: targetWidth,
            height: targetHeight,
          });
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Load failed"));
    };
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

    const getRatioDims = () => {
      if (ratio === "custom") return [customW, customH] as [number, number];
      const r = RATIO_MAP[ratio]!;
      const w = outputSize;
      const h = Math.round((w * r[1]) / r[0]);
      return [w, h] as [number, number];
    };

    const [tw, th] = getRatioDims();

    for (const img of images) {
      if (img.status === "done") continue;
      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, status: "processing", progress: 10 } : i))
      );

      try {
        await new Promise((r) => setTimeout(r, 100));
        setImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, progress: 50 } : i))
        );
        const result = await resizeImage(img.file, tw, th, mode, bgColor);
        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id
              ? {
                  ...i,
                  status: "done",
                  progress: 100,
                  resultUrl: result.url,
                  resultSize: result.size,
                  resultWidth: result.width,
                  resultHeight: result.height,
                }
              : i
          )
        );
      } catch {
        setImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, status: "error", progress: 0 } : i))
        );
        toast.error(`Failed to process ${img.file.name}`);
      }
    }

    processingRef.current = false;
    toast.success("All images processed!");
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

    toast.loading("Creating ZIP...", { id: "zip" });
    const zip = new JSZip();
    for (const img of done) {
      const res = await fetch(img.resultUrl!);
      const blob = await res.blob();
      zip.file(`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resized-images.zip";
    a.click();
    toast.success("Downloaded!", { id: "zip" });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const allDone = images.length > 0 && images.every((i) => i.status === "done");

  return (
    <div className="space-y-5">
      {/* Settings Bar */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-white/80">Resize Settings</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Aspect Ratio */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Aspect Ratio</label>
            <div className="flex gap-1 flex-wrap">
              {(["1:1", "4:3", "16:9", "9:16", "3:4", "custom"] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                    ratio === r
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Mode</label>
            <div className="flex gap-1">
              {(["padding", "crop"] as ResizeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all",
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Output Width */}
          {ratio !== "custom" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">
                Output Width (px)
              </label>
              <input
                type="number"
                value={outputSize}
                onChange={(e) => setOutputSize(Number(e.target.value))}
                className="w-24 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          {/* Custom dimensions */}
          {ratio === "custom" && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Width</label>
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <span className="text-white/40 mb-1">×</span>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Height</label>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* BG Color */}
          {mode === "padding" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">BG Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                />
                <span className="text-xs text-white/50">{bgColor}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-purple-500 bg-purple-500/10"
            : "border-white/10 hover:border-purple-500/50 hover:bg-white/[0.02]"
        )}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={{ y: isDragActive ? -5 : 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <ImageIcon size={24} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">
              {isDragActive ? "Drop images here!" : "Upload or Drop Images"}
            </p>
            <p className="text-xs text-white/40 mt-1">JPG, PNG, WEBP, GIF — multiple files supported</p>
          </div>
        </motion.div>
      </div>

      {/* Image List */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {images.map((img) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass rounded-2xl p-3 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 shrink-0">
                    <img
                      src={img.resultUrl || img.preview}
                      alt={img.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-white/80 truncate max-w-[160px]">
                        {img.file.name}
                      </span>
                      {img.status === "done" && (
                        <CheckCircle size={12} className="text-green-400 shrink-0" />
                      )}
                      {img.status === "error" && (
                        <AlertCircle size={12} className="text-red-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>{formatBytes(img.originalSize)}</span>
                      {img.resultSize && (
                        <>
                          <span>→</span>
                          <span className="text-green-400">{formatBytes(img.resultSize)}</span>
                        </>
                      )}
                      {img.resultWidth && (
                        <span className="text-blue-400">
                          {img.resultWidth}×{img.resultHeight}
                        </span>
                      )}
                    </div>
                    {img.status === "processing" && (
                      <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: `${img.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {img.status === "done" && img.resultUrl && (
                      <a
                        href={img.resultUrl}
                        download={`resized-${img.file.name.replace(/\.[^.]+$/, "")}.jpg`}
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        <Download size={13} />
                      </a>
                    )}
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
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
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={processAll}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Resize All Images
          </motion.button>
          {allDone && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={downloadAll}
              className="px-4 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-600/30 transition-all flex items-center gap-2"
            >
              <Archive size={15} />
              Download All
            </motion.button>
          )}
          <button
            onClick={() => setImages([])}
            className="px-4 py-3 rounded-2xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
