"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Header() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        background: "rgba(247,247,252,0.85)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      <div className="max-w-screen-xl mx-auto px-8 h-14 flex items-center">
        <Link
          href="https://www.wearablesearch.co.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 shrink-0"
        >
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-8 h-8 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`}
              alt="WearableSearch"
              className="w-full h-full object-contain"
            />
          </motion.div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight" style={{ color: "#1d1d2e" }}>WearableSearch</div>
            <div className="text-[10px] tracking-wide" style={{ color: "rgba(0,0,0,0.35)" }}>웨어러블서치</div>
          </div>
        </Link>
      </div>
    </header>
  );
}
