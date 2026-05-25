"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ArrowRight,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Archive,
  Shuffle,
} from "lucide-react";
import JSZip from "jszip";
import GIFEncoder from "gif-encoder-2";
import toast from "react-hot-toast";
import { cn, formatBytes, generateId } from "@/lib/utils";

type OutputFormat = "jpg" | "png" | "webp" | "gif" | "svg";

interface ConvertItem {
  id: string;
  file: File;
  preview: string;
  inputFormat: string;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  resultFormat?: OutputFormat;
  errorMsg?: string;
}

const FORMAT_COLORS: Record<string, string> = {
  jpg: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  jpeg: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  png: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  webp: "text-green-400 bg-green-400/10 border-green-400/20",
  gif: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  svg: "text-pink-400 bg-pink-400/10 border-pink-400/20",
};

const OUTPUT_FORMATS: { value: OutputFormat; label: string; desc: string }[] = [
  { value: "jpg", label: "JPG", desc: "작은 파일, 사진에 최적" },
  { value: "png", label: "PNG", desc: "투명 배경 지원" },
  { value: "webp", label: "WEBP", desc: "웹 최적화, 고압축" },
  { value: "gif", label: "GIF", desc: "애니메이션 지원, 웹 호환" },
  { value: "svg", label: "SVG", desc: "벡터 래퍼 (래스터 임베드)" },
];

function getExt(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

function getMimeType(fmt: OutputFormat): string {
  if (fmt === "jpg") return "image/jpeg";
  if (fmt === "png") return "image/png";
  if (fmt === "webp") return "image/webp";
  if (fmt === "gif") return "image/gif";
  return "image/svg+xml";
}

async function convertToGif(file: File, quality: number): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    const ext = getExt(file);
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      try {
        const gifQuality = Math.max(1, Math.round((100 - quality) / 10) + 1);
        const encoder = new GIFEncoder(canvas.width, canvas.height, "neuquant", false);
        encoder.setQuality(gifQuality);
        encoder.start();
        encoder.addFrame(ctx);
        encoder.finish();
        const buffer = encoder.out.getData();
        const blob = new Blob([buffer.buffer as ArrayBuffer], { type: "image/gif" });
        resolve({ url: URL.createObjectURL(blob), size: blob.size });
      } catch (e: any) {
        reject(new Error("GIF 인코딩 실패: " + e.message));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 로드 실패"));
    };

    if (ext === "svg") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const svgText = e.target?.result as string;
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        img.src = URL.createObjectURL(blob);
      };
      reader.readAsText(file);
    } else {
      img.src = objectUrl;
    }
  });
}

async function convertToRaster(
  file: File,
  targetFmt: Exclude<OutputFormat, "svg" | "gif">,
  quality: number
): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    const ext = getExt(file);
    const isSvg = ext === "svg";
    const objectUrl = URL.createObjectURL(file);

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d")!;

      if (targetFmt === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("변환 실패"));
          resolve({ url: URL.createObjectURL(blob), size: blob.size });
        },
        getMimeType(targetFmt),
        quality / 100
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 로드 실패"));
    };

    if (isSvg) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const svgText = e.target?.result as string;
        const blob = new Blob([svgText], { type: "image/svg+xml" });
        img.src = URL.createObjectURL(blob);
      };
      reader.readAsText(file);
    } else {
      img.src = objectUrl;
    }
  });
}

