'use client';

import React, { useEffect, useRef } from 'react';

interface StarfieldBackgroundProps {
  /** Ref to the container element - used for sizing and mouse events */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Optional class for the canvas wrapper */
  className?: string;
}

/** Load Three.js from CDN (avoids npm dependency) */
function loadThree(): Promise<typeof import('three')> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    const g = window as any;
    if (g.THREE) return resolve(g.THREE);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
    script.onload = () => resolve(g.THREE);
    script.onerror = () => reject(new Error('Failed to load Three.js'));
    document.head.appendChild(script);
  });
}

/**
 * Starfield background with mouse interaction: trails and lightning on fast movement.
 * Extracted from EXTREME TRANSLATE (Justin Linwood Ross, 2025).
 */
export default function StarfieldBackground({ containerRef, className = '' }: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef?.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animId = 0;
    let scene: any;
    let camera: any;
    let renderer: any;
    let particles: any;
    let pGeo: any;
    const particleCount = 1000;
    let trailPool: any[] = [];
    const poolSize = 200;
    let poolIndex = 0;
    let lightningGroup: any;
    let mouseTarget = { x: 0, y: 2.1 };
    let last = { x: 0, y: 0, t: 0 };

    const init = async () => {
      const THREE = await loadThree();

      const ctx = canvas.getContext('webgl', { antialias: true, alpha: true });
      if (!ctx) return;

      renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030014, 0.02);

      camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        200
      );
      camera.position.set(0, 2.2, 6);

      const hemi = new THREE.HemisphereLight(0x202038, 0x001020, 0.6);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 0.5);
      dir.position.set(5, 10, 5);
      scene.add(dir);

      // Particles (stars)
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      }

      pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0x00f0ff,
        size: 0.04,
        transparent: true,
        opacity: 0.9,
      });
      particles = new THREE.Points(pGeo, pMat);
      scene.add(particles);

      const neonLight = new THREE.PointLight(0xa78bfa, 1.5, 40);
      neonLight.position.set(0, 4, 6);
      scene.add(neonLight);

      // Mouse trails pool
      trailPool = [];
      for (let i = 0; i < poolSize; i++) {
        const g = new THREE.SphereGeometry(0.03, 8, 6);
        const m = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.95,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.visible = false;
        scene.add(mesh);
        trailPool.push({ mesh, intervalId: 0 });
      }

      function emitTrail(pos: any, size = 0.03, life = 420) {
        const entry = trailPool[poolIndex % poolSize];
        poolIndex++;
        if (entry.intervalId) clearInterval(entry.intervalId);
        const m = entry.mesh;
        m.position.copy(pos);
        m.scale.setScalar(size);
        m.material.opacity = 0.95;
        m.visible = true;
        const start = performance.now();
        entry.intervalId = window.setInterval(() => {
          const t = (performance.now() - start) / life;
          if (t >= 1) {
            m.visible = false;
            if (entry.intervalId) clearInterval(entry.intervalId);
            entry.intervalId = 0;
          } else {
            m.material.opacity = 0.95 * (1 - t);
          }
        }, 60);
      }

      // Lightning group
      lightningGroup = new THREE.Group();
      scene.add(lightningGroup);

      function spawnLightningAt(worldPos: any, intensity = 1.0) {
        const segments = Math.floor(Math.random() * 5) + 4;
        const points = [];
        for (let i = 0; i < segments; i++) {
          const t = i / (segments - 1);
          points.push(
            new THREE.Vector3(
              worldPos.x + (Math.random() - 0.5) * 0.6 * (1 + t),
              worldPos.y - t * (1.2 + Math.random() * 1.4),
              worldPos.z + (Math.random() - 0.5) * 0.6 * (1 + t)
            )
          );
        }
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: 0x00f3ff,
          transparent: true,
          opacity: 0.95 * intensity,
        });
        const line = new THREE.Line(geom, mat);
        lightningGroup.add(line);
        for (let i = 0; i < Math.floor(Math.random() * 4) + 3; i++) {
          const idx = Math.floor(Math.random() * points.length);
          const p = points[idx];
          emitTrail(
            new THREE.Vector3(
              p.x + Math.random() * 0.12 - 0.06,
              p.y + Math.random() * 0.12 - 0.06,
              p.z + Math.random() * 0.12 - 0.06
            ),
            0.02,
            240 + Math.random() * 260
          );
        }
        const start = performance.now();
        const life = 220 + Math.random() * 380;
        function fade() {
          const t = (performance.now() - start) / life;
          if (t >= 1) {
            lightningGroup.remove(line);
            geom.dispose();
            mat.dispose();
          } else {
            mat.opacity = 0.95 * (1 - t);
            requestAnimationFrame(fade);
          }
        }
        requestAnimationFrame(fade);
      }

      function rand(a: number, b: number) {
        return Math.random() * (b - a) + a;
      }

      function clientToWorld(clientX: number, clientY: number, depth = 0.5) {
        const rect = container.getBoundingClientRect();
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
        return new THREE.Vector3(nx, ny, depth).unproject(camera);
      }

      const handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          return;
        }
        const pos = clientToWorld(e.clientX, e.clientY, 0.45);
        for (let i = 0; i < Math.floor(rand(1, 3)); i++) {
          emitTrail(
            new THREE.Vector3(
              pos.x + rand(-0.02, 0.02),
              pos.y + rand(-0.02, 0.02),
              pos.z + rand(-0.02, 0.02)
            ),
            rand(0.02, 0.05),
            380 + Math.random() * 200
          );
        }
        const now = performance.now();
        const dx = Math.abs(e.clientX - last.x);
        const dy = Math.abs(e.clientY - last.y);
        const dt = Math.max(16, now - (last.t || now));
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        if (speed > 0.4 && Math.random() < Math.min(speed * 1.8, 0.85)) {
          spawnLightningAt(pos, Math.min(1.6, speed * 1.6));
        }
        last.x = e.clientX;
        last.y = e.clientY;
        last.t = now;
        mouseTarget.x = ((e.clientX - rect.left) / rect.width - 0.5) * 1.2;
        mouseTarget.y = (0.5 - (e.clientY - rect.top) / rect.height) * 0.8 + 1.8;
      };

      container.addEventListener('mousemove', handleMouseMove);

      function animate() {
        animId = requestAnimationFrame(animate);
        if (!pGeo?.attributes?.position) return;
        const posArr = pGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3 + 2;
          posArr[idx] += 0.0006 * (1 + Math.sin(performance.now() * 0.0001 + i));
          if (posArr[idx] > 40) posArr[idx] = -40;
        }
        pGeo.attributes.position.needsUpdate = true;
        camera.position.x += (mouseTarget.x - camera.position.x) * 0.03;
        camera.position.y += (mouseTarget.y - camera.position.y) * 0.03;
        camera.lookAt(0, 1.4, 0);
        renderer.render(scene, camera);
      }
      animate();

      const resizeObserver = new ResizeObserver(() => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        container.removeEventListener('mousemove', handleMouseMove);
        resizeObserver.disconnect();
        trailPool.forEach((entry) => {
          if (entry.intervalId) clearInterval(entry.intervalId);
        });
        renderer?.dispose();
        pGeo?.dispose();
        particles?.material?.dispose();
      };
    };

    init();

    return () => {
      cleanupRef.current?.();
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      style={{ display: 'block' }}
      aria-hidden
    />
  );
}
