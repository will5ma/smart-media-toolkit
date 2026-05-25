"use client";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Send,
  ImageIcon,
  FileText,
  Film,
  Video,
  FolderOpen,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { useAppStore, UploadedFile } from "@/store/appStore";
import { detectToolFromFile, detectToolFromText, generateId, formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ATTACH_OPTIONS = [
  { label: "Upload Images", icon: ImageIcon, accept: "image/*", color: "text-purple-400" },
  { label: "Upload Documents", icon: FileText, accept: ".pdf,.doc,.docx,.ppt,.pptx,.hwp", color: "text-blue-400" },
  { label: "Upload GIF", icon: Film, accept: ".gif", color: "text-pink-400" },
  { label: "Upload Video", icon: Video, accept: "video/*", color: "text-orange-400" },
  { label: "Upload Multiple", icon: FolderOpen, accept: "*", color: "text-green-400" },
];

export default function InputComposer() {
  const [text, setText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAccept, setPendingAccept] = useState("*");

  const { uploadedFiles, addFiles, removeFile, setActiveTool, addMessage } = useAppStore();

  const processFiles = useCallback(
    (files: File[]) => {
      const newFiles: UploadedFile[] = files.map((f) => ({
        id: generateId(),
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        status: "ready",
        progress: 100,
      }));
      addFiles(newFiles);

      if (files.length > 0) {
        const tool = detectToolFromFile(files[0]);
        setActiveTool(tool);
        toast.success(`${files.length} file(s) ready for ${tool.replace("-", " ")}`);
      }
    },
    [addFiles, setActiveTool]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    noClick: true,
    noKeyboard: true,
  });

  const handleSend = () => {
    if (!text.trim() && uploadedFiles.length === 0) return;

    const detected = detectToolFromText(text);
    if (detected) setActiveTool(detected);

    addMessage({
      id: generateId(),
      role: "user",
      content: text,
      files: uploadedFiles,
      timestamp: new Date(),
    });

    setText("");
    toast.success("Processing your request...", { duration: 2000 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachOption = (accept: string) => {
    setPendingAccept(accept);
    setShowAttach(false);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  return (
    <>
      {/* Global drag overlay */}
      {isDragActive && (
        <div className="drop-overlay">
          <div className="text-center">
            <Film size={48} className="mx-auto mb-4 text-purple-400 animate-bounce" />
            <p className="text-2xl font-bold text-white">Drop files to upload</p>
            <p className="text-white/60 mt-2">Images, Videos, GIFs, Documents — all supported</p>
          </div>
        </div>
      )}

      <div {...getRootProps()} className="w-full py-4">
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "0 24px" }}>
        {/* Uploaded file chips */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2 mb-2 flex-wrap"
            >
              {uploadedFiles.slice(0, 6).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/[0.08] border border-white/10 text-xs"
                >
                  {f.preview ? (
                    <img src={f.preview} alt="" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <FileText size={12} className="text-white/40" />
                  )}
                  <span className="text-white/70 max-w-[100px] truncate">{f.file.name}</span>
                  <span className="text-white/30">{formatBytes(f.file.size)}</span>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="text-white/30 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {uploadedFiles.length > 6 && (
                <div className="px-2 py-1.5 rounded-xl bg-white/[0.05] text-xs text-white/40">
                  +{uploadedFiles.length - 6} more
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input bar — Apple style */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            padding: "8px 8px 8px 12px",
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {/* Attach button */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowAttach(!showAttach)}
              style={{
                width: 38, height: 38,
                borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: showAttach ? "rgba(110,110,245,0.8)" : "rgba(255,255,255,0.07)",
                color: showAttach ? "#fff" : "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.2s",
              }}
            >
              <motion.div animate={{ rotate: showAttach ? 45 : 0 }} transition={{ duration: 0.2 }}>
                <Plus size={16} />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showAttach && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute", top: 42, left: 0, zIndex: 50,
                    background: "rgba(18,18,24,0.94)",
                    backdropFilter: "blur(30px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16, padding: 6, minWidth: 190,
                    boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                  }}
                >
                  {ATTACH_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleAttachOption(opt.accept)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", borderRadius: 10, fontSize: 12,
                        color: "rgba(255,255,255,0.65)", background: "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                      }}
                    >
                      <opt.icon size={14} className={opt.color} />
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste links, upload files, or describe what you want to create…"
            rows={1}
            style={{
              resize: "none", flex: 1, background: "transparent",
              fontSize: 14, color: "#f5f5f7", outline: "none",
              border: "none", paddingTop: 10, paddingBottom: 10,
              minHeight: 38, maxHeight: 140, overflowY: "auto",
              fontFamily: "inherit", letterSpacing: "-0.01em",
            }}
            className="placeholder:text-white/25"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />

          {/* Send button */}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleSend}
            disabled={!text.trim() && uploadedFiles.length === 0}
            style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: (text.trim() || uploadedFiles.length > 0)
                ? "linear-gradient(135deg, #6e6ef5, #4f46e5)"
                : "rgba(255,255,255,0.06)",
              color: (text.trim() || uploadedFiles.length > 0)
                ? "#fff" : "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: (text.trim() || uploadedFiles.length > 0) ? "pointer" : "not-allowed",
              boxShadow: (text.trim() || uploadedFiles.length > 0)
                ? "0 4px 14px rgba(110,110,245,0.4)" : "none",
              transition: "all 0.2s",
            }}
          >
            <Send size={15} />
          </motion.button>
        </div>
        </div>{/* end centering wrapper */}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={pendingAccept}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input {...getInputProps()} />
    </>
  );
}
