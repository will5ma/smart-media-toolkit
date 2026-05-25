"use client";
import { useEffect, useRef } from "react";

export default function AuroraBackground() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    const target = { x: 0.5, y: 0.5 };
    const current = { x: 0.5, y: 0.5 };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const animate = () => {
      current.x = lerp(current.x, target.x, 0.045);
      current.y = lerp(current.y, target.y, 0.045);

      const x = current.x;
      const y = current.y;

      // Hue shifts: left=purple, right=cyan, top=pink, bottom=blue
      const h1 = Math.round(260 - x * 80);           // 260→180
      const h2 = Math.round(320 - y * 120);           // 320→200
      const h3 = Math.round(190 + x * 70 - y * 40);  // dynamic teal

      const o1 = orb1Ref.current;
      const o2 = orb2Ref.current;
      const o3 = orb3Ref.current;

      if (o1) {
        o1.style.left = `${x * 100}%`;
        o1.style.top  = `${y * 100}%`;
        o1.style.background = `radial-gradient(circle, hsla(${h1},75%,62%,0.22) 0%, transparent 68%)`;
      }
      if (o2) {
        o2.style.left = `${(1 - x * 0.65) * 100}%`;
        o2.style.top  = `${(1 - y * 0.6) * 100}%`;
        o2.style.background = `radial-gradient(circle, hsla(${h2},70%,55%,0.18) 0%, transparent 68%)`;
      }
      if (o3) {
        o3.style.left = `${x * 35 + 10}%`;
        o3.style.top  = `${(1 - y) * 75 + 15}%`;
        o3.style.background = `radial-gradient(circle, hsla(${h3},80%,58%,0.14) 0%, transparent 68%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    const onMouseMove = (e: MouseEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = e.clientY / window.innerHeight;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const orbStyle: React.CSSProperties = {
    position: "absolute",
    width: "750px",
    height: "750px",
    borderRadius: "50%",
    filter: "blur(90px)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  };

  return (
    <div className="aurora-wrap" aria-hidden="true">
      <div ref={orb1Ref} style={orbStyle} />
      <div ref={orb2Ref} style={{ ...orbStyle, width: "600px", height: "600px" }} />
      <div ref={orb3Ref} style={{ ...orbStyle, width: "500px", height: "500px" }} />
    </div>
  );
}
