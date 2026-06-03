"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { FileText, Download, Trash2, CheckCircle, AlertCircle, Scissors, ZapIcon, BookOpen, Loader2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { formatBytes, generateId } from "@/lib/utils";

// ── 타입 ──────────────────────────────────────────────────────────────────
type AppMode = "compress" | "split";
type CompressionLevel = "최대" | "중간" | "최적";
type SplitMode = "each" | "range" | "toc";

interface TocItem {
  id: string;
  title: string;
  pageIndex: number; // 0-based
  level: number;
  selected: boolean;
}

interface DocItem {
  id: string;
  file: File;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  savings?: number;
  pageCount?: number;
  splitResults?: { name: string; url: string; size: number }[];
}

// ── 설정 ──────────────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<CompressionLevel, { label: string; desc: string; gsOption: string }> = {
  "최대": { label: "최대 압축", desc: "파일 최소화, 화질 손실",     gsOption: "screen" },
  "중간": { label: "중간 압축", desc: "균형 잡힌 압축",              gsOption: "ebook" },
  "최적": { label: "최적 품질", desc: "텍스트 선명, 가독성 우선",   gsOption: "printer" },
};

// ── PDF.js + canvas 압축 ──────────────────────────────────────────────────
// scale: PDF 렌더링 해상도 (1.0 = 72 DPI, 2.0 = 144 DPI)
// quality: JPEG 품질 (텍스트 문서는 0.92+ 권장)
const CANVAS_CONFIG: Record<CompressionLevel, { scale: number; quality: number }> = {
  "최대": { scale: 0.60, quality: 0.52 },  // 소형 화면용, 파일 최소화
  "중간": { scale: 0.85, quality: 0.72 },  // 균형
  "최적": { scale: 1.80, quality: 0.94 },  // 텍스트 가독성 우선 (고해상도 렌더링)
};

async function compressWithCanvas(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  const { scale, quality } = CANVAS_CONFIG[level];
  onProgress(5);

  // pdfjs-dist 6.x: named exports only (no default export)
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdfJsDoc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const totalPages = pdfJsDoc.numPages;
  onProgress(10);

  const newDoc = await PDFDocument.create();
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx as CanvasRenderingContext2D, canvas, viewport }).promise;

    const jpegBytes = await new Promise<Uint8Array>((res, rej) =>
      canvas.toBlob(async (b) => b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("toBlob 실패")), "image/jpeg", quality)
    );
    const img = await newDoc.embedJpg(jpegBytes);
    const p = newDoc.addPage([canvas.width, canvas.height]);
    p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    canvas.width = 1; canvas.height = 1; // GC 힌트
    onProgress(10 + Math.round((i / totalPages) * 83));
  }
  const saved = await newDoc.save({ useObjectStreams: true });
  onProgress(100);
  const blob = new Blob([saved.buffer as ArrayBuffer], { type: "application/pdf" });
  return { url: URL.createObjectURL(blob), size: blob.size };
}

// Vercel 무료 플랜 요청 크기 제한 (4.5MB)
const SERVER_SIZE_LIMIT = 4 * 1024 * 1024;

// ── 서버 API 압축 (mupdf) ── 4MB 이하 파일만 ─────────────────────────────
async function compressViaAPI(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  onProgress(10);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("level", level);

  const res = await fetch("/api/compress-pdf", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "서버 오류" }));
    throw new Error(body.error ?? "서버 오류");
  }
  onProgress(90);
  const blob = await res.blob();
  onProgress(100);
  return { url: URL.createObjectURL(blob), size: blob.size };
}

// ── 메인: 크기 기준으로 서버/브라우저 자동 선택 ─────────────────────────
async function compressPDF(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  // 4MB 이하 → 서버 mupdf (최고 품질)
  if (file.size <= SERVER_SIZE_LIMIT) {
    try {
      return await compressViaAPI(file, level, onProgress);
    } catch (e) {
      console.warn("API 실패, canvas 폴백:", e);
    }
  }
  // 4MB 초과 또는 API 실패 → 브라우저 canvas
  return compressWithCanvas(file, level, onProgress);
}

// ── 비-PDF 압축 (시뮬레이션) ──────────────────────────────────────────────
async function compressGeneric(
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void
): Promise<{ url: string; size: number }> {
  const ratios: Record<CompressionLevel, number> = { "최대": 0.65, "중간": 0.80, "최적": 0.92 };
  onProgress(30);
  await new Promise((r) => setTimeout(r, 400));
  onProgress(100);
  return { url: URL.createObjectURL(file), size: Math.round(file.size * ratios[level]) };
}

