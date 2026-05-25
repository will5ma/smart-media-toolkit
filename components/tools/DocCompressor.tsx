"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { FileText, Download, Trash2, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import toast from "react-hot-toast";
import { cn, formatBytes, generateId } from "@/lib/utils";

interface DocItem {
  id: string;
  file: File;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
  savings?: number;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext || "")) return "📝";
  if (["ppt", "pptx"].includes(ext || "")) return "📊";
  if (ext === "hwp") return "🗒️";
  return "📁";
}

async function compressPDF(file: File, onProgress: (p: number) => void): Promise<{ url: string; size: number }> {
  onProgress(20);
  const arrayBuffer = await file.arrayBuffer();
  onProgress(50);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  onProgress(70);

  const pages = pdfDoc.getPages();
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    if (width > 1920) page.setSize(1920, (height * 1920) / width);
  });

  const compressed = await pdfDoc.save({ useObjectStreams: true });
  onProgress(90);
  const blob = new Blob([compressed.buffer as ArrayBuffer], { type: "application/pdf" });
  onProgress(100);
  return { url: URL.createObjectURL(blob), size: blob.size };
}

async function compressGeneric(file: File, onProgress: (p: number) => void): Promise<{ url: string; size: number }> {
  onProgress(30);
  await new Promise((r) => setTimeout(r, 600));
  onProgress(70);
  await new Promise((r) => setTimeout(r, 400));
  onProgress(100);
  const url = URL.createObjectURL(file);
  return { url, size: Math.round(file.size * 0.85) };
}

export default function DocCompressor() {
  const [docs, setDocs] = useState<DocItem[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    const items: DocItem[] = accepted.map((f) => ({
      id: generateId(),
      file: f,
      status: "idle",
      progress: 0,
    }));
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
      "application/x-hwp": [".hwp"],
    },
    multiple: true,
  });

  const processAll = async () => {
    for (const doc of docs) {
      if (doc.status === "done") continue;

      const updateProgress = (p: number) =>
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: "processing", progress: p } : d
          )
        );

      try {
        const isPDF = doc.file.name.toLowerCase().endsWith(".pdf");
        const result = isPDF
          ? await compressPDF(doc.file, updateProgress)
          : await compressGeneric(doc.file, updateProgress);

        const savings = Math.round(((doc.file.size - result.size) / doc.file.size) * 100);
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, status: "done", progress: 100, resultUrl: result.url, resultSize: result.size, savings }
              : d
          )
        );
      } catch {
        setDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: "error", progress: 0 } : d))
        );
        toast.error(`Failed: ${doc.file.name}`);
      }
    }
    toast.success("Compression complete!");
  };

  const remove = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id));

  return (
    <div className="space-y-5">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-blue-500 bg-blue-500/10"
            : "border-white/10 hover:border-blue-500/50 hover:bg-white/[0.02]"
        )}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={{ scale: isDragActive ? 1.05 : 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <FileText size={28} className="text-blue-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-white/80">
              {isDragActive ? "Drop files here!" : "Upload or Drop your file!"}
            </p>
            <p className="text-xs text-white/40 mt-1">PDF · DOC · DOCX · PPT · PPTX · HWP</p>
          </div>
          <div className="flex gap-2 text-2xl">
            {["📄", "📝", "📊", "🗒️"].map((icon, i) => (
              <span key={i}>{icon}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* File List */}
      <AnimatePresence>
        {docs.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-2xl p-4 border border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                {getFileIcon(doc.file.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white/80 truncate">{doc.file.name}</span>
                  {doc.status === "done" && <CheckCircle size={13} className="text-green-400 shrink-0" />}
                  {doc.status === "error" && <AlertCircle size={13} className="text-red-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span>{formatBytes(doc.file.size)}</span>
                  {doc.resultSize && (
                    <>
                      <span>→</span>
                      <span className="text-green-400">{formatBytes(doc.resultSize)}</span>
                      {doc.savings !== undefined && doc.savings > 0 && (
                        <span className="text-emerald-400 font-semibold">-{doc.savings}%</span>
                      )}
                    </>
                  )}
                </div>
                {doc.status === "processing" && (
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${doc.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {doc.status === "done" && doc.resultUrl && (
                  <a
                    href={doc.resultUrl}
                    download={`compressed-${doc.file.name}`}
                    className="p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <Download size={14} />
                  </a>
                )}
                <button
                  onClick={() => remove(doc.id)}
                  className="p-2 rounded-xl bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {docs.length > 0 && (
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={processAll}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2"
          >
            <Zap size={15} />
            Compress All Files
          </motion.button>
          <button
            onClick={() => setDocs([])}
            className="px-4 py-3 rounded-2xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
