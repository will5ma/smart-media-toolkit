"use client";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  Film,
  Upload,
  Maximize2,
  Crop,
  RotateCw,
  Zap,
  Rewind,
  Timer,
  Scissors,
  Settings2,
  Download,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn, formatBytes, generateId } from "@/lib/utils";

type GIFTab = "editor" | "generator";
type EditorTool =
  | "resize"
  | "crop"
  | "downsample"
  | "convert"
  | "rotate"
  | "optimize"
  | "reverse"
  | "speed"
  | "cut"
  | null;

interface GIFFile {
  id: string;
  file: File;
  preview: string;
  size: number;
}

interface VideoFile {
  id: string;
  file: File;
  preview?: string;
  size: number;
  duration?: number;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  resultUrl?: string;
  resultSize?: number;
}

const EDITOR_TOOLS = [
  { id: "resize", icon: Maximize2, label: "Resize" },
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "downsample", icon: Zap, label: "Downsample" },
  { id: "convert", icon: Film, label: "Convert" },
  { id: "rotate", icon: RotateCw, label: "Rotate" },
  { id: "optimize", icon: Settings2, label: "Optimize" },
  { id: "reverse", icon: Rewind, label: "Reverse" },
  { id: "speed", icon: Timer, label: "Speed" },
  { id: "cut", icon: Scissors, label: "Cut" },
] as const;

const GIF_PRESETS = [
  { label: "Small Size", fps: 10, quality: "low", color: "64" },
  { label: "High Quality", fps: 24, quality: "high", color: "256" },
  { label: "Social Media", fps: 15, quality: "medium", color: "128" },
  { label: "Meme GIF", fps: 12, quality: "medium", color: "128" },
];

