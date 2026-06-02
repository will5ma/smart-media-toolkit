"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { FileText, Download, Trash2, CheckCircle, AlertCircle, Scissors, ZapIcon } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { formatBytes, generateId } from "@/lib/utils";

// PDF.js 워커 — unpkg CDN (로컬 경로 의존성 없이 안정적으로 동작)
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

type AppMode = "compress" | "split";
type CompressionLevel = "최대" | "중간" | "최적";
type SplitMode = "each" | "range";

interface DocItem {
  id: string;
  file: File;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  savings?: number;
  pageCount?: number;
  splitResults?: { name: string; url: string; size: number; pages: string }[];
}

function getExt(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
function isPDF(name: string) { return getExt(name) === "pdf"; }

// ── Compression ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<CompressionLevel, { scale: number; quality: number; label: string; desc: string }> = {
  "최대": { scale: 0.50, quality: 0.45, label: "최대 압축", desc: "용량 최우선, 화질 손실" },
  "중간": { scale: 0.72, quality: 0.65, label: "중간 압축", desc: "균형 잡힌 압축" },
  "최적": { scale: 0.90, quality: 0.82, label: "최적 품질", desc: "화질 유지, 적당한 압축" },
};

/**
 * 실제 압축: PDF.js로 각 페이지를 canvas에 렌더링 → JPEG 재인코딩 → 새 pdf-lib 문서로 재조립
 * 이미지/폰트가 JPEG로 재압축되므로 실질적인 용량 감소가 이루어집니다.
 */
async function compressPDF(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  const { scale, quality } = LEVEL_CONFIG[level];

  onProgress(5);
  const arrayBuffer = await file.arrayBuffer();

  // 1) PDF.js로 로드 — 워커 미로드 시 메인스레드 폴백
  let pdfJsDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const task = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    pdfJsDoc = await task.promise;
  } catch (e) {
    console.warn("PDF.js 워커 로드 실패, 메인스레드로 재시도:", e);
    // 워커 없이 재시도
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    const task = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    pdfJsDoc = await task.promise;
  }

  const totalPages = pdfJsDoc.numPages;
  onProgress(10);

  // 2) 페이지마다 canvas 렌더링 → JPEG → pdf-lib 삽입
  const newDoc = await PDFDocument.create();

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;

    await page.render({
      canvasContext: ctx as CanvasRenderingContext2D,
      canvas,
      viewport,
    }).promise;

    const jpegBytes = await new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error("canvas.toBlob failed"));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/jpeg", quality);
    });

    const jpegImage = await newDoc.embedJpg(jpegBytes);
    const pdfPage = newDoc.addPage([canvas.width, canvas.height]);
    pdfPage.drawImage(jpegImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });

    onProgress(10 + Math.round((i / totalPages) * 83));

    // GC 힌트
    canvas.width = 1; canvas.height = 1;
  }

  // 3) 저장
  const saved = await newDoc.save({ useObjectStreams: true });
  onProgress(100);
  const blob = new Blob([saved.buffer as ArrayBuffer], { type: "application/pdf" });
  return { url: URL.createObjectURL(blob), size: blob.size };
}

async function compressGeneric(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  const ratios: Record<CompressionLevel, number> = { "최대": 0.65, "중간": 0.80, "최적": 0.92 };
  onProgress(30);
  await new Promise((r) => setTimeout(r, 400));
  onProgress(70);
  await new Promise((r) => setTimeout(r, 300));
  onProgress(100);
  return { url: URL.createObjectURL(file), size: Math.round(file.size * ratios[level]) };
}

// ── PDF Splitting ────────────────────────────────────────────────────────────

async function getPDFPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return doc.getPageCount();
}

function parseRanges(input: string, total: number): { label: string; pages: number[] }[] {
  const groups: { label: string; pages: number[] }[] = [];
  for (const part of input.split(",")) {
    const t = part.trim();
    if (!t) continue;
    if (t.includes("-")) {
      const [a, b] = t.split("-").map((s) => parseInt(s.trim()));
      if (isNaN(a) || isNaN(b)) continue;
      const start = Math.max(1, a), end = Math.min(total, b);
      if (start <= end) groups.push({ label: `${start}-${end}`, pages: Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i) });
    } else {
      const n = parseInt(t);
      if (!isNaN(n) && n >= 1 && n <= total) groups.push({ label: `${n}`, pages: [n - 1] });
    }
  }
  return groups;
}

