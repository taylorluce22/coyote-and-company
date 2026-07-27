"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient background — CSS-ONLY BY DEFAULT.
 *
 * This component used to mount a three.js WebGL particle field at the app
 * root, so a continuous GPU render loop ran on EVERY screen from the
 * moment the app booted. WebGL lives in Chrome's shared GPU process: when
 * that process is starved or wedged, EVERY tab and the browser UI go with
 * it — which is exactly the "loading Farmhand crashes the whole browser"
 * signature the owner hit (2026-07-27). The aurora look is pure CSS
 * (globals.css) and costs the compositor almost nothing, so it stays.
 *
 * The particle field is now strictly opt-in: Settings → "3D background",
 * which sets `fh-fx-3d = 1`. It also loads three.js by DYNAMIC import, so
 * the library is not even in the boot bundle unless the flag is on.
 * `?safe=1` (or `fh-safe = 1`) force-disables it regardless — the panic
 * switch for getting into the app on any machine.
 */

export const FX_3D_KEY = "fh-fx-3d";
export const SAFE_KEY = "fh-safe";

/** Panic switch: ?safe=1 sticks until ?safe=0. Read by heavy panels too. */
export function safeMode(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("safe");
    if (q === "1") localStorage.setItem(SAFE_KEY, "1");
    if (q === "0") localStorage.removeItem(SAFE_KEY);
    return localStorage.getItem(SAFE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function BackgroundFx() {
  const ref = useRef<HTMLDivElement>(null);
  const [want3d, setWant3d] = useState(false);

  // decide AFTER mount (localStorage is client-only) and never during SSR
  useEffect(() => {
    try {
      setWant3d(!safeMode() && localStorage.getItem(FX_3D_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!want3d) return;
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    // dynamic import — three.js never enters the boot bundle
    (async () => {
      const THREE = await import("three");
      if (disposed || !ref.current) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const vw = () => document.documentElement.clientWidth || window.innerWidth;
      const vh = () => document.documentElement.clientHeight || window.innerHeight;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
      } catch {
        return; // no GPU context available — stay on the CSS aurora
      }
      renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
      renderer.setSize(vw(), vh());
      el.appendChild(renderer.domElement);

      // a lost GPU context must not spin a dead render loop
      const onLost = (e: Event) => {
        e.preventDefault();
        cleanup?.();
      };
      renderer.domElement.addEventListener("webglcontextlost", onLost);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, vw() / vh(), 0.1, 100);
      camera.position.set(0, 0, 16);

      const mk = (count: number, color: number, size: number, spread: number, speed: number) => {
        const n = reduced ? Math.floor(count * 0.4) : count;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          pos[i * 3] = (Math.random() - 0.5) * spread;
          pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
          pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.5;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const p = new THREE.Points(
          g,
          new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        p.userData.speed = speed;
        scene.add(p);
        return p;
      };
      const layers = [mk(220, 0xa855f7, 0.06, 34, 0.012), mk(160, 0x38bdf8, 0.05, 30, 0.02), mk(70, 0xffffff, 0.03, 26, 0.032)];

      const mouse = { x: 0, y: 0 };
      const onMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const onResize = () => {
        renderer.setSize(vw(), vh());
        camera.aspect = vw() / vh();
        camera.updateProjectionMatrix();
      };
      if (!reduced) window.addEventListener("mousemove", onMove);
      window.addEventListener("resize", onResize);

      let raf = 0;
      let wasSuspended = false;
      const animate = () => {
        const suspended =
          !!(window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg || document.visibilityState === "hidden";
        if (suspended !== wasSuspended) {
          wasSuspended = suspended;
          document.body.classList.toggle("fh-bg-suspended", suspended);
        }
        if (!suspended) {
          const t = performance.now() / 1000;
          layers.forEach((p, i) => {
            p.rotation.y = t * (p.userData.speed as number);
            p.rotation.x = Math.sin(t * 0.05 + i) * 0.05;
          });
          camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.02;
          camera.position.y += (-mouse.y * 0.8 - camera.position.y) * 0.02;
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.body.classList.remove("fh-bg-suspended");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("webglcontextlost", onLost);
        layers.forEach((p) => {
          p.geometry.dispose();
          (p.material as THREE.Material).dispose();
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
        cleanup = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [want3d]);

  return (
    <>
      {want3d && <div ref={ref} className="fh-bg3d" aria-hidden="true" />}
      <div className="fh-ambient" aria-hidden="true">
        <div className="fh-aurora1" />
        <div className="fh-aurora2" />
      </div>
    </>
  );
}
