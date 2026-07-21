"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Global ambient WebGL particle field (three.js) + aurora blobs.
 * Faithful to the handoff: 3 additive layers (purple / cyan / white),
 * slow rotation, mouse-parallax camera. Reduced-motion aware.
 */
export default function BackgroundFx() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 16);

    const mk = (
      count: number,
      color: number,
      size: number,
      spread: number,
      speed: number
    ) => {
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
        new THREE.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      p.userData.speed = speed;
      scene.add(p);
      return p;
    };

    const layers = [
      mk(260, 0xa855f7, 0.06, 34, 0.012),
      mk(200, 0x38bdf8, 0.05, 30, 0.02),
      mk(90, 0xffffff, 0.03, 26, 0.032),
    ];

    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    if (!reduced) window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);

    let raf = 0;
    const animate = () => {
      // Heavy client-side work (Reel Coach upload/analysis) sets this flag so
      // this GPU-continuous render loop isn't also competing for the GPU/
      // compositor during the exact window a large local video is being
      // read/uploaded — see ReelCoach.tsx.
      if (!(window as unknown as { __fhSuspendBg?: boolean }).__fhSuspendBg) {
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      layers.forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el)
        el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div ref={ref} className="fh-bg3d" aria-hidden="true" />
      <div className="fh-ambient" aria-hidden="true">
        <div className="fh-aurora1" />
        <div className="fh-aurora2" />
      </div>
    </>
  );
}
