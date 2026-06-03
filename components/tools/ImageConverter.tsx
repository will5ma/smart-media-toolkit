"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Download, Trash2, CheckCircle, AlertCircle, RefreshCw,
  Archive, FolderOpen, ImageIcon, ArrowRight,
} from "lucide-react";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { formatBytes, generateId } from "@/lib/utils";

// ── 타입 ──────────────────────────────────────────────────────────────────
type OutputFormat = "jpg" | "png";
type AppMode      = "files" | "folder";

interface ConvertItem {
  id: string;
  file: File;
  previewUrl: string;
  inputExt: string;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  errorMsg?: string;
}

// ── 지원 확장자 ─────────────────────────────────────────────────────────
const ACCEPTED_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

function getExt(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}
function isImageFile(file: File) {
  return ACCEPTED_EXTS.includes(getExt(file));
}

// ── 변환 함수 ──────────────────────────────────────────────────────────
async function convertFile(
  file: File,
  fmt: OutputFormat,
  quality: number
): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth  || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext("2d")!;

      // JPG는 투명 배경을 흰색으로
      if (fmt === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("변환 실패"));
          resolve({ url: URL.createObjectURL(blob), size: blob.size });
        },
        mime,
        fmt === "jpg" ? quality / 100 : undefined
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("이미지 로드 실패")); };
    img.src = objectUrl;
  });
}