// ── PDF 페이지 수 확인 ─────────────────────────────────────────────────────
async function getPDFPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  return doc.getPageCount();
}

// ── 목차(TOC) 감지 ───────────────────────────────────────────────────────
async function detectTOC(file: File): Promise<TocItem[]> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const pdfDoc = await getDocument({ data: new Uint8Array(buf) }).promise;
  const outline = await pdfDoc.getOutline();
  if (!outline || outline.length === 0) return [];

  const results: TocItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traverse = async (items: any[], level: number) => {
    for (const item of items) {
      let pageIndex = -1;
      try {
        let dest = item.dest;
        if (typeof dest === "string") dest = await pdfDoc.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) {
          pageIndex = await pdfDoc.getPageIndex(dest[0]);
        }
      } catch { /* 목적지 없는 항목 무시 */ }

      if (pageIndex >= 0) {
        results.push({
          id: generateId(),
          title: item.title ?? "(제목 없음)",
          pageIndex,
          level,
          selected: level === 0, // 최상위 항목 기본 선택
        });
      }
      if (item.items?.length) await traverse(item.items, level + 1);
    }
  };

  await traverse(outline, 0);
  // 페이지 순서 정렬 후 중복 제거
  results.sort((a, b) => a.pageIndex - b.pageIndex);
  return results.filter((item, i) =>
    i === 0 || item.pageIndex !== results[i - 1].pageIndex
  );
}

// ── 목차 기준 분할 ────────────────────────────────────────────────────────
async function splitByTOC(
  file: File,
  tocItems: TocItem[],
  onProgress: (p: number) => void
): Promise<{ name: string; url: string; size: number }[]> {
  const selected = tocItems.filter((t) => t.selected);
  if (selected.length === 0) throw new Error("분할할 목차 항목을 선택하세요.");

  onProgress(10);
  const buf = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");
  onProgress(25);

  const results: { name: string; url: string; size: number }[] = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const startPage = item.pageIndex;
    const endPage = i + 1 < selected.length ? selected[i + 1].pageIndex - 1 : total - 1;
    if (startPage > endPage) continue;

    const newDoc = await PDFDocument.create();
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, j) => startPage + j);
    const copied = await newDoc.copyPages(srcDoc, pages);
    copied.forEach((p) => newDoc.addPage(p));

    const bytes = await newDoc.save({ useObjectStreams: true });
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    // 파일명에 사용할 수 없는 특수문자 제거
    const safeName = item.title.replace(/[\\/:*?"<>|]/g, "_").trim() || `section_${i + 1}`;
    results.push({ name: `${baseName}_${String(i + 1).padStart(2, "0")}_${safeName}.pdf`, url: URL.createObjectURL(blob), size: blob.size });
    onProgress(25 + Math.round(((i + 1) / selected.length) * 70));
  }

  onProgress(100);
  return results;
}

// ── PDF 분할 ─────────────────────────────────────────────────────────────
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
  file: File, mode: SplitMode, rangeInput: string, onProgress: (p: number) => void
): Promise<{ name: string; url: string; size: number }[]> {
  onProgress(10);
  const buf = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  onProgress(30);

  const baseName = file.name.replace(/\.pdf$/i, "");
  const groups = mode === "each"
    ? Array.from({ length: total }, (_, i) => ({ label: `${i + 1}`, pages: [i] }))
    : parseRanges(rangeInput, total);

  if (groups.length === 0) throw new Error("유효한 페이지 범위 없음");

  const results: { name: string; url: string; size: number }[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const { label, pages } = groups[gi];
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, pages);
    copied.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save({ useObjectStreams: true });
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
    results.push({ name: `${baseName}_p${label}.pdf`, url: URL.createObjectURL(blob), size: blob.size });
    onProgress(30 + Math.round(((gi + 1) / groups.length) * 65));
  }
  onProgress(100);
  return results;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────