async function convertToSvg(file: File): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth || 800;
        const h = img.naturalHeight || 600;
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image href="${dataUrl}" width="${w}" height="${h}"/>
</svg>`;
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        resolve({ url: URL.createObjectURL(blob), size: blob.size });
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

export default function ImageConverter() {
  const [items, setItems] = useState<ConvertItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(90);

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: ConvertItem[] = accepted.map((file) => {
      const ext = getExt(file);
      return {
        id: generateId(),
        file,
        preview: (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext))
          ? URL.createObjectURL(file)
          : "",
        inputFormat: ext,
        status: "idle",
        progress: 0,
      };
    });
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
      "image/svg+xml": [".svg"],
    },
    multiple: true,
  });

  const convertAll = async () => {
    const convertable = items.filter((i) => i.status === "idle" || i.status === "error");
    if (!convertable.length) return;

    for (const item of convertable) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "processing", progress: 20 } : i
        )
      );

      try {
        await new Promise((r) => setTimeout(r, 80));
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, progress: 60 } : i))
        );

        let result: { url: string; size: number };
        if (targetFormat === "svg") {
          result = await convertToSvg(item.file);
        } else if (targetFormat === "gif") {
          result = await convertToGif(item.file, quality);
        } else {
          result = await convertToRaster(item.file, targetFormat, quality);
        }

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "done",
                  progress: 100,
                  resultUrl: result.url,
                  resultSize: result.size,
                  resultFormat: targetFormat,
                }
              : i
          )
        );
      } catch (e: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", progress: 0, errorMsg: e.message }
              : i
          )
        );
        toast.error(`변환 실패: ${item.file.name}`);
      }
    }
    toast.success("변환 완료!");
  };

  const downloadAll = async () => {
    const done = items.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    if (done.length === 1) {
      triggerDownload(done[0]);
      return;
    }
    toast.loading("ZIP 생성 중...", { id: "conv-zip" });
    const zip = new JSZip();
    for (const item of done) {
      const res = await fetch(item.resultUrl!);
      const blob = await res.blob();
      const base = item.file.name.replace(/\.[^.]+$/, "");
      zip.file(`${base}.${item.resultFormat}`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.zip";
    a.click();
    toast.success("다운로드 완료!", { id: "conv-zip" });
  };

  const triggerDownload = (item: ConvertItem) => {
    if (!item.resultUrl) return;
    const a = document.createElement("a");
    a.href = item.resultUrl;
    a.download = `${item.file.name.replace(/\.[^.]+$/, "")}.${item.resultFormat}`;
    a.click();
  };

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const allDone = items.length > 0 && items.every((i) => i.status === "done");

  return (
    <div className="space-y-5">
      {/* Format selector */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Shuffle size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">변환 설정</span>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Target format */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">출력 형식</label>
            <div className="flex gap-1.5">
              {OUTPUT_FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => setTargetFormat(fmt.value)}
                  title={fmt.desc}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    targetFormat === fmt.value
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                  )}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality — only for raster outputs */}
          {targetFormat !== "svg" && (
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">
                품질: {quality}%
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => setQuality(+e.target.value)}
                className="w-full accent-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Format descriptions */}
        <p className="mt-3 text-[10px] text-white/30">
          {OUTPUT_FORMATS.find((f) => f.value === targetFormat)?.desc}
          {targetFormat === "svg" && " — 래스터 이미지를 SVG 컨테이너에 임베드합니다 (진짜 벡터화 아님)"}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-white/10 hover:border-emerald-500/50 hover:bg-white/[0.02]"
        )}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <RefreshCw size={24} className={cn("text-emerald-400", isDragActive && "animate-spin")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">
              {isDragActive ? "이미지를 놓으세요!" : "이미지 업로드 또는 드래그"}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              {["JPG", "PNG", "WEBP", "GIF", "SVG"].map((fmt) => (
                <span
                  key={fmt}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                    FORMAT_COLORS[fmt.toLowerCase()] || "text-white/40 bg-white/5 border-white/10"
                  )}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass rounded-2xl p-3 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/30 shrink-0 flex items-center justify-center">
                    {item.preview ? (
                      <img
                        src={item.status === "done" && item.resultUrl ? item.resultUrl : item.preview}
                        alt={item.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">🎨</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium text-white/80 truncate max-w-[160px]">
                        {item.file.name}
                      </span>
                      {/* Format arrow */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-bold border", FORMAT_COLORS[item.inputFormat] || "text-white/40 bg-white/5 border-white/10")}>
                          {item.inputFormat.toUpperCase()}
                        </span>
                        <ArrowRight size={10} className="text-white/30" />
                        <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-bold border", FORMAT_COLORS[item.resultFormat || targetFormat])}>
                          {(item.resultFormat || targetFormat).toUpperCase()}
                        </span>
                      </div>
                      {item.status === "done" && <CheckCircle size={12} className="text-emerald-400 shrink-0" />}
                      {item.status === "error" && <AlertCircle size={12} className="text-red-400 shrink-0" />}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>{formatBytes(item.file.size)}</span>
                      {item.resultSize && (
                        <>
                          <span>→</span>
                          <span className="text-emerald-400">{formatBytes(item.resultSize)}</span>
                        </>
                      )}
                      {item.status === "error" && item.errorMsg && (
                        <span className="text-red-400">{item.errorMsg}</span>
                      )}
                    </div>

                    {item.status === "processing" && (
                      <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === "done" && item.resultUrl && (
                      <button
                        onClick={() => triggerDownload(item)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Download size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => remove(item.id)}
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

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={convertAll}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} />
            전체 변환 ({targetFormat.toUpperCase()})
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
              전체 다운로드
            </motion.button>
          )}
          <button
            onClick={() => setItems([])}
            className="px-4 py-3 rounded-2xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all"
          >
            초기화
          </button>
        </div>
      )}

    </div>
  );
}
