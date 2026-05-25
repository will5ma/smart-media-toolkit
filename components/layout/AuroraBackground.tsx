"use client";
import { useEffect, useRef } from "react";

export default function AuroraBackground() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    let t = 0;

    const mouse = { x: 0.5, y: 0.5 };
    const current = { x: 0.5, y: 0.5 };
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    const animate = () => {
      t += 0.004;

      // Blend mouse position with slow auto-drift
      const autoX = 0.5 + Math.sin(t * 0.7) * 0.35;
      const autoY = 0.5 + Math.cos(t * 0.5) * 0.30;

      const targetX = lerp(autoX, mouse.x, 0.4);
      const targetY = lerp(autoY, mouse.y, 0.4);

      current.x = lerp(current.x, targetX, 0.035);
      current.y = lerp(current.y, targetY, 0.035);

      const x = current.x;
      const y = current.y;

      const h1 = Math.round(260 - x * 80);
      const h2 = Math.round(320 - y * 120);
      const h3 = Math.round(190 + x * 70 - y * 40);

      const o1 = orb1Ref.current;
      const o2 = orb2Ref.current;
      const o3 = orb3Ref.current;

      if (o1) {
        o1.style.left = `${x * 100}%`;
        o1.style.top  = `${y * 100}%`;
        o1.style.background = `radial-gradient(circle, hsla(${h1},80%,65%,0.38) 0%, transparent 70%)`;
      }
      if (o2) {
        o2.style.left = `${(1 - x * 0.65) * 100}%`;
        o2.style.top  = `${(1 - y * 0.6) * 100}%`;
        o2.style.background = `radial-gradient(circle, hsla(${h2},75%,60%,0.30) 0%, transparent 70%)`;
      }
      if (o3) {
        o3.style.left = `${x * 35 + 10}%`;
        o3.style.top  = `${(1 - y) * 75 + 15}%`;
        o3.style.background = `radial-gradient(circle, hsla(${h3},85%,62%,0.22) 0%, transparent 70%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
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
    width: "820px",
    height: "820px",
    borderRadius: "50%",
    filter: "blur(100px)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    willChange: "left, top, background",
  };

  return (
    <div className="aurora-wrap" aria-hidden="true">
      <div ref={orb1Ref} style={orbStyle} />
      <div ref={orb2Ref} style={{ ...orbStyle, width: "680px", height: "680px" }} />
      <div ref={orb3Ref} style={{ ...orbStyle, width: "560px", height: "560px" }} />
    </div>
  );
}
