"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";
import { FARM_CLUSTERS } from "@/lib/data";

/* Kenney City-Builder kit (MIT) — professional diorama models.
   Loaded once; tiles fall back to procedural geometry if a model
   fails to load (offline dev, blocked CDN, etc.). */
const MODEL_NAMES = [
  "building-small-a",
  "building-small-b",
  "building-small-c",
  "building-small-d",
  "building-garage",
  "grass-trees",
  "grass-trees-tall",
  "grass",
  "pavement-fountain",
  "road-straight",
  "road-intersection",
] as const;
type ModelMap = Partial<Record<(typeof MODEL_NAMES)[number], THREE.Object3D>>;

function loadModels(): Promise<ModelMap> {
  const loader = new GLTFLoader();
  const out: ModelMap = {};
  return Promise.all(
    MODEL_NAMES.map(
      (n) =>
        new Promise<void>((res) => {
          loader.load(
            `/models/${n}.glb`,
            (g) => {
              out[n] = g.scene;
              res();
            },
            undefined,
            () => res()
          );
        })
    )
  ).then(() => out);
}

/**
 * Real-time 3D farm — 5 neighborhood clusters of low-poly AZ ranch houses.
 *
 * Interaction model (tuned so you never get "stuck"):
 *  - each cluster has a large invisible hit-cylinder → generous, consistent
 *    hover/click targets instead of pixel-hunting individual houses
 *  - drag-vs-click detection: moving the mouse >6px swallows the click,
 *    so panning around never launches a camera flight
 *  - clicking empty ground does NOTHING unless you're zoomed in
 *    (then it returns to the overview — and there's an explicit pill too)
 *  - parallax eases off during camera flights; rendering pauses when the
 *    tab is hidden
 */
