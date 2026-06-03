"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video as Youtube, Download, Copy, Search, Archive } from "lucide-react";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { extractYoutubeId } from "@/lib/utils";

// ── 추출 해상도 설정 ────────────────────────────────────────────────────
const SIZES = [
  { label: "1920 × 1080", width: 1920, height: 1080, desc: "Full HD" },
  { label: "1280 × 720",  width: 1280, height: 720,  desc: "HD" },
  { label: "960 × 480",   width: 960,  height: 480,  desc: "SD" },
] as const;

type SizeLabel = typeof SIZES[number]["label"];

interface ExtractedThumb {
  label: SizeLabel;
  width: number;
  height: number;
  desc: string;
  dataUrl: string; // canvas로 리사이즈된 정확한 해상도 이미지
  size: number;    // bytes
}

// ── 이미지 리사이즈 헬퍼 ───────────────────────────────────────────────
function resizeImageToDataUrl(
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): { dataUrl: string; size: number } {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  // 레터박스 없이 꽉 채우기 (cover)
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = targetW / targetH;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcRatio > dstRatio) {
    sw = Math.round(img.naturalHeight * dstRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else {
    sh = Math.round(img.naturalWidth / dstRatio);
    sy = Math.round((img.naturalHeight - sh) / 2);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const size = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);
  return { dataUrl, size };
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function YoutubeThumbnail() {
  const [url, setUrl]           = useState("");
  const [videoId, setVideoId]   = useState<string | null>(null);
  const [thumbs, setThumbs]     = useState<ExtractedThumb[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SIZES.map((s) => s.label))   // 기본값: 전체 선택
  );

  const toggleSize = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) { if (next.size > 1) next.delete(label); } // 최소 1개
      else next.add(label);
      return next;
    });

  const handleExtract = async () => {
    const id = extractYoutubeId(url);
    if (!id) { toast.error("올바른 YouTube URL을 입력하세요."); return; }

    setLoading(true);
    setVideoId(id);
    setThumbs([]);

    try {
      // 서버 API로 원본 이미지 가져오기 (CORS 우회)
      const res = await fetch(`/api/yt-thumbnail?id=${id}`);
      if (!res.ok) throw new Error("썸네일을 불러올 수 없습니다.");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("이미지 로드 실패"));
        img.src = objectUrl;
      });

      // 선택된 해상도만 리사이즈
      const results: ExtractedThumb[] = SIZES.filter((s) => selected.has(s.label)).map((s) => {
        const { dataUrl, size } = resizeImageToDataUrl(img, s.width, s.height);
        return { ...s, dataUrl, size };
      });

      URL.revokeObjectURL(objectUrl);
      setThumbs(results);
      toast.success("썸네일 추출 완료!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추출 실패");
      setVideoId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleExtract();
  };

  const downloadSingle = (thumb: ExtractedThumb) => {
    const a = document.createElement("a");
    a.href = thumb.dataUrl;
    a.download = `thumbnail-${videoId}-${thumb.width}x${thumb.height}.jpg`;
    a.click();
    toast.success(`${thumb.label} 다운로드 시작`);
  };

  const copyDataUrl = (thumb: ExtractedThumb) => {
    // URL 대신 원본 YouTube URL 복사
    const ytUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    navigator.clipboard.writeText(ytUrl);
    toast.success("URL 복사됨");
  };

  const downloadAll = async () => {
    if (!thumbs.length || !videoId) return;
    toast.loading("ZIP 생성 중...", { id: "yt-zip" });
    const zip = new JSZip();
    for (const t of thumbs) {
      const base64 = t.dataUrl.split(",")[1];
      zip.file(`thumbnail-${videoId}-${t.width}x${t.height}.jpg`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `thumbnails-${videoId}.zip`;
    a.click();
    toast.success("전체 다운로드 완료!", { id: "yt-zip" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* URL 입력 */}
      <div className="card" style={{ padding: "18px 22px" }}>
        <div className="section-label" style={{ marginBottom: 10 }}>YouTube URL</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://www.youtube.com/watch?v=..."
            className="notion-input"
            style={{ flex: 1, fontSize: 14, padding: "10px 14px" }}
          />
          <motion.button
            whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
            onClick={handleExtract}
            disabled={loading}
            className="btn-primary"
            style={{ padding: "10px 20px", borderRadius: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 14, opacity: loading ? 0.6 : 1 }}
          >
            {loading
              ? <><span className="animate-spin-slow" style={{ display: "inline-block" }}>⟳</span> 추출 중...</>
              : <><Search size={15} /> 추출</>
            }
          </motion.button>
        </div>

        {/* 해상도 선택 */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="section-label">추출할 해상도 선택</div>
          <div style={{ display: "flex", gap: 8 }}>
            {SIZES.map((s) => {
              const active = selected.has(s.label);
              return (
                <button
                  key={s.label}
                  onClick={() => toggleSize(s.label)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                    background: active ? "var(--accent-light)" : "var(--surface-hover)",
                    color: active ? "var(--accent-text)" : "var(--text-secondary)",
                    outline: active ? "1.5px solid rgba(94,106,210,0.35)" : "1.5px solid transparent",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.label.replace(" ", "")}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>
          youtube.com/watch?v= · youtu.be/ · /shorts/ 형식 지원
        </p>
      </div>

      {/* 빈 상태 */}
      {!videoId && !loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-tertiary)" }}>
          <Youtube size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>YouTube URL을 입력하고 추출 버튼을 누르세요</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>1920×1080 · 1280×720 · 960×480 세 가지 해상도로 추출</p>
        </div>
      )}

      {/* 썸네일 결과 */}
      <AnimatePresence>
        {thumbs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>추출된 썸네일</p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Video ID: {videoId}</p>
              </div>
              <button
                onClick={downloadAll}
                className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Archive size={14} /> 전체 ZIP 다운로드
              </button>
            </div>

            {/* 카드 3개 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {thumbs.map((thumb) => (
                <motion.div
                  key={thumb.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", gap: 0 }}>
                    {/* 썸네일 미리보기 */}
                    <div style={{ width: 200, flexShrink: 0, background: "#000", position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb.dataUrl}
                        alt={thumb.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>

                    {/* 정보 + 버튼 */}
                    <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>{thumb.label}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                            background: "var(--accent-light)", color: "var(--accent-text)",
                            border: "1px solid rgba(94,106,210,0.2)",
                          }}>{thumb.desc}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {(thumb.size / 1024).toFixed(0)} KB · JPEG
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <motion.button
                          whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                          onClick={() => downloadSingle(thumb)}
                          className="btn-primary"
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px", borderRadius: 7 }}
                        >
                          <Download size={14} /> 다운로드
                        </motion.button>
                        <button
                          onClick={() => copyDataUrl(thumb)}
                          className="btn-ghost"
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                        >
                          <Copy size={13} /> URL 복사
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
