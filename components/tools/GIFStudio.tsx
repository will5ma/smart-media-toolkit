"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Film, Download, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatBytes, generateId } from "@/lib/utils";

// ── 타입 ──────────────────────────────────────────────────────────────────
type GIFQuality = "최대" | "중간" | "최적";

interface VideoItem {
  id: string;
  file: File;
  previewUrl: string;
  size: number;
  duration?: number;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
}

// ── 품질 설정 ──────────────────────────────────────────────────────────────
const QUALITY_CONFIG: Record<GIFQuality, {
  fps: number;
  width: number;
  nqQuality: number; // neuquant: 1=최고, 20=최저
  desc: string;
}> = {
  "최대": { fps: 15, width: 480, nqQuality: 1,  desc: "고품질 · 큰 파일" },
  "중간": { fps: 10, width: 360, nqQuality: 5,  desc: "균형 품질 · 중간 크기" },
  "최적": { fps: 7,  width: 240, nqQuality: 10, desc: "작은 파일 · 저품질" },
};

// ── 변환 함수 ──────────────────────────────────────────────────────────────
async function convertToGIF(
  file: File,
  quality: GIFQuality,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  const { fps, width, nqQuality } = QUALITY_CONFIG[quality];

  // 1. 비디오 메타데이터 로드
  onProgress(5);
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("비디오 로드 실패"));
    video.load();
  });

  const duration = Math.min(video.duration || 10, 30);
  const aspectRatio = (video.videoHeight || 360) / (video.videoWidth || 640);
  const height = Math.max(1, Math.round(width * aspectRatio));
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  // 2. Canvas 준비
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 3. gif-encoder-2 동적 import
  onProgress(8);
  const GIFEncoder = (await import("gif-encoder-2")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encoder = new (GIFEncoder as any)(width, height, "neuquant", true, totalFrames);
  encoder.setDelay(Math.round(1000 / fps));
  encoder.setQuality(nqQuality);
  encoder.setRepeat(0);
  encoder.start();

  // 4. 프레임 캡처
  for (let i = 0; i < totalFrames; i++) {
    const time = (i / fps);
    video.currentTime = time;

    await new Promise<void>((res) => {
      const onSeeked = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);
        encoder.addFrame(ctx);
        video.removeEventListener("seeked", onSeeked);
        res();
      };
      video.addEventListener("seeked", onSeeked);
      // seeked 이벤트가 이미 발생한 경우 대비
      if (Math.abs(video.currentTime - time) < 0.05) {
        video.removeEventListener("seeked", onSeeked);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);
        encoder.addFrame(ctx);
        res();
      }
    });

    onProgress(8 + Math.round(((i + 1) / totalFrames) * 85));
  }

  // 5. 인코딩 완료
  encoder.finish();
  const data = encoder.out.getData();
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "image/gif" });

  URL.revokeObjectURL(videoUrl);
  onProgress(100);

  return { url: URL.createObjectURL(blob), size: blob.size };
}

