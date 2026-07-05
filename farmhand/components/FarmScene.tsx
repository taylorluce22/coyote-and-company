"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { FARM_CLUSTERS } from "@/lib/data";

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
    const sun = new THREE.DirectionalLight(0xffd9b0, 0.55);
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

    // shared geometry
    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const winGeo = new THREE.PlaneGeometry(1, 1);
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.5, 0);
    triShape.lineTo(0.5, 0);
    triShape.lineTo(0, 0.4);
    triShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(triShape, { depth: 1, bevelEnabled: false });
    gableGeo.translate(0, 0, -0.5);
    const trunkGeo = new THREE.CylinderGeometry(0.04, 0.055, 1, 6);
    const foliageGeo = new THREE.SphereGeometry(0.5, 8, 7);
    const WALLS = [0xcdbfa3, 0xbfa98d, 0xd6c9b4, 0xb3a08a, 0xc4b49b];
    const ROOFS = [0x8a5a3b, 0x9c6844, 0x6e4a33, 0x7d5a41];

    const mkHouse = (lit: boolean) => {
      const g = new THREE.Group();
      const bw = 0.52 + Math.random() * 0.26,
        bd = 0.4 + Math.random() * 0.16,
        bh = 0.22 + Math.random() * 0.13;
      const body = new THREE.Mesh(
        bodyGeo,
        new THREE.MeshStandardMaterial({ color: WALLS[(Math.random() * WALLS.length) | 0], roughness: 0.88 })
      );
      body.scale.set(bw, bh, bd);
      body.position.y = bh / 2;
      const roof = new THREE.Mesh(
        gableGeo,
        new THREE.MeshStandardMaterial({ color: ROOFS[(Math.random() * ROOFS.length) | 0], roughness: 0.75 })
      );
      roof.scale.set(bw * 1.16, 0.42 + Math.random() * 0.25, bd * 1.12);
      roof.rotation.y = Math.PI / 2;
      roof.position.y = bh;
      const win = new THREE.Mesh(
        winGeo,
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: lit ? 0.95 : 0.12 })
      );
      win.scale.set(bw * 0.34, bh * 0.5, 1);
      win.position.set(bw * 0.16, bh * 0.45, bd / 2 + 0.004);
      g.add(body, roof, win);
      return g;
    };
    const mkTree = () => {
      const g = new THREE.Group();
      const th = 0.16 + Math.random() * 0.14;
      const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.95 }));
      trunk.scale.y = th;
      trunk.position.y = th / 2;
      const fol = new THREE.Mesh(
        foliageGeo,
        new THREE.MeshStandardMaterial({ color: Math.random() < 0.3 ? 0x5a6b3f : 0x3f7d4a, roughness: 0.9 })
      );
      const fs = 0.28 + Math.random() * 0.16;
      fol.scale.setScalar(fs);
      fol.position.y = th + fs * 0.38;
      g.add(trunk, fol);
      return g;
    };

    // clusters — each with a generous invisible hit-cylinder
    const clusterGroups: THREE.Group[] = [];
    const hitMeshes: THREE.Mesh[] = [];
    FARM_CLUSTERS.forEach((d) => {
      const cg = new THREE.Group();
      cg.position.set(d.x, 0, d.z);
      cg.userData = { name: d.name, baseY: 0 };
      const padR = Math.max(d.w, d.d) * 0.62;
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(padR, 32),
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.08 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      cg.add(pad);
      // generous invisible hit volume: consistent hover/click target
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(padR * 1.15, padR * 1.15, 1.6, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.8;
      hit.userData.isHit = true;
      cg.add(hit);
      hitMeshes.push(hit);
      const count = d.live ? 9 : 5;
      for (let i = 0; i < count; i++) {
        const house = mkHouse(d.live && Math.random() < 0.7);
        house.position.set((Math.random() - 0.5) * d.w, 0, (Math.random() - 0.5) * d.d);
        house.rotation.y = Math.random() * Math.PI;
        cg.add(house);
      }
      for (let i = 0; i < 4; i++) {
        const tree = mkTree();
        tree.position.set((Math.random() - 0.5) * d.w * 1.2, 0, (Math.random() - 0.5) * d.d * 1.2);
        cg.add(tree);
      }
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, d.h, 6),
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.85 })
      );
      beacon.position.y = d.h / 2;
      cg.add(beacon);
      cg.scale.setScalar(0.001);
      scene.add(cg);
      clusterGroups.push(cg);
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

    const t0 = performance.now();
    let raf = 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      const t = performance.now() / 1000;
      const el0 = performance.now() - t0;
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