export default function FarmScene() {
  const mount = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string } | null>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const flyHomeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const W = () => el.clientWidth || 700;
    const H = () => el.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W(), H());
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 100);
    const HOME = new THREE.Vector3(9, 8.5, 12);
    const LOOK = new THREE.Vector3(0.5, 0.4, 0);
    camera.position.copy(HOME);
    camera.lookAt(LOOK);

    scene.fog = new THREE.Fog(0x06060d, 16, 34);
    scene.add(new THREE.AmbientLight(0x9585c5, 0.7));
    const l1 = new THREE.PointLight(0xa855f7, 1.9, 48);
    l1.position.set(-6, 8, 4);
    scene.add(l1);
    const l2 = new THREE.PointLight(0x38bdf8, 1.4, 48);
    l2.position.set(7, 6, -5);
    scene.add(l2);
    const key = new THREE.PointLight(0xffffff, 0.8, 40);
    scene.add(key);
    // warm dusk sun so the sandstone tiles and stucco read Arizona-warm
    const sun = new THREE.DirectionalLight(0xffd9b0, 0.85);
    sun.position.set(5, 9, 3);
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x0a0a16, roughness: 0.35, metalness: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    const grid = new THREE.GridHelper(26, 26, 0x4c3a8a, 0x171330);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    grid.position.y = 0.01;
    scene.add(grid);

    // dark-dusk backdrop: subtle distant foothill silhouettes
    const hillNear = new THREE.MeshStandardMaterial({ color: 0x2a2244, roughness: 1 });
    const hillFar = new THREE.MeshStandardMaterial({ color: 0x1c1738, roughness: 1 });
    const backAngle = Math.atan2(12, 9) + Math.PI;
    for (let i = 0; i < 16; i++) {
      const far = i % 2 === 0;
      const ang = backAngle + ((i + Math.random() * 0.6) / 16 - 0.5) * Math.PI * 1.3;
      const r = far ? 18 : 14;
      const hw = 3 + Math.random() * 4.5;
      const hh = far ? 2.4 + Math.random() * 2.2 : 1.1 + Math.random() * 1.1;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(hw, hh, 7, 1), far ? hillFar : hillNear);
      hill.position.set(Math.cos(ang) * r, hh / 2 - 0.06, Math.sin(ang) * r);
      hill.rotation.y = Math.random() * Math.PI;
      hill.scale.z = 0.5;
      scene.add(hill);
    }

    // ---- Arizona diorama kit: sandstone tiles, adobe + tile-roof houses,
    //      palms & saguaros, little street grids (reference: neighborhood tile) ----
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const winGeo = new THREE.PlaneGeometry(1, 1);
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.5, 0);
    triShape.lineTo(0.5, 0);
    triShape.lineTo(0, 0.32);
    triShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(triShape, { depth: 1, bevelEnabled: false });
    gableGeo.translate(0, 0, -0.5);

    // AZ stucco + clay-tile palettes
    const STUCCO = [0xe3d2b4, 0xdcbf9a, 0xd6a67e, 0xe8dcc4, 0xcfa887, 0xe0c6a0];
    const TILE = [0xa05c38, 0xb06a40, 0x8f5230, 0x9c6844];
    const stuccoMat = () =>
      new THREE.MeshStandardMaterial({ color: STUCCO[(Math.random() * STUCCO.length) | 0], roughness: 0.9, metalness: 0.02 });

    // flat-roof adobe/pueblo house with parapet + rooftop AC unit.
    // ~1 in 3 gets a stepped second story (pueblo style) for skyline variety.
    const mkAdobe = (lit: boolean) => {
      const g = new THREE.Group();
      const bw = 0.5 + Math.random() * 0.24,
        bd = 0.38 + Math.random() * 0.16,
        bh = 0.16 + Math.random() * 0.16;
      const body = new THREE.Mesh(bodyGeo, stuccoMat());
      body.scale.set(bw, bh, bd);
      body.position.y = bh / 2;
      const parapetMat = new THREE.MeshStandardMaterial({ color: 0xb99b74, roughness: 0.92 });
      const parapet = new THREE.Mesh(bodyGeo, parapetMat);
      parapet.scale.set(bw * 1.05, 0.022, bd * 1.05);
      parapet.position.y = bh + 0.011;
      g.add(body, parapet);
      let topY = bh;
      if (Math.random() < 0.34) {
        // stepped second story, set back toward one corner
        const uw = bw * (0.5 + Math.random() * 0.2),
          ud = bd * (0.55 + Math.random() * 0.2),
          uh = bh * (0.7 + Math.random() * 0.4);
        const upper = new THREE.Mesh(bodyGeo, stuccoMat());
        upper.scale.set(uw, uh, ud);
        upper.position.set(-bw * 0.18, bh + uh / 2, -bd * 0.12);
        const upPara = new THREE.Mesh(bodyGeo, parapetMat);
        upPara.scale.set(uw * 1.06, 0.02, ud * 1.06);
        upPara.position.set(-bw * 0.18, bh + uh + 0.01, -bd * 0.12);
        const upWin = new THREE.Mesh(
          winGeo,
          new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: lit ? 0.9 : 0.12 })
        );
        upWin.scale.set(uw * 0.34, uh * 0.4, 1);
        upWin.position.set(-bw * 0.18, bh + uh * 0.45, -bd * 0.12 + ud / 2 + 0.004);
        g.add(upper, upPara, upWin);
        topY = bh + uh;
      }
      const ac = new THREE.Mesh(
        bodyGeo,
        new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.6, metalness: 0.4 })
      );
      ac.scale.set(0.07, 0.035, 0.07);
      ac.position.set(bw * 0.22, topY === bh ? bh + 0.028 : bh + 0.028, -bd * 0.18);
      const win = new THREE.Mesh(
        winGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: lit ? 0.95 : 0.14 })
      );
      win.scale.set(bw * 0.3, bh * 0.42, 1);
      win.position.set(bw * 0.18, bh * 0.42, bd / 2 + 0.004);
      const door = new THREE.Mesh(
        winGeo,
        new THREE.MeshStandardMaterial({ color: 0x5a3b26, roughness: 0.8 })
      );
      door.scale.set(bw * 0.13, bh * 0.62, 1);
      door.position.set(-bw * 0.22, bh * 0.31, bd / 2 + 0.004);
      g.add(ac, win, door);
      return g;
    };

    // taller stucco landmark (2-3 story) — one per live tile anchors the skyline
    const mkLandmark = (lit: boolean) => {
      const g = new THREE.Group();
      const bw = 0.42 + Math.random() * 0.14,
        bd = 0.36 + Math.random() * 0.12,
        bh = 0.46 + Math.random() * 0.22;
      const body = new THREE.Mesh(bodyGeo, stuccoMat());
      body.scale.set(bw, bh, bd);
      body.position.y = bh / 2;
      const parapet = new THREE.Mesh(
        bodyGeo,
        new THREE.MeshStandardMaterial({ color: 0xb08c62, roughness: 0.92 })
      );
      parapet.scale.set(bw * 1.06, 0.024, bd * 1.06);
      parapet.position.y = bh + 0.012;
      g.add(body, parapet);
      // stacked window rows
      for (let f = 0; f < 3; f++) {
        const win = new THREE.Mesh(
          winGeo,
          new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: lit && Math.random() < 0.75 ? 0.9 : 0.14 })
        );
        win.scale.set(bw * 0.55, bh * 0.14, 1);
        win.position.set(0, bh * (0.24 + f * 0.27), bd / 2 + 0.004);
        g.add(win);
      }
      return g;
    };

    // low-pitch clay-tile ranch house
    const mkRanch = (lit: boolean) => {
      const g = new THREE.Group();
      const bw = 0.54 + Math.random() * 0.26,
        bd = 0.4 + Math.random() * 0.14,
        bh = 0.18 + Math.random() * 0.09;
      const body = new THREE.Mesh(bodyGeo, stuccoMat());
      body.scale.set(bw, bh, bd);
      body.position.y = bh / 2;
      const roof = new THREE.Mesh(
        gableGeo,
        new THREE.MeshStandardMaterial({ color: TILE[(Math.random() * TILE.length) | 0], roughness: 0.72 })
      );
      roof.scale.set(bw * 1.18, 0.34 + Math.random() * 0.16, bd * 1.14);
      roof.rotation.y = Math.PI / 2;
      roof.position.y = bh;
      const win = new THREE.Mesh(
        winGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: lit ? 0.95 : 0.14 })
      );
      win.scale.set(bw * 0.32, bh * 0.46, 1);
      win.position.set(bw * 0.16, bh * 0.44, bd / 2 + 0.004);
      g.add(body, roof, win);
      return g;
    };

    // palm tree: leaning trunk + fan of fronds
    const mkPalm = () => {
      const g = new THREE.Group();
      const th = 0.26 + Math.random() * 0.16;
      const lean = (Math.random() - 0.5) * 0.24;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.026, th, 5),
        new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95 })
      );
      trunk.position.y = th / 2;
      trunk.rotation.z = lean;
      g.add(trunk);
      const topX = Math.sin(lean) * th * -0.9;
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8d52, roughness: 0.85 });
      for (let i = 0; i < 7; i++) {
        const frond = new THREE.Mesh(bodyGeo, frondMat);
        frond.scale.set(0.17, 0.008, 0.045);
        const ang = (i / 7) * Math.PI * 2;
        frond.position.set(topX + Math.cos(ang) * 0.07, th + 0.01, Math.sin(ang) * 0.07);
        frond.rotation.y = -ang;
        frond.rotation.z = 0.55; // droop
        g.add(frond);
      }
      return g;
    };

    // desert bush: squashed sage-green spheres, clustered
    const mkBush = () => {
      const g = new THREE.Group();
      const colors = [0x6b7c4a, 0x7d8f56, 0x8a9a6b, 0x5f7045];
      const n = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const r = 0.05 + Math.random() * 0.05;
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(r, 7, 6),
          new THREE.MeshStandardMaterial({ color: colors[(Math.random() * colors.length) | 0], roughness: 0.95 })
        );
        bush.scale.y = 0.6 + Math.random() * 0.2;
        bush.position.set(i * r * 1.2, r * 0.55, (Math.random() - 0.5) * r);
        g.add(bush);
      }
      return g;
    };

    // saguaro cactus: body + two offset arms
    const mkSaguaro = () => {
      const g = new THREE.Group();
      const h = 0.16 + Math.random() * 0.1;
      const mat = new THREE.MeshStandardMaterial({ color: 0x4f7d46, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, h, 7), mat);
      body.position.y = h / 2;
      g.add(body);
      [1, -1].forEach((side, i) => {
        if (i === 1 && Math.random() < 0.4) return;
        const armH = h * 0.5;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, armH, 6), mat);
        arm.position.set(side * 0.045, h * 0.55, 0);
        g.add(arm);
        const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 6), mat);
        joint.rotation.z = Math.PI / 2;
        joint.position.set(side * 0.028, h * 0.55 - armH * 0.4, 0);
        g.add(joint);
      });
      return g;
    };

    // rounded diorama plate (sandstone top, glowing accent under-rim)
    const plateShape = (w: number, dpt: number, r: number) => {
      const s = new THREE.Shape();
      const hw = w / 2,
        hd = dpt / 2;
      s.moveTo(-hw + r, -hd);
      s.lineTo(hw - r, -hd);
      s.quadraticCurveTo(hw, -hd, hw, -hd + r);
      s.lineTo(hw, hd - r);
      s.quadraticCurveTo(hw, hd, hw - r, hd);
      s.lineTo(-hw + r, hd);
      s.quadraticCurveTo(-hw, hd, -hw, hd - r);
      s.lineTo(-hw, -hd + r);
      s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
      return s;
    };

    // ---- procedural surface textures (reference-photo realism, zero downloads) ----
    const canvasTex = (draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      draw(cv.getContext("2d")!, w, h);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    // desert floor: warm sand with speckle + soft wash blotches
    const desertTex = canvasTex((c, w, h) => {
      c.fillStyle = "#d3b78e";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const g = c.createRadialGradient(Math.random() * w, Math.random() * h, 4, Math.random() * w, Math.random() * h, 60 + Math.random() * 70);
        g.addColorStop(0, "rgba(160,128,88,0.16)");
        g.addColorStop(1, "rgba(160,128,88,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < 5200; i++) {
        const v = Math.random();
        c.fillStyle = v < 0.5 ? `rgba(120,92,60,${0.05 + Math.random() * 0.08})` : `rgba(240,222,190,${0.05 + Math.random() * 0.07})`;
        c.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
      }
    });
    desertTex.repeat.set(2.4, 2.4);
    // fairway turf: two-tone mow stripes + mottle
    const grassTex = canvasTex((c, w, h) => {
      c.fillStyle = "#3f9448";
      c.fillRect(0, 0, w, h);
      const stripe = 26;
      for (let x = 0; x < w + h; x += stripe * 2) {
        c.fillStyle = "rgba(96,196,102,0.32)";
        c.save();
        c.translate(x, 0);
        c.rotate(0.24);
        c.fillRect(0, -h, stripe, h * 3);
        c.restore();
      }
      for (let i = 0; i < 3800; i++) {
        const v = Math.random();
        c.fillStyle = v < 0.5 ? `rgba(28,92,40,${0.05 + Math.random() * 0.09})` : `rgba(140,220,130,${0.04 + Math.random() * 0.07})`;
        c.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3);
      }
    });
    grassTex.repeat.set(1.6, 1.6);
    // rock face: layered strata + heavy grain (Camelback granite)
    const rockTex = canvasTex((c, w, h) => {
      c.fillStyle = "#8a6a4d";
      c.fillRect(0, 0, w, h);
      const bands = ["#75563d", "#94745a", "#6e5138", "#9d7d5e", "#7a5c42"];
      let y = 0;
      let bi = 0;
      while (y < h) {
        const bh2 = 8 + Math.random() * 22;
        c.fillStyle = bands[bi++ % bands.length];
        c.globalAlpha = 0.4 + Math.random() * 0.3;
        c.fillRect(0, y, w, bh2);
        y += bh2;
      }
      c.globalAlpha = 1;
      for (let i = 0; i < 6400; i++) {
        const v = Math.random();
        c.fillStyle = v < 0.55 ? `rgba(52,38,24,${0.06 + Math.random() * 0.1})` : `rgba(214,186,150,${0.05 + Math.random() * 0.08})`;
        c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
    });
    rockTex.repeat.set(2, 1.4);

    // craggy mound (foothill / mountain): noise-displaced, flat-shaded, strata-textured
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1, flatShading: true });
    const mkMound = (w: number, h: number) => {
      const geo = new THREE.ConeGeometry(w, h, 10, 5);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const rFrac = 1 - (y + h / 2) / h; // 1 at base → 0 at apex
        if (rFrac > 0.02 && rFrac < 0.99) {
          pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * w * 0.22 * rFrac);
          pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * w * 0.22 * rFrac);
          pos.setY(i, y + (Math.random() - 0.5) * h * 0.07);
        }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rockMat);
      m.scale.z = 0.55 + Math.random() * 0.15;
      m.rotation.y = Math.random() * Math.PI;
      return m;
    };

    // ---- Kenney model instancing: clone + normalize footprint, base at y=0 ----
    let kit: ModelMap = {};
    const fitModel = (
      name: (typeof MODEL_NAMES)[number],
      targetW: number,
      ry = 0,
      warm = false
    ): THREE.Group | null => {
      const src = kit[name];
      if (!src) return null;
      const inst = src.clone(true);
      if (warm) {
        // desert-warm the Kenney palette: clone materials, multiply toward stucco
        const tint = new THREE.Color(1.0, 0.9 + Math.random() * 0.05, 0.74 + Math.random() * 0.08);
        inst.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            m.material = (Array.isArray(m.material) ? mats.map((x) => x.clone()) : mats[0].clone()) as typeof m.material;
            (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
              const std = mm as THREE.MeshStandardMaterial;
              if (std.color) std.color.multiply(tint);
            });
          }
        });
      }
      const g = new THREE.Group();
      g.add(inst);
      const box = new THREE.Box3().setFromObject(inst);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = targetW / Math.max(size.x, size.z, 0.0001);
      inst.scale.setScalar(s);
      inst.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
      g.rotation.y = ry;
      return g;
    };
    const BUILD_MODELS = [
      "building-small-a",
      "building-small-b",
      "building-small-c",
      "building-small-d",
      "building-garage",
    ] as const;

    // clusters — Arizona diorama tiles with a generous invisible hit-cylinder
    const clusterGroups: THREE.Group[] = [];
    const hitMeshes: THREE.Mesh[] = [];
    const PLATE_H = 0.1;
    const buildClusters = () => {
    FARM_CLUSTERS.forEach((d, ci) => {
      const cg = new THREE.Group();
      cg.position.set(d.x, 0, d.z);
      cg.userData = { name: d.name, baseY: 0 };
      const pw = d.w * 1.02,
        pd = d.d * 1.02;

      // sandstone tile
      const plateGeo = new THREE.ExtrudeGeometry(plateShape(pw, pd, 0.32), { depth: PLATE_H, bevelEnabled: false });
      const plate = new THREE.Mesh(
        plateGeo,
        new THREE.MeshStandardMaterial({ map: desertTex, color: 0xf5ead2, roughness: 0.95, metalness: 0 })
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = 0; // extrusion rises +y, so the walkable top lands at PLATE_H
      cg.add(plate);
      // glowing accent under-rim (keeps the app's neighborhood color coding)
      const rimGeo = new THREE.ExtrudeGeometry(plateShape(pw * 1.045, pd * 1.045, 0.34), { depth: 0.03, bevelEnabled: false });
      const rim = new THREE.Mesh(
        rimGeo,
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.5 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.028;
      cg.add(rim);

      // street cross on the tile — real Kenney road tiles when loaded
      const roadY = PLATE_H + 0.002;
      const inter = fitModel("road-intersection", 0.36);
      if (inter) {
        inter.position.y = roadY;
        cg.add(inter);
        const rs = 0.36;
        const nx = Math.floor((pw * 0.46) / rs),
          nz = Math.floor((pd * 0.46) / rs);
        for (let i = 1; i <= nx; i++)
          [-1, 1].forEach((sgn) => {
            const r = fitModel("road-straight", rs, Math.PI / 2);
            if (r) {
              r.position.set(sgn * i * rs, roadY, 0);
              cg.add(r);
            }
          });
        for (let i = 1; i <= nz; i++)
          [-1, 1].forEach((sgn) => {
            const r = fitModel("road-straight", rs);
            if (r) {
              r.position.set(0, roadY, sgn * i * rs);
              cg.add(r);
            }
          });
      } else {
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x54545e, roughness: 0.9 });
        const roadH = new THREE.Mesh(bodyGeo, roadMat);
        roadH.scale.set(pw * 0.92, 0.008, 0.15);
        roadH.position.y = PLATE_H + 0.004;
        const roadV = new THREE.Mesh(bodyGeo, roadMat);
        roadV.scale.set(0.15, 0.008, pd * 0.92);
        roadV.position.y = PLATE_H + 0.004;
        cg.add(roadH, roadV);
      }

      const isPV = d.name === "Paradise Valley";
      if (isPV) {
        // ---- Paradise Valley (aerial reference): mountain with hillside homes,
        //      S-curve fairway chain, greens, bunkers, tree lines, cart path,
        //      resort + pool, desert scrub ----
        const peaks: { x: number; z: number; r: number; h: number }[] = [
          { x: pw * 0.16, z: -pd * 0.34, r: pw * 0.34, h: 1.25 },
          { x: -pw * 0.24, z: -pd * 0.4, r: pw * 0.22, h: 0.75 },
          { x: pw * 0.42, z: -pd * 0.28, r: pw * 0.16, h: 0.5 },
        ];
        peaks.forEach((p) => {
          const peak = mkMound(p.r, p.h);
          peak.position.set(p.x, PLATE_H + p.h / 2 - 0.02, p.z);
          cg.add(peak);
        });
        // hillside homes dotted up the main slopes (like the reference)
        const slopeMat = () => stuccoMat();
        for (let i = 0; i < 7; i++) {
          const p = peaks[i % 2]; // main + second peak
          const ang = Math.PI * (0.15 + Math.random() * 0.7); // front-facing arc
          const rr = p.r * (0.45 + Math.random() * 0.4);
          const hx = p.x + Math.cos(ang) * rr;
          const hz = p.z + Math.sin(ang) * rr * 0.55;
          const hy = PLATE_H + Math.max(0.02, p.h * (1 - rr / p.r) * 0.5);
          const home = new THREE.Mesh(bodyGeo, slopeMat());
          home.scale.set(0.11 + Math.random() * 0.05, 0.05 + Math.random() * 0.03, 0.09);
          home.position.set(hx, hy + 0.03, hz);
          home.rotation.y = Math.random() * Math.PI;
          const roof = new THREE.Mesh(
            bodyGeo,
            new THREE.MeshStandardMaterial({ color: TILE[(Math.random() * TILE.length) | 0], roughness: 0.75 })
          );
          roof.scale.set(home.scale.x * 1.1, 0.012, home.scale.z * 1.1);
          roof.position.set(hx, hy + 0.03 + home.scale.y / 2 + 0.006, hz);
          roof.rotation.y = home.rotation.y;
          cg.add(home, roof);
        }
        // ---- ONE continuous fairway ribbon (no stacked decals) ----
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-pw * 0.4, 0, pd * 0.36),
          new THREE.Vector3(-pw * 0.16, 0, pd * 0.16),
          new THREE.Vector3(pw * 0.04, 0, pd * 0.3),
          new THREE.Vector3(pw * 0.22, 0, pd * 0.08),
          new THREE.Vector3(pw * 0.36, 0, -pd * 0.06),
        ]);
        const N = 32;
        const ribbonShape = (center: THREE.CatmullRomCurve3, halfAt: (t: number) => number) => {
          const left: THREE.Vector2[] = [];
          const right: THREE.Vector2[] = [];
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            const pt = center.getPoint(t);
            const tan = center.getTangent(t);
            const px = -tan.z,
              pz = tan.x;
            const hw = halfAt(t);
            left.push(new THREE.Vector2(pt.x + px * hw, pt.z + pz * hw));
            right.push(new THREE.Vector2(pt.x - px * hw, pt.z - pz * hw));
          }
          const shape = new THREE.Shape();
          shape.moveTo(left[0].x, left[0].y);
          left.forEach((v) => shape.lineTo(v.x, v.y));
          right.reverse().forEach((v) => shape.lineTo(v.x, v.y));
          shape.closePath();
          return shape;
        };
        const flatMesh = (shape: THREE.Shape, mat: THREE.Material, y: number, order: number) => {
          const geo = new THREE.ShapeGeometry(shape, 6);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.y = y;
          mesh.renderOrder = order;
          return mesh;
        };
        const decalMat = (opts: THREE.MeshStandardMaterialParameters, layer: number) =>
          new THREE.MeshStandardMaterial({
            ...opts,
            polygonOffset: true,
            polygonOffsetFactor: -2 * layer,
            polygonOffsetUnits: -1,
          });
        // fairway: organic width variation, striped turf texture, single mesh
        const fairwayMat = decalMat({ map: grassTex, color: 0xd9ffdc, roughness: 0.85, emissive: 0x123f18, emissiveIntensity: 0.35 }, 1);
        const fairway = flatMesh(
          ribbonShape(curve, (t) => 0.16 + 0.07 * Math.sin(t * Math.PI * 2.6) + 0.05 * Math.sin(t * Math.PI * 7 + 1.2)),
          fairwayMat,
          PLATE_H + 0.004,
          2
        );
        cg.add(fairway);
        // cart path: thin ribbon offset alongside the fairway, single mesh
        const pathPts: THREE.Vector3[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const pt = curve.getPoint(t);
          const tan = curve.getTangent(t);
          pathPts.push(new THREE.Vector3(pt.x - tan.z * 0.27, 0, pt.z + tan.x * 0.27));
        }
        const pathCurve = new THREE.CatmullRomCurve3(pathPts);
        const pathMat = decalMat({ color: 0xdcd4bd, roughness: 1 }, 2);
        cg.add(flatMesh(ribbonShape(pathCurve, () => 0.018), pathMat, PLATE_H + 0.005, 3));
        // putting greens: collar ring + green, at both ends
        const greenMat = decalMat({ map: grassTex, color: 0xb4ffb0, roughness: 0.8, emissive: 0x1c5a22, emissiveIntensity: 0.4 }, 3);
        const collarMat = decalMat({ color: 0x77c46b, roughness: 0.85 }, 2);
        const bunkerMat = decalMat({ color: 0xefe6c2, roughness: 1 }, 3);
        [0.02, 0.98].forEach((endT) => {
          const pt = curve.getPoint(endT);
          const collar = new THREE.Mesh(new THREE.CircleGeometry(0.15, 22), collarMat);
          collar.rotation.x = -Math.PI / 2;
          collar.scale.set(1.25, 1, 1);
          collar.position.set(pt.x, PLATE_H + 0.005, pt.z);
          collar.renderOrder = 3;
          const green = new THREE.Mesh(new THREE.CircleGeometry(0.11, 22), greenMat);
          green.rotation.x = -Math.PI / 2;
          green.scale.set(1.25, 1, 1);
          green.position.set(pt.x, PLATE_H + 0.006, pt.z);
          green.renderOrder = 4;
          cg.add(collar, green);
          // two bunkers tucked at each green edge
          [0.8, 2.4].forEach((ang) => {
            const bunker = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), bunkerMat);
            bunker.rotation.x = -Math.PI / 2;
            bunker.scale.set(1.5, 0.9, 1);
            bunker.position.set(pt.x + Math.cos(ang + endT * 2) * 0.17, PLATE_H + 0.006, pt.z + Math.sin(ang + endT * 2) * 0.13);
            bunker.renderOrder = 4;
            cg.add(bunker);
          });
        });
        // pond with sand rim so it sits IN the terrain, not on it
        const pondRim = new THREE.Mesh(new THREE.CircleGeometry(0.155, 22), decalMat({ color: 0xcbb58c, roughness: 1 }, 2));
        pondRim.rotation.x = -Math.PI / 2;
        pondRim.scale.set(1.5, 0.9, 1);
        pondRim.position.set(-pw * 0.02, PLATE_H + 0.005, pd * 0.12);
        pondRim.renderOrder = 3;
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(0.13, 22),
          decalMat({ color: 0x2fb9c9, emissive: 0x1a7f8e, emissiveIntensity: 0.7, roughness: 0.2 }, 3)
        );
        pond.rotation.x = -Math.PI / 2;
        pond.scale.set(1.5, 0.9, 1);
        pond.position.set(-pw * 0.02, PLATE_H + 0.006, pd * 0.12);
        pond.renderOrder = 4;
        cg.add(pondRim, pond);
        // orderly instanced tree rows lining the fairway (reference look)
        const crownGeo = new THREE.SphereGeometry(0.055, 7, 6);
        const trunkGeoPV = new THREE.CylinderGeometry(0.011, 0.015, 0.08, 5);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e6e3c, roughness: 0.9 });
        const trunkMatPV = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 0.95 });
        const spots: { x: number; z: number; s: number }[] = [];
        for (let i = 1; i < N; i += 2) {
          const t = i / N;
          const pt = curve.getPoint(t);
          const tan = curve.getTangent(t);
          [1, -1].forEach((side) => {
            if (t < 0.14 && side < 0) return; // keep the resort corner open
            spots.push({
              x: pt.x + -tan.z * side * (0.3 + Math.random() * 0.05),
              z: pt.z + tan.x * side * (0.3 + Math.random() * 0.05),
              s: 0.75 + Math.random() * 0.55,
            });
          });
        }
        const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
        const trunks = new THREE.InstancedMesh(trunkGeoPV, trunkMatPV, spots.length);
        const m4 = new THREE.Matrix4();
        spots.forEach((sp, i) => {
          m4.compose(new THREE.Vector3(sp.x, PLATE_H + 0.04 * sp.s, sp.z), new THREE.Quaternion(), new THREE.Vector3(sp.s, sp.s, sp.s));
          trunks.setMatrixAt(i, m4);
          m4.compose(new THREE.Vector3(sp.x, PLATE_H + 0.11 * sp.s, sp.z), new THREE.Quaternion(), new THREE.Vector3(sp.s, sp.s * 0.85, sp.s));
          crowns.setMatrixAt(i, m4);
        });
        cg.add(crowns, trunks);
        // resort complex: villas + bright pool with white deck
        const deck = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.95 }));
        deck.scale.set(0.24, 0.006, 0.16);
        deck.position.set(-pw * 0.3, PLATE_H + 0.006, pd * 0.02);
        const rpool = new THREE.Mesh(
          bodyGeo,
          new THREE.MeshStandardMaterial({ color: 0x35c2e0, emissive: 0x1e8fb0, emissiveIntensity: 1.0, roughness: 0.1 })
        );
        rpool.scale.set(0.16, 0.008, 0.09);
        rpool.position.set(-pw * 0.3, PLATE_H + 0.011, pd * 0.02);
        cg.add(deck, rpool);
        for (let v = 0; v < 2; v++) {
          const villa = mkRanch(true);
          villa.position.set(-pw * (0.34 - v * 0.09), PLATE_H, pd * (0.14 + v * 0.04));
          villa.rotation.y = v * 0.5 - 0.2;
          villa.scale.setScalar(0.8);
          cg.add(villa);
        }
        // desert scrub kept OFF the fairway — two tidy pockets only
        [
          [-0.12, 0.4], [0.14, 0.42], [0.42, 0.3], [0.44, 0.14], [-0.44, -0.1], [0.05, -0.05],
        ].forEach(([sx, sz]) => {
          const bush = mkBush();
          bush.position.set(sx * pw, PLATE_H, sz * pd);
          bush.scale.setScalar(0.6 + Math.random() * 0.4);
          cg.add(bush);
        });
      } else if (ci % 2 === 0) {
        // foothill backdrop on some tiles — low rocky mounds along the back edge
        const mounds = 2 + (ci % 3);
        for (let i = 0; i < mounds; i++) {
          const mh = 0.22 + Math.random() * 0.3;
          const mound = mkMound(pw * (0.1 + Math.random() * 0.1), mh);
          mound.position.set((i / Math.max(1, mounds - 1) - 0.5) * pw * 0.8, PLATE_H + mh / 2 - 0.02, -pd * (0.38 + Math.random() * 0.06));
          cg.add(mound);
        }
      }

      // generous invisible hit volume: consistent hover/click target
      const hitR = Math.max(pw, pd) * 0.62;
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(hitR, hitR, 1.6, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.8;
      hit.userData.isHit = true;
      cg.add(hit);
      hitMeshes.push(hit);

      // houses in orderly blocks around the cross streets (like the reference)
      const cells: [number, number][] = [
        [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3],
        [-0.33, 0], [0.33, 0], [0, -0.33], [0, 0.33],
      ];
      // Paradise Valley builds only along the resort side — the fairway owns the middle
      const PV_CELLS: [number, number][] = [
        [-0.35, 0.26],
        [-0.34, -0.02],
        [-0.16, 0.36],
      ];
      const useCells = isPV ? PV_CELLS : cells;
      const count = isPV ? 3 : d.live ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const [cx, cz] = useCells[i % useCells.length];
        const isLandmark = isPV ? i === 0 : d.live && i === 3;
        // Kenney buildings when loaded (warm-tinted, house-scaled); procedural fallback
        let az: THREE.Object3D | null = fitModel(
          BUILD_MODELS[(Math.random() * BUILD_MODELS.length) | 0],
          0.34 + Math.random() * 0.12,
          0,
          true
        );
        if (!az) {
          az = isPV
            ? i === 0
              ? mkLandmark(true)
              : Math.random() < 0.75
                ? mkRanch(Math.random() < 0.8)
                : mkAdobe(true)
            : d.live && i === 3
              ? mkLandmark(true)
              : Math.random() < 0.55
                ? mkAdobe(d.live && Math.random() < 0.7)
                : mkRanch(d.live && Math.random() < 0.7);
        }
        az.position.set(cx * pw + (Math.random() - 0.5) * 0.1, PLATE_H, cz * pd + (Math.random() - 0.5) * 0.1);
        // axis-aligned with tiny jitter — tidy diorama look
        az.rotation.y = (Math.round(Math.random()) * Math.PI) / 2 + (Math.random() - 0.5) * 0.08;
        // per-lot size variety; landmarks scale up to anchor the skyline
        az.scale.setScalar((0.85 + Math.random() * 0.3) * (isLandmark ? 1.35 : 1));
        cg.add(az);
        // backyard pool — it's Arizona (near-standard in Paradise Valley)
        if (Math.random() < (isPV ? 0.55 : 0.3)) {
          const pool = new THREE.Mesh(
            bodyGeo,
            new THREE.MeshStandardMaterial({ color: 0x2f9fd8, emissive: 0x1a6f9e, emissiveIntensity: 0.9, roughness: 0.15 })
          );
          pool.scale.set(0.16, 0.012, 0.1);
          pool.position.set(az.position.x + 0.2, PLATE_H + 0.01, az.position.z - 0.16);
          cg.add(pool);
        }
      }
      // Kenney green pockets (tree yards) + Heritage District fountain plaza
      if (!isPV) {
        [
          [0.16, -0.16, "grass-trees"],
          [-0.16, 0.16, "grass-trees-tall"],
        ].forEach(([gx, gz, gname]) => {
          const gm = fitModel(gname as (typeof MODEL_NAMES)[number], 0.42);
          if (gm) {
            gm.position.set((gx as number) * pw, PLATE_H + 0.002, (gz as number) * pd);
            cg.add(gm);
          }
        });
        if (d.name === "Heritage District") {
          const fountain = fitModel("pavement-fountain", 0.4);
          if (fountain) {
            fountain.position.set(-0.16 * pw, PLATE_H + 0.002, -0.16 * pd);
            cg.add(fountain);
          }
        }
      }

      // desert greenery: palms, saguaros and sage bushes at varied sizes
      const greens = d.live ? 8 : 6;
      for (let i = 0; i < greens; i++) {
        const roll = Math.random();
        const green = roll < 0.42 ? mkPalm() : roll < 0.68 ? mkSaguaro() : mkBush();
        const edge = Math.random() < 0.5;
        const gz = edge ? (Math.random() - 0.5) * pd * 0.8 : (Math.random() < 0.5 ? -1 : 1) * pd * 0.42;
        green.position.set(
          (edge ? (Math.random() < 0.5 ? -1 : 1) * pw * 0.42 : (Math.random() - 0.5) * pw * 0.7),
          PLATE_H,
          isPV ? Math.abs(gz) * 0.9 : gz // PV greenery stays on the fairway side, off the mountain
        );
        green.scale.setScalar(0.7 + Math.random() * 0.75);
        cg.add(green);
      }

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, d.h, 6),
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.85 })
      );
      beacon.position.y = PLATE_H + d.h / 2;
      cg.add(beacon);
      cg.scale.setScalar(0.001);
      scene.add(cg);
      clusterGroups.push(cg);
    });
      t0 = performance.now(); // start the grow-in once tiles exist
    };

    // load the Kenney kit, then build the tiles (procedural fallback inside)
    let disposed = false;
    loadModels().then((m) => {
      if (disposed) return;
      kit = m;
      buildClusters();
    });

    // ---- interaction state ----
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let hovered: THREE.Group | null = null;
    let flying = false;
    let zoomedName: string | null = null;
    const down = { x: 0, y: 0, moved: false };

    const groupOfHit = (obj: THREE.Object3D | null): THREE.Group | null => {
      let o = obj;
      while (o && !clusterGroups.includes(o as THREE.Group)) o = o.parent;
      return (o as THREE.Group) || null;
    };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) down.moved = true;
      if (flying) return; // no hover churn mid-flight
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      // raycast ONLY against the big hit-cylinders — cheap and generous
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(hitMeshes, false);
      const group = hits.length ? groupOfHit(hits[0].object) : null;
      if (group !== hovered) {
        if (hovered && !reduced)
          gsap.to(hovered.position, { y: hovered.userData.baseY, duration: 0.5, ease: "power2.out" });
        hovered = group;
        if (hovered && !reduced && !zoomedName)
          gsap.to(hovered.position, { y: 0.42, duration: 0.5, ease: "back.out(2)" });
        el.style.cursor = hovered ? "pointer" : "default";
      }
      setTip(
        group && !zoomedName
          ? { x: e.clientX - r.left, y: e.clientY - r.top, name: group.userData.name as string }
          : null
      );
    };

    const flyTo = (p: THREE.Vector3, look: THREE.Vector3, after?: () => void) => {
      if (reduced) {
        camera.position.copy(p);
        camera.lookAt(look);
        after?.();
        return;
      }
      flying = true;
      gsap.to(camera.position, {
        x: p.x,
        y: p.y,
        z: p.z,
        duration: 1.25,
        ease: "power3.inOut",
        onUpdate: () => camera.lookAt(look),
        onComplete: () => {
          flying = false;
          after?.();
        },
      });
    };

    const flyHome = () => {
      if (flying) return;
      zoomedName = null;
      setZoomed(null);
      flyTo(HOME, LOOK);
    };
    flyHomeRef.current = flyHome;

    const onDown = (e: MouseEvent) => {
      down.x = e.clientX;
      down.y = e.clientY;
      down.moved = false;
    };
    const onUp = () => {
      if (down.moved || flying) return; // it was a drag, not a click
      if (hovered) {
        const p = hovered.position;
        const name = hovered.userData.name as string;
        zoomedName = name;
        setZoomed(name);
        setTip(null);
        flyTo(new THREE.Vector3(p.x + 3.4, 3.2, p.z + 4.6), new THREE.Vector3(p.x, 0.4, p.z));
      } else if (zoomedName) {
        // empty ground only acts when zoomed in — return to overview
        flyHome();
      }
      // not zoomed + empty ground → do nothing (no accidental camera moves)
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseup", onUp);

    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener("resize", onResize);

    let t0 = 0;
    let raf = 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      const t = performance.now() / 1000;
      const el0 = t0 ? performance.now() - t0 : 0;
      clusterGroups.forEach((cg, i) => {
        const k = Math.min(1, Math.max(0, (el0 - i * 160 - 200) / 700));
        const e = 1 - Math.pow(1 - k, 3);
        cg.scale.setScalar(Math.max(0.001, e));
      });
      // parallax: gentle, and eases toward zero while flying / zoomed
      const amp = flying ? 0 : zoomedName ? 0.05 : 0.16;
      mouse.x += (mouse.tx * amp - mouse.x) * 0.04;
      mouse.y += (mouse.ty * amp - mouse.y) * 0.04;
      scene.rotation.y = mouse.x;
      scene.rotation.x = mouse.y * 0.3;
      key.position.set(Math.cos(t * 0.5) * 8, 7, Math.sin(t * 0.5) * 8);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    // pause rendering when the tab is hidden
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        animate();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mount} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      {tip && (
        <div
          style={{
            position: "absolute",
            left: tip.x + 14,
            top: tip.y - 10,
            pointerEvents: "none",
            zIndex: 4,
            background: "rgba(5,5,12,0.86)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 9,
            padding: "6px 11px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#F4F3F8",
            whiteSpace: "nowrap",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {tip.name} <span style={{ color: "#41D98A" }}>· active</span>
          <span style={{ color: "#8D89C0" }}> — click to fly in</span>
        </div>
      )}
      {zoomed && (
        <button
          onClick={() => flyHomeRef.current()}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 64,
            transform: "translateX(-50%)",
            zIndex: 4,
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(5,5,12,0.82)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            color: "#F4F3F8",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          ↩ Overview
          <span style={{ color: "#8D89C0", fontWeight: 500 }}>· {zoomed}</span>
        </button>
      )}
    </div>
  );
}