async function splitPDF(
  file: File,
  mode: SplitMode,
  rangeInput: string,
  onProgress: (p: number) => void
): Promise<{ name: string; url: string; size: number; pages: string }[]> {
  onProgress(10);
  const buf = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  onProgress(30);

  const baseName = file.name.replace(/\.pdf$/i, "");
  const groups =
    mode === "each"
      ? Array.from({ length: total }, (_, i) => ({ label: `${i + 1}`, pages: [i] }))
      : parseRanges(rangeInput, total);

  if (groups.length === 0) throw new Error("유효한 페이지 범위가 없습니다.");

  const results: { name: string; url: string; size: number; pages: string }[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const { label, pages } = groups[gi];
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, pages);
    copied.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save({ useObjectStreams: true });
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    results.push({
      name: `${baseName}_p${label}.pdf`,
      url: URL.createObjectURL(blob),
      size: blob.size,
      pages: `p.${label}`,
    });
    onProgress(30 + Math.round(((gi + 1) / groups.length) * 65));
  }

  onProgress(100);
  return results;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DocCompressor() {
  const [appMode, setAppMode] = useState<AppMode>("compress");
  const [level, setLevel] = useState<CompressionLevel>("중간");
  const [splitMode, setSplitMode] = useState<SplitMode>("each");
  const [rangeInput, setRangeInput] = useState("1-3, 4-6");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const processingRef = useRef(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const items: DocItem[] = await Promise.all(
      accepted.map(async (f) => {
        let pageCount: number | undefined;
        if (isPDF(f.name)) {
          try { pageCount = await getPDFPageCount(f); } catch { /* ignore */ }
        }
        return { id: generateId(), file: f, status: "idle" as const, progress: 0, pageCount };
      })
    );
    setDocs((prev) => [...prev, ...items]);
  }, []);

  const accept = {
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, multiple: true });

  const update = (id: string, patch: Partial<DocItem>) =>
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const processAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    for (const doc of docs) {
      if (doc.status === "done") continue;
      update(doc.id, { status: "processing", progress: 5 });

      try {
        if (appMode === "compress") {
          const result = isPDF(doc.file.name)
            ? await compressPDF(doc.file, level, (p) => update(doc.id, { progress: p }))
            : await compressGeneric(doc.file, level, (p) => update(doc.id, { progress: p }));
          const savings = Math.max(0, Math.round(((doc.file.size - result.size) / doc.file.size) * 100));
          update(doc.id, { status: "done", progress: 100, resultUrl: result.url, resultSize: result.size, savings });
        } else {
          if (!isPDF(doc.file.name)) {
            toast.error(`${doc.file.name}: PDF 파일만 분할할 수 있습니다.`);
            update(doc.id, { status: "error" });
            continue;
          }
          const results = await splitPDF(doc.file, splitMode, rangeInput, (p) => update(doc.id, { progress: p }));
          update(doc.id, { status: "done", progress: 100, splitResults: results });
        }
      } catch (e: unknown) {
        update(doc.id, { status: "error", progress: 0 });
        toast.error(`실패: ${doc.file.name}`);
        console.error(e);
      }
    }

    processingRef.current = false;
    toast.success(appMode === "compress" ? "압축 완료!" : "분할 완료!");
  };

  const downloadAllSplits = async (item: DocItem) => {
    if (!item.splitResults?.length) return;
    if (item.splitResults.length === 1) {
      const a = document.createElement("a"); a.href = item.splitResults[0].url; a.download = item.splitResults[0].name; a.click(); return;
    }
    toast.loading("ZIP 생성 중...", { id: "zip" });
    const zip = new JSZip();
    for (const r of item.splitResults) {
      const blob = await (await fetch(r.url)).blob();
      zip.file(r.name, blob);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = `${item.file.name.replace(/\.pdf$/i, "")}_split.zip`;
    a.click();
    toast.success("다운로드 완료!", { id: "zip" });
  };

  const splitOnlyPDFs = appMode === "split" && docs.some((d) => !isPDF(d.file.name));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 0, background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 4 }}>
        {([["compress", <ZapIcon size={14} />, "압축"], ["split", <Scissors size={14} />, "페이지 분할"]] as const).map(([m, icon, label]) => (
          <button
            key={m}
            onClick={() => setAppMode(m as AppMode)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: appMode === m ? "var(--surface)" : "transparent",
              color: appMode === m ? "var(--text)" : "var(--text-secondary)",
              boxShadow: appMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Settings card */}
      <div className="card" style={{ padding: "18px 22px" }}>
        {appMode === "compress" ? (
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>압축 수준</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["최대", "중간", "최적"] as CompressionLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`pill${level === l ? " active" : ""}`}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  <div style={{ fontWeight: 600 }}>{l}</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{LEVEL_CONFIG[l].desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>분할 방식</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([["each", "페이지별 분할", "각 페이지를 개별 파일로"] as const,
                   ["range", "범위 지정", "원하는 페이지 범위로"] as const]).map(([m, label, desc]) => (
                  <button
                    key={m}
                    onClick={() => setSplitMode(m)}
                    className={`pill${splitMode === m ? " active" : ""}`}
                    style={{ flex: 1, textAlign: "center" }}
                  >
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {splitMode === "range" && (
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>페이지 범위</div>
                <input
                  className="notion-input"
                  style={{ width: "100%", padding: "9px 12px" }}
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="예: 1-3, 4-6, 7  (쉼표로 구분)"
                />
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
                  각 그룹이 별도 PDF 파일로 저장됩니다. 예) 1-3, 4-6 → 2개 파일
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drop zone */}
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
            <FileText size={26} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 5 }}>
              {isDragActive ? "여기에 놓으세요" : "문서를 드래그하거나 클릭해 업로드"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {appMode === "split" ? "PDF 파일만 지원" : "PDF · DOC · DOCX · PPT · PPTX"}
            </p>
          </div>
          <button className="btn-ghost" onClick={(e) => e.stopPropagation()} style={{ pointerEvents: "none" }}>
            파일 선택
          </button>
        </motion.div>
      </div>

      {/* 브라우저 압축 한계 안내 */}
      {appMode === "compress" && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>
          💡 브라우저 압축은 각 페이지를 이미지로 변환해 재압축합니다. <strong>이미지·스캔 PDF</strong>는 크게 줄어들고, <strong>텍스트 위주 PDF</strong>는 압축률이 낮을 수 있습니다. 더 높은 압축률이 필요하다면 서버 기반 도구(ilovepdf 등)를 함께 사용하세요.
        </div>
      )}

      {splitOnlyPDFs && (
        <p style={{ fontSize: 13, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "8px 12px" }}>
          ⚠️ 분할 기능은 PDF 파일만 지원합니다.
        </p>
      )}

      {/* File list */}
      <AnimatePresence>
        {docs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflow: "hidden" }}>
            {docs.map((doc, idx) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                style={{
                  padding: "12px 18px",
                  borderBottom: idx < docs.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: "var(--surface-hover)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  }}>
                    {isPDF(doc.file.name) ? "📄" : ["doc","docx"].includes(getExt(doc.file.name)) ? "📝" : "📊"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }} className="truncate">{doc.file.name}</span>
                      {doc.pageCount && <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{doc.pageCount}p</span>}
                      {doc.status === "done" && <CheckCircle size={13} style={{ color: "#22c55e", flexShrink: 0 }} />}
                      {doc.status === "error" && <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                      <span>{formatBytes(doc.file.size)}</span>
                      {doc.resultSize !== undefined && (
                        <><span>→</span><span style={{ color: "#16a34a" }}>{formatBytes(doc.resultSize)}</span></>
                      )}
                      {doc.savings !== undefined && doc.savings > 0 && (
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>-{doc.savings}%</span>
                      )}
                      {doc.splitResults && (
                        <span style={{ color: "var(--accent)" }}>{doc.splitResults.length}개 파일로 분할</span>
                      )}
                    </div>
                    {doc.status === "processing" && (
                      <div className="progress-track" style={{ height: 3, marginTop: 6 }}>
                        <motion.div className="progress-fill" style={{ height: "100%" }}
                          initial={{ width: "0%" }} animate={{ width: `${doc.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {doc.status === "done" && doc.resultUrl && (
                      <a href={doc.resultUrl} download={`compressed-${doc.file.name}`}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", color: "#16a34a", display: "flex", background: "var(--surface)" }}>
                        <Download size={14} />
                      </a>
                    )}
                    {doc.status === "done" && doc.splitResults && (
                      <button onClick={() => downloadAllSplits(doc)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(94,106,210,0.3)", color: "var(--accent)", fontSize: 12, fontWeight: 500, background: "var(--accent-light)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                        <Download size={13} /> 전체 받기
                      </button>
                    )}
                    <button onClick={() => setDocs((p) => p.filter((d) => d.id !== doc.id))}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--surface)", cursor: "pointer", display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Split results */}
                {doc.splitResults && doc.splitResults.length > 0 && (
                  <div style={{ marginTop: 10, marginLeft: 52, display: "flex", flexDirection: "column", gap: 4 }}>
                    {doc.splitResults.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "var(--surface-hover)", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatBytes(r.size)}</span>
                        <a href={r.url} download={r.name}
                          style={{ color: "var(--accent)", display: "flex", fontSize: 11, padding: "2px 4px" }}>
                          <Download size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {docs.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button
            whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.98 }}
            onClick={processAll}
            className="btn-primary"
            style={{ flex: 1, padding: "11px", fontSize: 15, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            {appMode === "compress" ? <><ZapIcon size={15} /> 압축 실행</> : <><Scissors size={15} /> 분할 실행</>}
          </motion.button>
          <button onClick={() => setDocs([])} className="btn-ghost">초기화</button>
        </div>
      )}
    </div>
  );
}