// ── 포맷 뱃지 색상 ─────────────────────────────────────────────────────
const EXT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  jpg:  { bg: "rgba(234,179,8,0.1)",   text: "#ca8a04",  border: "rgba(234,179,8,0.25)"  },
  jpeg: { bg: "rgba(234,179,8,0.1)",   text: "#ca8a04",  border: "rgba(234,179,8,0.25)"  },
  png:  { bg: "rgba(59,130,246,0.1)",  text: "#2563eb",  border: "rgba(59,130,246,0.25)" },
  webp: { bg: "rgba(34,197,94,0.1)",   text: "#16a34a",  border: "rgba(34,197,94,0.25)"  },
  gif:  { bg: "rgba(168,85,247,0.1)",  text: "#9333ea",  border: "rgba(168,85,247,0.25)" },
  avif: { bg: "rgba(239,68,68,0.1)",   text: "#dc2626",  border: "rgba(239,68,68,0.25)"  },
};
function ExtBadge({ ext }: { ext: string }) {
  const c = EXT_COLOR[ext] ?? { bg: "rgba(0,0,0,0.05)", text: "var(--text-secondary)", border: "var(--border)" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
      background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {ext.toUpperCase()}
    </span>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function ImageConverter() {
  const [mode, setMode]           = useState<AppMode>("files");
  const [format, setFormat]       = useState<OutputFormat>("jpg");
  const [quality, setQuality]     = useState(90);
  const [items, setItems]         = useState<ConvertItem[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const folderInputRef            = useRef<HTMLInputElement>(null);
  const processingRef             = useRef(false);

  // ── 파일 모드: 드롭존 ───────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    const filtered = accepted.filter(isImageFile);
    if (!filtered.length) { toast.error("지원 형식: JPG, PNG, WEBP, GIF, AVIF"); return; }
    setItems((prev) => [
      ...prev,
      ...filtered.map((file) => ({
        id: generateId(), file,
        previewUrl: URL.createObjectURL(file),
        inputExt: getExt(file),
        status: "idle" as const, progress: 0,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png":  [".png"],
      "image/webp": [".webp"],
      "image/gif":  [".gif"],
      "image/avif": [".avif"],
    },
    multiple: true,
    noClick: mode === "folder",
  });

  // ── 폴더 모드: 폴더 인풋 ────────────────────────────────────────────
  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(isImageFile);
    if (!files.length) { toast.error("폴더에서 지원하는 이미지가 없습니다."); return; }
    const name = files[0].webkitRelativePath?.split("/")[0] ?? "선택된 폴더";
    setFolderName(name);
    setItems(files.map((file) => ({
      id: generateId(), file,
      previewUrl: URL.createObjectURL(file),
      inputExt: getExt(file),
      status: "idle" as const, progress: 0,
    })));
    e.target.value = "";
  };

  // ── 변환 실행 ────────────────────────────────────────────────────────
  const update = (id: string, patch: Partial<ConvertItem>) =>
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const convertAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    let hasError = false;

    const targets = items.filter((i) => i.status === "idle" || i.status === "error");
    for (const item of targets) {
      update(item.id, { status: "processing", progress: 20 });
      try {
        await new Promise((r) => setTimeout(r, 30));
        update(item.id, { progress: 60 });
        const result = await convertFile(item.file, format, quality);
        update(item.id, { status: "done", progress: 100, resultUrl: result.url, resultSize: result.size });
      } catch (e) {
        hasError = true;
        const msg = e instanceof Error ? e.message : "오류";
        update(item.id, { status: "error", progress: 0, errorMsg: msg });
        toast.error(`실패: ${item.file.name}`);
      }
    }

    processingRef.current = false;
    if (!hasError) {
      // 폴더 모드는 변환 완료 후 바로 ZIP 다운로드
      if (mode === "folder") await downloadZip();
      else toast.success("변환 완료!");
    }
  };

  // ── ZIP 다운로드 ─────────────────────────────────────────────────────
  const downloadZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    toast.loading("ZIP 생성 중...", { id: "conv-zip" });
    const zip = new JSZip();
    for (const item of done) {
      const blob = await (await fetch(item.resultUrl!)).blob();
      const base = item.file.name.replace(/\.[^.]+$/, "");
      zip.file(`${base}.${format}`, blob);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = mode === "folder"
      ? `${folderName ?? "images"}-${format}.zip`
      : `converted-${format}.zip`;
    a.click();
    toast.success("ZIP 다운로드 완료!", { id: "conv-zip" });
  };

  const downloadSingle = (item: ConvertItem) => {
    if (!item.resultUrl) return;
    const a = document.createElement("a");
    a.href = item.resultUrl;
    a.download = `${item.file.name.replace(/\.[^.]+$/, "")}.${format}`;
    a.click();
  };

  const reset = () => { setItems([]); setFolderName(null); };

  const allDone = items.length > 0 && items.every((i) => i.status === "done");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* 모드 탭 */}
      <div style={{ display: "flex", gap: 0, background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 4 }}>
        {([["files", <ImageIcon key="i" size={14} />, "파일 변환"],
           ["folder", <FolderOpen key="f" size={14} />, "폴더 일괄 변환"]] as const).map(([m, icon, label]) => (
          <button key={m} onClick={() => { setMode(m); reset(); }}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: mode === m ? "var(--surface)" : "transparent",
              color: mode === m ? "var(--text)" : "var(--text-secondary)",
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}>{icon}{label}</button>
        ))}
      </div>

      {/* 변환 설정 */}
      <div className="card" style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          {/* 출력 형식 */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>출력 형식</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["jpg", "png"] as OutputFormat[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`pill${format === f ? " active" : ""}`}
                  style={{ padding: "7px 24px", fontWeight: 700, fontSize: 15 }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* JPG 품질 */}
          {format === "jpg" && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>품질: {quality}%</div>
              <input
                type="range" min={10} max={100} step={5} value={quality}
                onChange={(e) => setQuality(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 10 }}>
          {format === "jpg"
            ? "JPG — 사진에 최적, 투명 배경 흰색 처리, 파일 크기 작음"
            : "PNG — 투명 배경 유지, 손실 없음, 로고·아이콘에 적합"}
        </p>
      </div>

      {/* ── 파일 모드: 드롭존 ── */}
      {mode === "files" && (
        <div {...getRootProps()} className={`drop-zone${isDragActive ? " active" : ""}`}
          style={{ padding: "52px 40px", textAlign: "center" }}>
          <input {...getInputProps()} />
          <motion.div animate={{ y: isDragActive ? -5 : 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ImageIcon size={26} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                {isDragActive ? "여기에 놓으세요" : "이미지를 드래그하거나 클릭해 선택"}
              </p>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {["JPG", "PNG", "WEBP", "GIF", "AVIF"].map((ext) => (
                  <ExtBadge key={ext} ext={ext.toLowerCase()} />
                ))}
              </div>
            </div>
            <button className="btn-ghost" style={{ pointerEvents: "none" }}>파일 선택</button>
          </motion.div>
        </div>
      )}

      {/* ── 폴더 모드 ── */}
      {mode === "folder" && (
        <div className="card" style={{ padding: "40px 32px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderOpen size={28} style={{ color: "var(--text-tertiary)" }} />
            </div>
            {folderName ? (
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>📁 {folderName}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  이미지 {items.length}개 감지됨
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>폴더 선택</p>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  폴더 안의 JPG, PNG, WEBP, GIF, AVIF를 모두 {format.toUpperCase()}로 변환
                </p>
              </div>
            )}
            <button
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpen size={15} /> {folderName ? "다른 폴더 선택" : "폴더 선택"}
            </button>
          </div>
          {/* webkitdirectory 폴더 인풋 */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFolderInput}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ webkitdirectory: "", directory: "" } as any)}
          />
        </div>
      )}

      {/* 파일 목록 */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflow: "hidden" }}>
            {/* 요약 바 */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {items.length}개 파일 · {items.filter((i) => i.status === "done").length}개 완료
              </span>
              {allDone && mode === "files" && (
                <button onClick={downloadZip} className="btn-ghost"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 12px" }}>
                  <Archive size={13} /> ZIP 다운로드
                </button>
              )}
            </div>

            {/* 파일 행 — 최대 50개 표시 */}
            {items.slice(0, 50).map((item, idx) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: "10px 18px", borderBottom: idx < Math.min(items.length, 50) - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 12 }}>

                {/* 썸네일 */}
                <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", background: "var(--surface-hover)", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <img src={item.resultUrl ?? item.previewUrl} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }} className="truncate">{item.file.name}</span>
                    <ExtBadge ext={item.inputExt} />
                    <ArrowRight size={10} style={{ color: "var(--text-tertiary)" }} />
                    <ExtBadge ext={format} />
                    {item.status === "done"  && <CheckCircle size={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    {item.status === "error" && <AlertCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                    <span>{formatBytes(item.file.size)}</span>
                    {item.resultSize && <><span>→</span><span style={{ color: "#16a34a" }}>{formatBytes(item.resultSize)}</span></>}
                    {item.status === "error" && item.errorMsg && <span style={{ color: "#ef4444" }}>{item.errorMsg}</span>}
                  </div>
                  {item.status === "processing" && (
                    <div className="progress-track" style={{ height: 2, marginTop: 5 }}>
                      <motion.div className="progress-fill" style={{ height: "100%" }}
                        initial={{ width: "0%" }} animate={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>

                {/* 개별 다운로드 */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {item.status === "done" && item.resultUrl && mode === "files" && (
                    <button onClick={() => downloadSingle(item)}
                      style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--accent)", background: "var(--surface)", cursor: "pointer", display: "flex" }}>
                      <Download size={13} />
                    </button>
                  )}
                  <button onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                    style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--surface)", cursor: "pointer", display: "flex" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
            {items.length > 50 && (
              <div style={{ padding: "8px 18px", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
                +{items.length - 50}개 파일 (목록은 최대 50개 표시 · 변환은 전체 처리)
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 액션 버튼 */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.98 }}
            onClick={convertAll}
            disabled={processingRef.current}
            className="btn-primary"
            style={{ flex: 1, padding: "11px", fontSize: 15, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <RefreshCw size={15} />
            {format.toUpperCase()}로 변환 {mode === "folder" ? "→ ZIP 다운로드" : `(${items.length}개)`}
          </motion.button>
          {allDone && mode === "folder" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              onClick={downloadZip}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}
            >
              <Archive size={15} /> ZIP 재다운로드
            </motion.button>
          )}
          <button onClick={reset} className="btn-ghost">초기화</button>
        </div>
      )}
    </div>
  );
}
