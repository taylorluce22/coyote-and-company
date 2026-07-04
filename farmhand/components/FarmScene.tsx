"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { FARM_CLUSTERS } from "@/lib/data";

/**
 * Real-time 3D farm — 5 neighborhood clusters of low-poly AZ ranch houses
 * on a dark grid plane with fog, an orbiting key light, foothill ridges,
 * mouse-parallax, hover-lift + tooltip, and click-to-fly-in.
 * Faithful to the handoff's init3D scene, tuned for smooth production use.
 */
export default function FarmScene() {
  const mount = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string } | null>(
    null
  );

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const W = () => el.clientWidth || 700;
    const H = () => el.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
      const fol = new THREE.Mesh(foliageGeo, new THREE.MeshStandardMaterial({ color: Math.random() < 0.3 ? 0x5a6b3f : 0x3f7d4a, roughness: 0.9 }));
      const fs = 0.28 + Math.random() * 0.16;
      fol.scale.setScalar(fs);
      fol.position.y = th + fs * 0.38;
      g.add(trunk, fol);
      return g;
    };

    // clusters
    const clusterGroups: THREE.Group[] = [];
    FARM_CLUSTERS.forEach((d) => {
      const cg = new THREE.Group();
      cg.position.set(d.x, 0, d.z);
      cg.userData = { name: d.name, baseY: 0 };
      // ring pad
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(d.w, d.d) * 0.62, 32),
        new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.08 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.02;
      cg.add(pad);
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
      // accent beacon
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

    // interaction
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let hovered: THREE.Group | null = null;
    let flying = false;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(clusterGroups, true);
      let group: THREE.Group | null = null;
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && !clusterGroups.includes(o as THREE.Group)) o = o.parent;
        group = (o as THREE.Group) || null;
      }
      if (group !== hovered) {
        if (hovered && !reduced)
          gsap.to(hovered.position, { y: hovered.userData.baseY, duration: 0.5, ease: "power2.out" });
        hovered = group;
        if (hovered && !reduced)
          gsap.to(hovered.position, { y: 0.42, duration: 0.5, ease: "back.out(2)" });
        el.style.cursor = hovered ? "pointer" : "default";
      }
      setTip(
        group
          ? { x: e.clientX - r.left, y: e.clientY - r.top, name: (group.userData.name as string) }
          : null
      );
    };

    const onClick = () => {
      if (flying) return;
      flying = true;
      if (hovered) {
        const p = hovered.position;
        gsap.to(camera.position, {
          x: p.x + 3.4,
          y: 3.2,
          z: p.z + 4.6,
          duration: 1.25,
          ease: "power3.inOut",
          onUpdate: () => camera.lookAt(p.x, 0.4, p.z),
          onComplete: () => (flying = false),
        });
      } else {
        gsap.to(camera.position, {
          x: HOME.x,
          y: HOME.y,
          z: HOME.z,
          duration: 1.25,
          ease: "power3.inOut",
          onUpdate: () => camera.lookAt(0.5, 0.4, 0),
          onComplete: () => (flying = false),
        });
      }
    };

    if (!reduced) el.addEventListener("mousemove", onMove);
    el.addEventListener("click", onClick);

    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener("resize", onResize);

    const t0 = performance.now();
    let raf = 0;
    const animate = () => {
      const t = performance.now() / 1000;
      const el0 = performance.now() - t0;
      clusterGroups.forEach((cg, i) => {
        const k = Math.min(1, Math.max(0, (el0 - i * 160 - 200) / 700));
        const e = 1 - Math.pow(1 - k, 3);
        cg.scale.setScalar(Math.max(0.001, e));
      });
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      if (!flying) {
        scene.rotation.y = mouse.x * 0.24;
        scene.rotation.x = mouse.y * 0.05;
      }
      key.position.set(Math.cos(t * 0.5) * 8, 7, Math.sin(t * 0.5) * 8);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
      if (renderer.domElement.parentNode === el)
        el.removeChild(renderer.domElement);
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
            background: "rgba(5,5,12,0.82)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 9,
            padding: "6px 11px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#F4F3F8",
            whiteSpace: "nowrap",
            backdropFilter: "blur(6px)",
          }}
        >
          {tip.name} <span style={{ color: "#41D98A" }}>· active</span>
          <span style={{ color: "#8D89C0" }}> — click to fly in</span>
        </div>
      )}
    </div>
  );
}
