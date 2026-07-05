"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

/**
 * AERIAL — the digitized-photo hero.
 * Drop in one aerial photo (saved locally, forever) and it renders as a
 * living, holographic version of itself: gentle 2.5D relief lifted from the
 * image, slow cinematic drift, a digitizing scan sweep, neon edge tracing,
 * and pulsing location pins. The base layer IS the photograph — so it looks
 * exactly like the reference, just animated.
 */

const VERT = `
uniform sampler2D uHeight;
uniform float uAmp;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += texture2D(uHeight, uv).r * uAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform float uTime;
uniform vec2 uTexel;
varying vec2 vUv;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(uMap, uv).rgb;

  // cinematic grade: vibrance up, cool teal shadows
  float l = lum(col);
  col = mix(vec3(l), col, 1.16) * 1.03;
  col = mix(col, col * vec3(0.84, 0.96, 1.16), (1.0 - smoothstep(0.0, 0.55, l)) * 0.32);

  // sobel edges -> pulsing neon trace ("digitized" outline)
  vec2 px = uTexel * 1.5;
  float tl = lum(texture2D(uMap, uv + vec2(-px.x,  px.y)).rgb);
  float tc = lum(texture2D(uMap, uv + vec2( 0.0,   px.y)).rgb);
  float tr = lum(texture2D(uMap, uv + vec2( px.x,  px.y)).rgb);
  float ml = lum(texture2D(uMap, uv + vec2(-px.x,  0.0 )).rgb);
  float mr = lum(texture2D(uMap, uv + vec2( px.x,  0.0 )).rgb);
  float bl = lum(texture2D(uMap, uv + vec2(-px.x, -px.y)).rgb);
  float bc = lum(texture2D(uMap, uv + vec2( 0.0,  -px.y)).rgb);
  float br = lum(texture2D(uMap, uv + vec2( px.x, -px.y)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = smoothstep(0.22, 0.85, length(vec2(gx, gy)));
  float epulse = 0.55 + 0.45 * sin(uTime * 1.3 + uv.y * 8.0);
  col += vec3(0.20, 0.95, 0.85) * edge * 0.20 * epulse;

  // digitizing sweep: a diagonal light band that crosses every ~9s
  float sw = fract(uTime * 0.11);
  float d = uv.x * 0.6 + uv.y * 0.4;
  float band = smoothstep(0.09, 0.0, abs(d - (sw * 1.4 - 0.2)));
  col += vec3(0.35, 0.85, 1.0) * band * 0.30;

  // holo grid — whisper-faint always, revealed inside the sweep band
  vec2 g = abs(fract(uv * 26.0) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.055, min(g.x, g.y));
  col += vec3(0.4, 0.9, 1.0) * grid * (band * 0.22 + 0.018);

  // fine scanlines
  col += sin(uv.y * 850.0) * 0.006;

  // vignette + soft edge fade so it floats on the dark hero
  vec2 cc = uv - 0.5;
  col *= 1.0 - dot(cc, cc) * 0.5;
  float fade = smoothstep(0.0, 0.015, uv.x) * smoothstep(0.0, 0.015, 1.0 - uv.x)
             * smoothstep(0.0, 0.015, uv.y) * smoothstep(0.0, 0.015, 1.0 - uv.y);

  gl_FragColor = vec4(col, fade);
}
`;

const PINS = [
  { x: 61, y: 46, label: "The Estates", color: "#FF5D8F" },
  { x: 44, y: 58, label: "Fairway 7", color: "#41D98A" },
  { x: 31, y: 68, label: "Clubhouse", color: "#7DD3FC" },
];

/** Downscale + re-encode an image file so it fits comfortably in localStorage. */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const MAX = 1600;
        const s = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Build a soft relief map from the photo itself: bright + warm (rocky/built)
 * areas rise a touch, green fairways stay low. Heavily blurred so the relief
 * reads as gentle depth, never geometry.
 */
function buildHeightCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const W = 192;
  const H = Math.max(2, Math.round((W * img.height) / img.width));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H);
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = src.data[i * 4] / 255;
    const g = src.data[i * 4 + 1] / 255;
    const b = src.data[i * 4 + 2] / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    h[i] = Math.min(1, l * 0.5 + Math.max(0, r - g) * 1.1 + Math.max(0, r - b) * 0.2);
  }
  // two box-blur passes
  const tmp = new Float32Array(W * H);
  const R = 4;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0,
          n = 0;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < W) {
            s += h[y * W + xx];
            n++;
          }
        }
        tmp[y * W + x] = s / n;
      }
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) {
        let s = 0,
          n = 0;
        for (let k = -R; k <= R; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < H) {
            s += tmp[yy * W + x];
            n++;
          }
        }
        h[y * W + x] = s / n;
      }
  }
  const out = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(h[i] * 255);
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function Scene({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (dead || !host) return;

      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img"));
        img.src = src;
      }).catch(() => {});
      if (dead || !img.width) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100);
      camera.position.set(0, 0, 10);

      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      const heightTex = new THREE.CanvasTexture(buildHeightCanvas(img));
      heightTex.minFilter = THREE.LinearFilter;

      const aspect = img.width / img.height;
      const planeH = 6;
      const planeW = planeH * aspect;
      const geo = new THREE.PlaneGeometry(planeW, planeH, 200, Math.round(200 / aspect));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        uniforms: {
          uMap: { value: tex },
          uHeight: { value: heightTex },
          uAmp: { value: 0.5 },
          uTime: { value: 0 },
          uTexel: { value: new THREE.Vector2(1 / img.width, 1 / img.height) },
        },
      });
      const plane = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(plane);
      group.rotation.x = -0.12; // barely tilted — 2.5D, not full 3D
      scene.add(group);

      // "floating slab" fit: the whole photo stays visible, hovering over a
      // blurred copy of itself in the surround
      const fit = () => {
        const w = host.clientWidth,
          h = host.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const dist = camera.position.z;
        const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
        const visW = visH * camera.aspect;
        const s = Math.min(visW / planeW, visH / planeH) * 0.94;
        group.scale.setScalar(s);
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(host);

      // pointer parallax (eased)
      const target = { x: 0, y: 0 };
      const cur = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      const onLeave = () => {
        target.x = 0;
        target.y = 0;
      };
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);

      const t0 = performance.now();
      const tick = () => {
        if (dead) return;
        const t = (performance.now() - t0) / 1000;
        mat.uniforms.uTime.value = t;
        cur.x += (target.x - cur.x) * 0.045;
        cur.y += (target.y - cur.y) * 0.045;
        // slow Ken Burns drift + pointer tilt
        group.rotation.y = cur.x * 0.05 + Math.sin(t * 0.09) * 0.012;
        group.rotation.x = -0.12 + cur.y * 0.035 + Math.cos(t * 0.07) * 0.008;
        const breathe = 1 + 0.022 * Math.sin(t * 0.06);
        plane.scale.setScalar(breathe);
        plane.position.x = Math.sin(t * 0.045) * 0.08;
        plane.position.y = Math.cos(t * 0.06) * 0.05;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
        geo.dispose();
        mat.dispose();
        tex.dispose();
        heightTex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      dead = true;
      cleanup?.();
    };
  }, [src]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

export default function AerialHero() {
  const { state, set } = useStore();
  const src = (state.aerialImg as string) || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const takeFile = async (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const url = await fileToDataURL(f);
      set({ aerialImg: url });
    } catch {}
    setBusy(false);
  };

  const input = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={(e) => takeFile(e.target.files?.[0])}
    />
  );

  if (!src) {
    return (
      <div
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
      >
        {input}
        <div
          className="fh-glass"
          style={{
            borderRadius: 18,
            padding: "34px 38px",
            maxWidth: 440,
            textAlign: "center",
            border: dragOver ? "1.5px dashed #7DD3FC" : "1.5px dashed rgba(255,255,255,0.18)",
            transition: "border-color 0.2s",
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 10 }}>🛰️</div>
          <div className="fh-title" style={{ fontSize: 19, marginBottom: 8 }}>
            Drop in your aerial photo
          </div>
          <div style={{ fontSize: 13, color: "#A6A4B8", lineHeight: 1.6 }}>
            It becomes a living, digitized version of itself — scan sweeps, neon edge tracing and
            location pins over <b style={{ color: "#7DD3FC" }}>your exact photo</b>. Saved on this
            device; upload once.
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              marginTop: 18,
              background: "linear-gradient(180deg,#38BDF8,#0284C7)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(56,189,248,0.4)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Processing…" : "Choose photo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {input}

      {/* blurred echo of the photo fills the surround behind the slab */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(34px) brightness(0.3) saturate(1.2)",
        }}
      />
      <Scene src={src} />

      {/* legibility scrims for the header + ticker (never block interaction) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(6,6,13,0.62), transparent 26%, transparent 72%, rgba(6,6,13,0.66))" }} />

      {/* pulsing location pins */}
      {PINS.map((p) => (
        <div key={p.label} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, zIndex: 2, pointerEvents: "none", transform: "translate(-50%,-50%)" }}>
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 34,
              height: 34,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              border: `1.5px solid ${p.color}`,
              opacity: 0.7,
              animation: "fh-pinring 2.6s ease-out infinite",
            }}
          />
          <span
            style={{
              display: "block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 12px ${p.color}`,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 14,
              top: -6,
              whiteSpace: "nowrap",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontFamily: "var(--label)",
              textTransform: "uppercase",
              color: p.color,
              background: "rgba(8,8,18,0.66)",
              border: `1px solid ${p.color}44`,
              borderRadius: 6,
              padding: "3px 7px",
              backdropFilter: "blur(8px)",
            }}
          >
            {p.label}
          </span>
        </div>
      ))}

      {/* replace photo */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          zIndex: 3,
          background: "rgba(8,8,18,0.62)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 8,
          color: "#A6A4B8",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontFamily: "var(--label)",
          padding: "7px 12px",
          cursor: "pointer",
          backdropFilter: "blur(14px)",
        }}
      >
        {busy ? "PROCESSING…" : "REPLACE PHOTO"}
      </button>
    </div>
  );
}
