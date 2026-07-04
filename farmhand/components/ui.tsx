"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import gsap from "gsap";

/* ---- Magnetic, shine-swept primary button (fh-btn-shine) ---- */
export function MagneticButton({
  children,
  className = "",
  style,
  onClick,
  type = "button",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.18,
        y: (e.clientY - (r.top + r.height / 2)) * 0.35,
        duration: 0.3,
        ease: "power2.out",
      });
    };
    const onLeave = () =>
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.45)" });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`fh-btn-shine ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---- iOS-style toggle switch (40×22, knob 18) ---- */
export function Switch({
  on,
  color,
  onToggle,
  label,
}: {
  on: boolean;
  color: string;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background .25s ease",
        background: on ? color : "rgba(255,255,255,0.14)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#F4F3F8",
          transition: "left .25s ease",
          left: on ? 20 : 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}
      />
    </button>
  );
}

/* ---- rAF count-up (eases 0 → target once on mount) ---- */
export function useCountUp(target: number, dur = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setVal(Math.round((1 - Math.pow(1 - k, 3)) * target));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export function CountUp({
  value,
  suffix = "",
  className,
  style,
}: {
  value: number;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const v = useCountUp(value);
  return (
    <span className={className} style={style}>
      {v}
      {suffix}
    </span>
  );
}