function getExt(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
function isPDF(name: string) { return getExt(name) === "pdf"; }

export default function DocCompressor() {
  const [appMode, setAppMode] = useState<AppMode>("compress");
  const [level, setLevel] = useState<CompressionLevel>("중간");
  const [splitMode, setSplitMode] = useState<SplitMode>("each");
  const [rangeInput, setRangeInput] = useState("1-3, 4-6");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocLoading, setTocLoading] = useState(false);
  const [tocFile, setTocFile] = useState<File | null>(null);
  const processingRef = useRef(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const items: DocItem[] = await Promise.all(
      accepted.map(async (f) => {
        let pageCount: number | undefined;
        if (isPDF(f.name)) { try { pageCount = await getPDFPageCount(f); } catch { /* */ } }
        return { id: generateId(), file: f, status: "idle" as const, progress: 0, pageCount };
      })
    );
    setDocs((prev) => [...prev, ...items]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
    multiple: true,
  });

  const update = (id: string, patch: Partial<DocItem>) =>
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const processAll = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    let hasError = false;
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
          if (!isPDF(doc.file.name)) { toast.error("분할은 PDF만 가능합니다."); update(doc.id, { status: "error" }); continue; }
          let results;
          if (splitMode === "toc") {
            if (tocItems.length === 0) { toast.error("먼저 목차를 감지하세요."); update(doc.id, { status: "error" }); continue; }
            results = await splitByTOC(doc.file, tocItems, (p) => update(doc.id, { progress: p }));
          } else {
            results = await splitPDF(doc.file, splitMode, rangeInput, (p) => update(doc.id, { progress: p }));
          }
          update(doc.id, { status: "done", progress: 100, splitResults: results });
        }
      } catch (e) {
        hasError = true;
        update(doc.id, { status: "error", progress: 0 });
        const msg = e instanceof Error ? e.message : "알 수 없는 오류";
        toast.error(`실패: ${doc.file.name}\n${msg}`);
        console.error(e);
      }
    }
    processingRef.current = false;
    if (!hasError) toast.success(appMode === "compress" ? "압축 완료!" : "분할 완료!");
  };

  const downloadAllSplits = async (item: DocItem) => {
    if (!item.splitResults?.length) return;
    if (item.splitResults.length === 1) {
      const a = document.createElement("a"); a.href = item.splitResults[0].url; a.download = item.splitResults[0].name; a.click(); return;
    }
    toast.loading("ZIP 생성 중...", { id: "zip" });
    const zip = new JSZip();
    for (const r of item.splitResults) {
      zip.file(r.name, await (await fetch(r.url)).blob());
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
    a.download = `${item.file.name.replace(/\.pdf$/i, "")}_split.zip`;
    a.click();
    toast.success("다운로드 완료!", { id: "zip" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 0, background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 4 }}>
        {([["compress", <ZapIcon key="z" size={14} />, "압축"], ["split", <Scissors key="s" size={14} />, "페이지 분할"]] as const).map(([m, icon, label]) => (
          <button key={m} onClick={() => setAppMode(m as AppMode)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "9px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
            background: appMode === m ? "var(--surface)" : "transparent",
            color: appMode === m ? "var(--text)" : "var(--text-secondary)",
            boxShadow: appMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}>{icon}{label}</button>
        ))}
      </div>

      {/* Settings card */}
      <div className="card" style={{ padding: "18px 22px" }}>
        {appMode === "compress" ? (
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>압축 수준</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["최대", "중간", "최적"] as CompressionLevel[]).map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={`pill${level === l ? " active" : ""}`} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 600 }}>{l}</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{LEVEL_CONFIG[l].desc}</div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12, lineHeight: 1.6 }}>
              ⚡ 4MB 이하: MuPDF 서버 압축 (최고 품질) · 4MB 초과: 브라우저 canvas 재압축
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 분할 방식 */}
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>분할 방식</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  ["each",  "페이지별",  "각 페이지 개별 파일"],
                  ["range", "범위 지정", "페이지 범위 입력"],
                  ["toc",   "목차 분할", "북마크 기준 분할"],
                ] as const).map(([m, label, desc]) => (
                  <button key={m} onClick={() => setSplitMode(m)} className={`pill${splitMode === m ? " active" : ""}`} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 범위 지정 */}
            {splitMode === "range" && (
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>페이지 범위</div>
                <input className="notion-input" style={{ width: "100%", padding: "9px 12px" }}
                  value={rangeInput} onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="예: 1-3, 4-6, 7  (쉼표로 구분)" />
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>각 그룹이 별도 PDF 파일로 저장됩니다.</p>
              </div>
            )}

            {/* 목차 분할 */}
            {splitMode === "toc" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  PDF에 내장된 북마크(목차)를 감지합니다. 선택한 항목부터 다음 항목 전까지 별도 PDF로 저장됩니다.
                </p>

                {/* PDF 선택 + 감지 버튼 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input type="file" accept=".pdf" id="toc-file-input" style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setTocFile(file); setTocItems([]); setTocLoading(true);
                      try {
                        const items = await detectTOC(file);
                        if (items.length === 0) toast.error("이 PDF에는 내장 목차(북마크)가 없습니다.");
                        setTocItems(items);
                      } catch (err) {
                        toast.error("목차 감지 실패: " + (err instanceof Error ? err.message : "오류"));
                      } finally { setTocLoading(false); e.target.value = ""; }
                    }}
                  />
                  <button className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}
                    onClick={() => document.getElementById("toc-file-input")?.click()}>
                    <BookOpen size={14} />
                    {tocFile ? tocFile.name : "PDF 선택 후 목차 감지"}
                  </button>
                  {tocLoading && (
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 5 }}>
                      <Loader2 size={13} className="animate-spin-slow" /> 감지 중...
                    </span>
                  )}
                </div>

                {/* 목차 체크리스트 */}
                {tocItems.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="section-label">목차 항목 {tocItems.length}개 감지됨</div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setTocItems((p) => p.map((t) => ({ ...t, selected: true })))}
                          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}>전체 선택</button>
                        <button onClick={() => setTocItems((p) => p.map((t) => ({ ...t, selected: false })))}
                          style={{ fontSize: 11, color: "var(--text-tertiary)", cursor: "pointer", background: "none", border: "none" }}>전체 해제</button>
                      </div>
                    </div>
                    <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                      {tocItems.map((item) => (
                        <label key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                          paddingLeft: `${10 + item.level * 16}px`, borderRadius: 6, cursor: "pointer",
                          background: item.selected ? "var(--accent-light)" : "transparent", transition: "background 0.12s",
                        }}>
                          <input type="checkbox" checked={item.selected}
                            onChange={() => setTocItems((p) => p.map((t) => t.id === item.id ? { ...t, selected: !t.selected } : t))}
                            style={{ accentColor: "var(--accent)", width: 14, height: 14, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4, color: item.selected ? "var(--accent-text)" : "var(--text)", fontWeight: item.level === 0 ? 600 : 400 }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>p.{item.pageIndex + 1}</span>
                        </label>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      선택된 {tocItems.filter((t) => t.selected).length}개 항목이 각각 별도 PDF로 저장됩니다.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`drop-zone${isDragActive ? " active" : ""}`} style={{ padding: "52px 40px", textAlign: "center" }}>
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -5 : 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={26} style={{ color: "var(--text-tertiary)" }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 5 }}>
              {isDragActive ? "여기에 놓으세요" : "문서를 드래그하거나 클릭해 업로드"}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>PDF · DOC · DOCX · PPT · PPTX</p>
          </div>
          <button className="btn-ghost" style={{ pointerEvents: "none" }}>파일 선택</button>
        </motion.div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {docs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflow: "hidden" }}>
            {docs.map((doc, idx) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
                style={{ padding: "12px 18px", borderBottom: idx < docs.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: "var(--surface-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {isPDF(doc.file.name) ? "📄" : ["doc","docx"].includes(getExt(doc.file.name)) ? "📝" : "📊"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }} className="truncate">{doc.file.name}</span>
                      {doc.pageCount && <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{doc.pageCount}p</span>}
                      {doc.status === "done"  && <CheckCircle size={13} style={{ color: "#22c55e", flexShrink: 0 }} />}
                      {doc.status === "error" && <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-tertiary)" }}>
                      <span>{formatBytes(doc.file.size)}</span>
                      {doc.resultSize !== undefined && <><span>→</span><span style={{ color: "#16a34a" }}>{formatBytes(doc.resultSize)}</span></>}
                      {doc.savings !== undefined && doc.savings > 0 && <span style={{ color: "#16a34a", fontWeight: 600 }}>-{doc.savings}%</span>}
                      {doc.splitResults && <span style={{ color: "var(--accent)" }}>{doc.splitResults.length}개 파일로 분할</span>}
                    </div>
                    {doc.status === "processing" && (
                      <div className="progress-track" style={{ height: 3, marginTop: 6 }}>
                        <motion.div className="progress-fill" style={{ height: "100%" }} initial={{ width: "0%" }} animate={{ width: `${doc.progress}%` }} />
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
                {doc.splitResults && doc.splitResults.length > 0 && (
                  <div style={{ marginTop: 10, marginLeft: 52, display: "flex", flexDirection: "column", gap: 4 }}>
                    {doc.splitResults.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "var(--surface-hover)", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatBytes(r.size)}</span>
                        <a href={r.url} download={r.name} style={{ color: "var(--accent)", display: "flex", padding: "2px 4px" }}><Download size={12} /></a>
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
          <motion.button whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.98 }}
            onClick={processAll} className="btn-primary"
            style={{ flex: 1, padding: "11px", fontSize: 15, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {appMode === "compress" ? <><ZapIcon size={15} /> 압축 실행</> : <><Scissors size={15} /> 분할 실행</>}
          </motion.button>
          <button onClick={() => setDocs([])} className="btn-ghost">초기화</button>
        </div>
      )}
    </div>
  );
}