// ── 컴포넌트 ───────────────────────────────────────────────────────────────
export default function GIFStudio() {
  const [quality, setQuality] = useState<GIFQuality>("중간");
  const [items, setItems] = useState<VideoItem[]>([]);
  const processingRef = useRef(false);

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: VideoItem[] = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file);

      // 비디오 길이 비동기 감지
      const vid = document.createElement("video");
      vid.src = previewUrl;
      vid.onloadedmetadata = () => {
        setItems((prev) =>
          prev.map((i) => i.previewUrl === previewUrl ? { ...i, duration: vid.duration } : i)
        );
      };

      return { id: generateId(), file, previewUrl, size: file.size, status: "idle", progress: 0 };
    });
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4":  [".mp4"],
      "video/webm": [".webm"],
      "video/quicktime": [".mov"],
      "video/x-msvideo": [".avi"],
      "image/apng": [".apng"],
    },
    multiple: true,
  });

  const update = (id: string, patch: Partial<VideoItem>) =>
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const convertAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    let hasError = false;

    for (const item of items) {
      if (item.status === "done") continue;
      update(item.id, { status: "processing", progress: 5 });

      try {
        const result = await convertToGIF(
          item.file,
          quality,
          (p) => update(item.id, { progress: p })
        );
        update(item.id, { status: "done", progress: 100, resultUrl: result.url, resultSize: result.size });
      } catch (e) {
        hasError = true;
        update(item.id, { status: "error", progress: 0 });
        const msg = e instanceof Error ? e.message : "알 수 없는 오류";
        toast.error(`실패: ${item.file.name} — ${msg}`);
        console.error(e);
      }
    }

    processingRef.current = false;
    if (!hasError) toast.success("GIF 변환 완료!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 품질 설정 카드 */}
      <div className="card" style={{ padding: "18px 22px" }}>
        <div className="section-label" style={{ marginBottom: 10 }}>출력 품질</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["최대", "중간", "최적"] as GIFQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`pill${quality === q ? " active" : ""}`}
              style={{ flex: 1, textAlign: "center" }}
            >
              <div style={{ fontWeight: 600 }}>{q}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{QUALITY_CONFIG[q].desc}</div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10, lineHeight: 1.6 }}>
          FPS {QUALITY_CONFIG[quality].fps} · 너비 {QUALITY_CONFIG[quality].width}px · 최대 30초
        </p>
      </div>

      {/* 드롭존 */}
      <div
        {...getRootProps()}
        className={`drop-zone${isDragActive ? " active" : ""}`}
        style={{ padding: "52px 40px", textAlign: "center" }}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -5 : 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Film size={26} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              {isDragActive ? "여기에 놓으세요" : "Video to GIF"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              MP4 · WEBM · MOV · AVI · APNG
            </p>
          </div>
          <button className="btn-ghost" style={{ pointerEvents: "none" }}>파일 선택</button>
        </motion.div>
      </div>

      {/* 파일 목록 */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflow: "hidden" }}>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                style={{
                  padding: "12px 18px",
                  borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                {/* 썸네일 */}
                <div style={{ width: 56, height: 40, borderRadius: 6, overflow: "hidden", background: "var(--surface-hover)", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <video src={item.previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }} className="truncate">{item.file.name}</span>
                    {item.duration && (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{item.duration.toFixed(1)}s</span>
                    )}
                    {item.status === "done"  && <CheckCircle size={13} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    {item.status === "error" && <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                    <span>{formatBytes(item.size)}</span>
                    {item.resultSize && (
                      <>
                        <span>→</span>
                        <span style={{ color: "var(--accent)" }}>{formatBytes(item.resultSize)} GIF</span>
                      </>
                    )}
                  </div>
                  {item.status === "processing" && (
                    <div className="progress-track" style={{ height: 3, marginTop: 6 }}>
                      <motion.div
                        className="progress-fill"
                        style={{ height: "100%" }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${item.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                  {item.duration && item.duration > 30 && (
                    <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 3 }}>⚠️ 30초 초과 — 앞 30초만 변환됩니다</p>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  {item.status === "done" && item.resultUrl && (
                    <a
                      href={item.resultUrl}
                      download={`${item.file.name.replace(/\.[^.]+$/, "")}.gif`}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--accent)", display: "flex", background: "var(--surface)" }}
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {item.status === "error" && (
                    <button
                      onClick={() => update(item.id, { status: "idle", progress: 0 })}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--surface)", cursor: "pointer", display: "flex" }}
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                    style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--surface)", cursor: "pointer", display: "flex" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 하단 액션 버튼 */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.98 }}
            onClick={convertAll}
            disabled={processingRef.current}
            className="btn-primary"
            style={{ flex: 1, padding: "11px", fontSize: 15, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Film size={16} /> GIF 변환 실행
          </motion.button>
          <button onClick={() => setItems([])} className="btn-ghost">초기화</button>
        </div>
      )}
    </div>
  );
}