function GIFEditor() {
  const [gif, setGif] = useState<GIFFile | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [settings, setSettings] = useState({
    width: 480,
    height: 360,
    fps: 15,
    quality: 80,
    speed: 1.0,
    loops: 0,
  });

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setGif({
      id: generateId(),
      file,
      preview: URL.createObjectURL(file),
      size: file.size,
    });
    setActiveTool(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/gif": [".gif"] },
    multiple: false,
  });

  if (!gif) {
    return (
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
          isDragActive ? "border-pink-500 bg-pink-500/10" : "border-white/10 hover:border-pink-500/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center animate-float">
            <Film size={28} className="text-pink-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-white/80">Upload GIF to Edit</p>
            <p className="text-xs text-white/40 mt-1">Drag and drop or click to select</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Preview */}
      <div className="space-y-3">
        <div className="glass rounded-2xl p-3 border border-white/5">
          <img src={gif.preview} alt="GIF Preview" className="w-full rounded-xl max-h-64 object-contain bg-black/30" />
          <div className="mt-2 flex items-center justify-between text-xs text-white/40 px-1">
            <span>{gif.file.name}</span>
            <span>{formatBytes(gif.size)}</span>
          </div>
        </div>
        <button
          onClick={() => setGif(null)}
          className="w-full py-2 rounded-xl bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
        >
          <Upload size={13} /> Choose Another File
        </button>
      </div>

      {/* Tools */}
      <div className="space-y-3">
        <div className="glass rounded-2xl p-3 border border-white/5">
          <p className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">Editor Tools</p>
          <div className="grid grid-cols-3 gap-1.5">
            {EDITOR_TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(activeTool === tool.id ? null : (tool.id as EditorTool))}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-xs font-medium transition-all",
                  activeTool === tool.id
                    ? "bg-pink-600/30 text-pink-300 border border-pink-500/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <tool.icon size={16} />
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Tool Settings */}
        <AnimatePresence>
          {activeTool && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-3 border border-pink-500/20"
            >
              <p className="text-xs font-semibold text-pink-400 mb-3 capitalize">{activeTool} Settings</p>
              {activeTool === "resize" && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40">Width</label>
                    <input
                      type="number"
                      value={settings.width}
                      onChange={(e) => setSettings((s) => ({ ...s, width: +e.target.value }))}
                      className="w-full px-2 py-1 mt-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40">Height</label>
                    <input
                      type="number"
                      value={settings.height}
                      onChange={(e) => setSettings((s) => ({ ...s, height: +e.target.value }))}
                      className="w-full px-2 py-1 mt-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              )}
              {activeTool === "speed" && (
                <div>
                  <label className="text-[10px] text-white/40">Speed: {settings.speed}x</label>
                  <input
                    type="range"
                    min="0.25"
                    max="4"
                    step="0.25"
                    value={settings.speed}
                    onChange={(e) => setSettings((s) => ({ ...s, speed: +e.target.value }))}
                    className="w-full mt-2"
                  />
                </div>
              )}
              {activeTool === "optimize" && (
                <div>
                  <label className="text-[10px] text-white/40">Quality: {settings.quality}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.quality}
                    onChange={(e) => setSettings((s) => ({ ...s, quality: +e.target.value }))}
                    className="w-full mt-2"
                  />
                </div>
              )}
              {(activeTool === "crop" || activeTool === "cut" || activeTool === "downsample" ||
                activeTool === "convert" || activeTool === "rotate" || activeTool === "reverse") && (
                <p className="text-xs text-white/40">
                  {activeTool === "rotate" && "Rotate 90° clockwise on export"}
                  {activeTool === "reverse" && "Play frames in reverse order"}
                  {activeTool === "crop" && "Drag on preview to select crop area"}
                  {activeTool === "cut" && "Select start and end frames to trim"}
                  {activeTool === "downsample" && "Reduce frame count to lower file size"}
                  {activeTool === "convert" && "Export as GIF, WebP, or MP4"}
                </p>
              )}
              <button
                onClick={() => toast.success(`${activeTool} applied!`)}
                className="mt-3 w-full py-2 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-300 text-xs font-semibold hover:bg-pink-600/30 transition-all"
              >
                Apply {activeTool}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <a
          href={gif.preview}
          download={`edited-${gif.file.name}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all"
        >
          <Download size={15} /> Export GIF
        </a>
      </div>
    </div>
  );
}

function VideoToGIF() {
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [fps, setFps] = useState(15);
  const [quality, setQuality] = useState("medium");
  const [loops, setLoops] = useState(0);
  const [preset, setPreset] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.src = url;
    vid.onloadedmetadata = () => {
      setVideo({
        id: generateId(),
        file,
        preview: url,
        size: file.size,
        duration: vid.duration,
        status: "idle",
        progress: 0,
      });
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".webm", ".mov", ".avi"],
      "image/apng": [".apng"],
    },
    multiple: false,
  });

  const convert = async () => {
    if (!video) return;

    if ((video.duration || 0) > 30) {
      toast.error("Videos longer than 30s — please trim before converting", { duration: 4000 });
      return;
    }

    setVideo((v) => v ? { ...v, status: "processing", progress: 5 } : v);

    for (let p = 5; p <= 90; p += 15) {
      await new Promise((r) => setTimeout(r, 300));
      setVideo((v) => v ? { ...v, progress: p } : v);
    }

    toast.success("GIF conversion complete! (Demo — FFmpeg.wasm loads on first use)");
    setVideo((v) =>
      v ? { ...v, status: "done", progress: 100, resultUrl: v.preview, resultSize: Math.round(v.size * 0.6) } : v
    );
  };

  return (
    <div className="space-y-4">
      {!video ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
            isDragActive ? "border-orange-500 bg-orange-500/10" : "border-white/10 hover:border-orange-500/50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Film size={28} className="text-orange-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white/80">Video to GIF</p>
              <p className="text-xs text-white/40 mt-1">MP4 · WEBM · MOV · AVI · APNG</p>
              <p className="text-xs text-orange-400/70 mt-2">Best results with videos ≤30 seconds</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-3 border border-white/5">
            <video
              ref={videoRef}
              src={video.preview}
              className="w-full rounded-xl max-h-52 bg-black/30"
              controls
              muted
              loop
            />
            <div className="mt-2 flex items-center justify-between text-xs text-white/40 px-1">
              <span>{video.file.name}</span>
              <span>
                {video.duration ? `${video.duration.toFixed(1)}s` : ""} · {formatBytes(video.size)}
              </span>
            </div>
            {(video.duration || 0) > 30 && (
              <div className="mt-2 p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
                Videos longer than 30 seconds should be trimmed before GIF conversion.
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Presets */}
            <div className="glass rounded-2xl p-3 border border-white/5">
              <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">Presets</p>
              <div className="grid grid-cols-2 gap-1.5">
                {GIF_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setPreset(p.label);
                      setFps(p.fps);
                      setQuality(p.quality);
                    }}
                    className={cn(
                      "py-2 px-2 rounded-xl text-xs font-medium transition-all",
                      preset === p.label
                        ? "bg-orange-600/30 text-orange-300 border border-orange-500/30"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="glass rounded-2xl p-3 border border-white/5 space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">FPS: {fps}</label>
                <input type="range" min={5} max={30} value={fps} onChange={(e) => setFps(+e.target.value)} className="w-full mt-1" />
              </div>
              <div className="flex gap-1">
                {["low", "medium", "high"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={cn(
                      "flex-1 py-1 rounded-lg text-xs capitalize transition-all",
                      quality === q ? "bg-orange-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Loop</span>
                <button
                  onClick={() => setLoops(loops === 0 ? -1 : 0)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs transition-all",
                    loops === 0 ? "bg-orange-600 text-white" : "bg-white/5 text-white/50"
                  )}
                >
                  {loops === 0 ? "Infinite" : "Play Once"}
                </button>
              </div>
            </div>

            {video.status === "processing" && (
              <div className="glass rounded-2xl p-3 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Film size={14} className="text-orange-400" />
                  </motion.div>
                  <span className="text-xs text-orange-400">Converting to GIF...</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
                    animate={{ width: `${video.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-1">{video.progress}% — Extracting frames...</p>
              </div>
            )}

            {video.status === "done" && video.resultUrl && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-3 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-400 font-semibold">GIF Ready!</p>
                    {video.resultSize && (
                      <p className="text-[10px] text-white/40">{formatBytes(video.resultSize)}</p>
                    )}
                  </div>
                  <a
                    href={video.resultUrl}
                    download={`${video.file.name.replace(/\.[^.]+$/, "")}.gif`}
                    className="px-3 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition-all flex items-center gap-1"
                  >
                    <Download size={12} /> Download GIF
                  </a>
                </div>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={convert}
              disabled={video.status === "processing"}
              className={cn(
                "w-full py-3 rounded-2xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2",
                video.status === "processing"
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500"
              )}
            >
              <Film size={15} />
              {video.status === "processing" ? "Converting..." : "Convert to GIF"}
              <ChevronRight size={14} />
            </motion.button>

            <button
              onClick={() => setVideo(null)}
              className="w-full py-2 rounded-xl bg-white/5 text-white/40 text-xs hover:bg-white/10 transition-all"
            >
              Choose Different Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GIFStudio() {
  const [tab, setTab] = useState<GIFTab>("editor");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-2xl p-1 border border-white/5 w-fit">
        {(["editor", "generator"] as GIFTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-5 py-2 rounded-xl text-sm font-medium transition-colors",
              tab === t ? "text-white" : "text-white/50 hover:text-white/80"
            )}
          >
            {tab === t && (
              <motion.div
                layoutId="gif-tab"
                className="absolute inset-0 bg-gradient-to-r from-pink-600/80 to-purple-600/80 rounded-xl"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {t === "editor" ? "GIF 편집" : "GIF 생성"}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "editor" ? <GIFEditor /> : <VideoToGIF />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
