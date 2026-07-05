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
    scene.fog = new THREE.Fog(0x06060d, 16, 34);
    const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 100);
    const HOME = new THREE.Vector3(9, 8.5, 12);
    camera.position.copy(HOME);
    camera.lookAt(0.5, 0.4, 0);

    scene.add(new THREE.AmbientLight(0x9585c5, 0.7));
    const l1 = new THREE.PointLight(0xa855f7, 1.9, 48);
    l1.position.set(-6, 8, 4);
    scene.add(l1);
    const l2 = new THREE.PointLight(0x38bdf8, 1.4, 48);
    l2.position.set(7, 6, -5);
    scene.add(l2);
    const key = new THREE.PointLight(0xffffff, 0.8, 40);
    scene.add(key);
    // warmer dusk sun so the sandstone tiles and stucco read Arizona-warm
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

    // foothill ridges
    const backAngle = Math.atan2(12, 9) + Math.PI;
    const hillNear = new THREE.MeshStandardMaterial({ color: 0x2a2244, roughness: 1 });
    const hillFar = new THREE.MeshStandardMaterial({ color: 0x1c1738, roughness: 1 });
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

    // rocky mound (foothill / mountain) — flattened low-poly cone
    const ROCK = [0x8a6a4d, 0x7a5c42, 0x6e5138, 0x94745a];
    const mkMound = (w: number, h: number) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(w, h, 7, 1),
        new THREE.MeshStandardMaterial({ color: ROCK[(Math.random() * ROCK.length) | 0], roughness: 1 })
      );
      m.scale.z = 0.55;
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
        new THREE.MeshStandardMaterial({ color: 0xcbb187, roughness: 0.95, metalness: 0 })
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.y = PLATE_H;
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
        // ---- Paradise Valley: mountain backdrop + winding golf fairways ----
        const peak = mkMound(pw * 0.34, 1.15);
        peak.position.set(pw * 0.16, PLATE_H + 1.15 / 2 - 0.02, -pd * 0.34);
        const peak2 = mkMound(pw * 0.22, 0.7);
        peak2.position.set(-pw * 0.24, PLATE_H + 0.7 / 2 - 0.02, -pd * 0.4);
        const peak3 = mkMound(pw * 0.16, 0.45);
        peak3.position.set(pw * 0.42, PLATE_H + 0.45 / 2 - 0.02, -pd * 0.28);
        cg.add(peak, peak2, peak3);
        // fairways: overlapping green blobs winding diagonally across the tile
        const fairwayMat = new THREE.MeshStandardMaterial({ color: 0x3f9448, roughness: 0.85 });
        const fairway2Mat = new THREE.MeshStandardMaterial({ color: 0x4aa64f, roughness: 0.85 });
        [
          { x: -0.28, z: 0.3, a: 0.5, b: 0.3, m: fairwayMat },
          { x: -0.02, z: 0.12, a: 0.42, b: 0.26, m: fairway2Mat },
          { x: 0.22, z: -0.04, a: 0.4, b: 0.24, m: fairwayMat },
          { x: 0.36, z: 0.28, a: 0.3, b: 0.2, m: fairway2Mat },
        ].forEach((f) => {
          const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 22), f.m);
          blob.rotation.x = -Math.PI / 2;
          blob.rotation.z = Math.random() * Math.PI;
          blob.scale.set(f.a * pw * 0.5, f.b * pd * 0.5, 1);
          blob.position.set(f.x * pw, PLATE_H + 0.005, f.z * pd);
          cg.add(blob);
        });
        // pond + sand bunkers
        const pond = new THREE.Mesh(
          new THREE.CircleGeometry(0.16, 20),
          new THREE.MeshStandardMaterial({ color: 0x2fb9c9, emissive: 0x1a7f8e, emissiveIntensity: 0.7, roughness: 0.2 })
        );
        pond.rotation.x = -Math.PI / 2;
        pond.scale.set(1.4, 0.9, 1);
        pond.position.set(-pw * 0.1, PLATE_H + 0.008, pd * 0.18);
        cg.add(pond);
        const bunkerMat = new THREE.MeshStandardMaterial({ color: 0xe8dcae, roughness: 1 });
        [
          [-0.2, 0.36], [0.12, 0.06], [0.3, 0.2],
        ].forEach(([bx, bz]) => {
          const bunker = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), bunkerMat);
          bunker.rotation.x = -Math.PI / 2;
          bunker.scale.set(1.3, 0.8, 1);
          bunker.position.set(bx * pw, PLATE_H + 0.009, bz * pd);
          cg.add(bunker);
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
      // Paradise Valley builds only on the front half (mountain owns the back)
      const useCells = isPV ? cells.filter(([, cz]) => cz > -0.2) : cells;
      const count = isPV ? 6 : d.live ? 8 : 5;
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
      flyTo(HOME, new THREE.Vector3(0.5, 0.4, 0));
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
