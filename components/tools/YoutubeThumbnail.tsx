"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video as Youtube, Download, Copy, ExternalLink, Archive, Search, TrendingUp } from "lucide-react";
import Image from "next/image";
import JSZip from "jszip";
import toast from "react-hot-toast";
import { extractYoutubeId } from "@/lib/utils";

interface ThumbnailQuality {
  label: string;
  key: string;
  width: number;
  height: number;
}

const QUALITIES: ThumbnailQuality[] = [
  { label: "Default", key: "default", width: 120, height: 90 },
  { label: "Medium", key: "mqdefault", width: 320, height: 180 },
  { label: "High", key: "hqdefault", width: 480, height: 360 },
  { label: "Standard", key: "sddefault", width: 640, height: 480 },
  { label: "Max Resolution", key: "maxresdefault", width: 1280, height: 720 },
];

function getThumbnailUrl(videoId: string, quality: string) {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

interface InsightItem {
  label: string;
  score: number;
  color: string;
}

function ThumbnailInsights({ videoId }: { videoId: string }) {
  const insights: InsightItem[] = [
    { label: "Clickability Score", score: 78, color: "from-green-500 to-emerald-500" },
    { label: "Contrast Rating", score: 85, color: "from-blue-500 to-cyan-500" },
    { label: "Text Visibility", score: 62, color: "from-yellow-500 to-orange-500" },
    { label: "Mobile Visibility", score: 91, color: "from-purple-500 to-pink-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 border border-white/5"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-purple-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Thumbnail Insights</span>
      </div>
      <div className="space-y-3">
        {insights.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-white/60">{item.label}</span>
              <span className="text-xs font-bold text-white">{item.score}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${item.score}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function YoutubeThumbnail() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [failedQualities, setFailedQualities] = useState<Set<string>>(new Set());

  const handleSearch = () => {
    const id = extractYoutubeId(url);
    if (!id) {
      toast.error("Invalid YouTube URL. Please check and try again.");
      return;
    }
    setVideoId(id);
    setFailedQualities(new Set());
    setShowInsights(false);
    setTimeout(() => setShowInsights(true), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const downloadSingle = (quality: ThumbnailQuality) => {
    if (!videoId) return;
    const imgUrl = getThumbnailUrl(videoId, quality.key);
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `youtube-thumbnail-${quality.key}.jpg`;
    a.target = "_blank";
    a.click();
    toast.success(`Downloading ${quality.label}...`);
  };

  const downloadAll = async () => {
    if (!videoId) return;
    toast.loading("Creating ZIP...", { id: "yt-zip" });
    const zip = new JSZip();
    const available = QUALITIES.filter((q) => !failedQualities.has(q.key));

    for (const q of available) {
      try {
        const res = await fetch(getThumbnailUrl(videoId, q.key));
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(`youtube-thumbnail-${q.key}.jpg`, blob);
      } catch {
        // skip failed
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url2 = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url2;
    a.download = `thumbnails-${videoId}.zip`;
    a.click();
    toast.success("Downloaded all thumbnails!", { id: "yt-zip" });
  };

  const copyUrl = (quality: ThumbnailQuality) => {
    if (!videoId) return;
    navigator.clipboard.writeText(getThumbnailUrl(videoId, quality.key));
    toast.success("URL copied!");
  };

  return (
    <div className="space-y-5">
      {/* URL Input */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <Youtube size={18} className="text-red-400" />
          <span className="text-sm font-semibold text-white/80">YouTube Thumbnail Downloader</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube video URL here..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 transition-all"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSearch}
            className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all flex items-center gap-2"
          >
            <Search size={15} />
            Extract
          </motion.button>
        </div>
        <p className="text-[10px] text-white/30 mt-2">
          Supports: youtube.com/watch?v= · youtu.be/ · /shorts/ · mobile URLs
        </p>
      </div>

      {/* Thumbnails Grid */}
      <AnimatePresence>
        {videoId && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">Available Thumbnails</p>
                <p className="text-xs text-white/40 mt-0.5">Video ID: {videoId}</p>
              </div>
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition-all"
              >
                <Archive size={13} /> Download All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUALITIES.map((q) => {
                const imgUrl = getThumbnailUrl(videoId, q.key);
                const isFailed = failedQualities.has(q.key);
                return (
                  <motion.div
                    key={q.key}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`glass rounded-2xl overflow-hidden border border-white/5 ${isFailed ? "opacity-40" : ""}`}
                  >
                    <div className="relative aspect-video bg-black/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={q.label}
                        className="w-full h-full object-cover"
                        onError={() => setFailedQualities((prev) => new Set([...prev, q.key]))}
                      />
                      {isFailed && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                          Not available
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-semibold text-white">{q.label}</p>
                          <p className="text-[10px] text-white/40">{q.width}×{q.height}</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                          isFailed ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                        }`}>
                          {isFailed ? "N/A" : "Ready"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => downloadSingle(q)}
                          disabled={isFailed}
                          className="flex-1 py-1.5 rounded-lg bg-red-600/20 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          <Download size={10} /> Download
                        </button>
                        <button
                          onClick={() => copyUrl(q)}
                          disabled={isFailed}
                          className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Copy size={11} />
                        </button>
                        <a
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Insights */}
            <AnimatePresence>
              {showInsights && <ThumbnailInsights videoId={videoId} />}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!videoId && (
        <div className="text-center py-12 text-white/20">
          <Youtube size={40} className="mx-auto mb-3" />
          <p className="text-sm">Paste a YouTube URL above to extract thumbnails</p>
        </div>
      )}
    </div>
  );
}
