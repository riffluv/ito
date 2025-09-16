"use client";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as PIXI from "pixi.js";
import { ThreeBackgroundAdvanced } from "./ThreeBackgroundAdvanced";

interface ThreeBackgroundProps {
  className?: string;
}

export function ThreeBackground({ className }: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const [backgroundType, setBackgroundType] = useState<"css" | "three3d" | "three3d_advanced" | "pixijs">("css");

  // LocalStorageから設定読み込み & イベントリスナー設定
  useEffect(() => {
    // 初期設定読み込み
    const loadBackgroundType = () => {
      try {
        const saved = localStorage.getItem("backgroundType");
        if (saved && ["css", "three3d", "three3d_advanced", "pixijs"].includes(saved)) {
          setBackgroundType(saved as any);
        }
      } catch {
        // エラーは無視
      }
    };

    loadBackgroundType();

    // 設定変更イベントリスナー
    const handleBackgroundChange = (event: any) => {
      setBackgroundType(event.detail.backgroundType);
    };

    window.addEventListener("backgroundTypeChanged", handleBackgroundChange);
    return () => {
      window.removeEventListener("backgroundTypeChanged", handleBackgroundChange);
    };
  }, []);

  // Three.js初期化用Effect
  useEffect(() => {
    // CSS背景またはPixiJS背景の場合はThree.jsを初期化しない
    if (backgroundType === "css" || backgroundType === "pixijs") {
      return;
    }
    if (!mountRef.current) return;

    console.log("ThreeBackground: Starting initialization...");

    try {
      // シーン初期化
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      console.log("ThreeBackground: Scene created");

      // カメラ設定（魔法陣全体が見える距離）
      const camera = new THREE.PerspectiveCamera(
        55, // 魔法陣全体を見渡せる広角
        window.innerWidth / window.innerHeight,
        0.1,
        2000
      );
      camera.position.set(0, 0, 10); // 魔法陣全体が収まる距離
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;
      console.log("ThreeBackground: Camera positioned at", camera.position);

      // レンダラー設定（高品質）
      const renderer = new THREE.WebGLRenderer({
        antialias: true, // 高品質アンチエイリアス
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      renderer.setClearColor(0x04020a, 1); // より深い宇宙の闇（3D魔法陣用）
      // 色空間・トーンマッピング設定
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      console.log("ThreeBackground: Three.js renderer configured");

      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
      console.log("ThreeBackground: Canvas mounted to DOM");

      // ===== ChatGPT高品質魔法陣システム =====

      // 共通: ソフト円テクスチャ
      const makeCircleTexture = (size = 64): THREE.CanvasTexture => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // コンテキストが取得できない場合は空のテクスチャを返す
          return new THREE.CanvasTexture(canvas);
        }
        const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipMapLinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      // 1. 高品質ネビュラ背景
      const createAdvancedNebula = () => {
        const nebulaUniforms = {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        const nebulaMaterial = new THREE.ShaderMaterial({
          uniforms: nebulaUniforms,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            varying vec2 vUv;
            uniform float u_time;
            uniform vec2 u_resolution;

            // Simplex noise
            vec3 mod289(vec3 x) { return x - floor(x*(1.0/289.0))*289.0; }
            vec2 mod289(vec2 x) { return x - floor(x*(1.0/289.0))*289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

            float snoise(vec2 v) {
              const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
              vec2 i = floor(v + dot(v, C.yy));
              vec2 x0 = v - i + dot(i, C.xx);
              vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
              vec4 x12 = x0.xyxy + C.xxzz;
              x12.xy -= i1;
              i = mod289(i);
              vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
              m *= m; m *= m;
              vec3 x = 2.0*fract(p*0.0243902439)-1.0;
              vec3 h = abs(x)-0.5;
              vec3 ox = floor(x+0.5);
              vec3 a0 = x-ox;
              m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
              vec3 g;
              g.x = a0.x*x0.x + h.x*x0.y;
              g.y = a0.y*x12.x + h.y*x12.y;
              g.z = a0.z*x12.z + h.z*x12.w;
              return 130.0*dot(m,g);
            }

            float fbm(vec2 st) {
              float v = 0.0;
              float a = 0.55;
              mat2 rot = mat2(0.8,-0.6,0.6,0.8);
              for(int i = 0; i < 6; i++) {
                v += a * snoise(st);
                st = rot * st * 2.0 + 0.1;
                a *= 0.55;
              }
              return v;
            }

            void main() {
              vec2 p = (vUv-0.5) * vec2(u_resolution.x/u_resolution.y, 1.0);
              float t = u_time * 0.045;
              float n = fbm(p * 1.2 + vec2(t, -t*0.6));
              vec3 colA = vec3(0.12,0.02,0.20);
              vec3 colB = vec3(0.71,0.45,1.00);
              vec3 colC = vec3(0.23,0.09,0.36);
              float glow = smoothstep(0.15,0.75,n*0.5+0.5);
              vec3 col = mix(colA, colC, glow);
              col = mix(col, colB, pow(max(n,0.0),2.0)*0.55);
              float r = length(p);
              col += 0.15*vec3(0.7,0.3,1.0)*smoothstep(0.8,0.0,r);
              col *= 1.0 - smoothstep(0.6,1.1,r);
              gl_FragColor = vec4(col,1.0);
            }
          `,
          depthWrite: false
        });

        const nebula = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), nebulaMaterial);
        nebula.position.z = -4.0;
        nebula.frustumCulled = false;
        scene.add(nebula);
        return { nebula, nebulaUniforms };
      };

      // 2. 高精細スターフィールド（個別瞬き）
      const createAdvancedStars = () => {
        const starGeom = new THREE.BufferGeometry();
        const STAR_COUNT = 800; // モバイル対応で減らした
        const pos = new Float32Array(STAR_COUNT * 3);
        const phase = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
          const r = THREE.MathUtils.randFloat(20, 120);
          const theta = Math.acos(THREE.MathUtils.randFloatSpread(2));
          const phi = THREE.MathUtils.randFloat(0, Math.PI * 2);
          pos[i*3+0] = r * Math.sin(theta) * Math.cos(phi);
          pos[i*3+1] = r * Math.sin(theta) * Math.sin(phi);
          pos[i*3+2] = r * Math.cos(theta);
          phase[i] = Math.random() * Math.PI * 2;
        }

        starGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starGeom.setAttribute('phase', new THREE.BufferAttribute(phase, 1));

        const starUniforms = {
          u_time: { value: 0 },
          u_tex: { value: makeCircleTexture(64) }
        };

        const starMat = new THREE.ShaderMaterial({
          uniforms: starUniforms,
          vertexShader: `
            attribute float phase;
            varying float vPhase;
            void main() {
              vPhase = phase;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mv;
              float size = 1.2 * (300.0 / -mv.z);
              gl_PointSize = clamp(size, 1.0, 6.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            varying float vPhase;
            uniform float u_time;
            uniform sampler2D u_tex;
            void main() {
              vec2 uv = gl_PointCoord;
              vec4 s = texture2D(u_tex, uv);
              float tw = 0.6 + 0.4 * sin(u_time*2.2 + vPhase);
              gl_FragColor = vec4(s.rgb, s.a * tw);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(starGeom, starMat);
        scene.add(stars);
        return { stars, starUniforms };
      };

      // 3. 高品質魔法陣システム
      const createAdvancedMagicCircle = () => {
        const glyphGroup = new THREE.Group();
        scene.add(glyphGroup);

        // マテリアル
        const lineMat = new THREE.LineBasicMaterial({ color: 0xE7C8FF, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
        const thinMat = new THREE.LineBasicMaterial({ color: 0xC5A3FF, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
        const dashMat = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 0.22, gapSize: 0.12, scale: 1, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xB07BFF, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

        // 幾何学関数（簡略化）
        const circleGeometry = (r = 1, seg = 256) => {
          const pts = [];
          for (let i = 0; i <= seg; i++) {
            const a = (i / seg) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
          }
          return new THREE.BufferGeometry().setFromPoints(pts);
        };

        const polygonGeometry = (n = 3, r = 1) => {
          const pts = [];
          for (let i = 0; i <= n; i++) {
            const a = (i % n) / n * Math.PI * 2 - Math.PI / 2;
            pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
          }
          return new THREE.BufferGeometry().setFromPoints(pts);
        };

        const starPolygonGeometry = (n = 5, ro = 2, ri = 1) => {
          const pts = [];
          const N = n * 2;
          for (let i = 0; i <= N; i++) {
            const r = (i % 2 === 0) ? ro : ri;
            const a = i / N * Math.PI * 2 - Math.PI / 2;
            pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
          }
          return new THREE.BufferGeometry().setFromPoints(pts);
        };

        // レイヤー構成
        const layerBack = new THREE.Group();
        const layerMid = new THREE.Group();
        const layerFore = new THREE.Group();
        glyphGroup.add(layerBack, layerMid, layerFore);

        // 背面グロー
        const glow1 = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 256), glowMat);
        glow1.position.z = -0.02;
        layerBack.add(glow1);
        const glow2 = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.1, 256), glowMat);
        glow2.position.z = -0.02;
        layerBack.add(glow2);

        // メイン円
        [1.25, 2.05, 2.95, 4.0].forEach((r, i) => {
          const m = (i % 2 === 0) ? lineMat : thinMat;
          layerMid.add(new THREE.Line(circleGeometry(r), m));
        });

        // ダッシュ円（アニメーション付き）
        const dash1 = new THREE.Line(circleGeometry(1.65), dashMat);
        dash1.computeLineDistances();
        layerMid.add(dash1);
        const dash2 = new THREE.Line(circleGeometry(3.5), dashMat.clone());
        dash2.material.dashSize = 0.28;
        dash2.material.gapSize = 0.14;
        dash2.computeLineDistances();
        layerMid.add(dash2);

        // ポリゴン
        layerMid.add(new THREE.Line(polygonGeometry(3, 1.05), thinMat));
        layerMid.add(new THREE.Line(starPolygonGeometry(5, 1.9, 0.8), lineMat));

        // ノード
        const nodeTex = makeCircleTexture(128);
        const nodeMat = new THREE.SpriteMaterial({
          map: nodeTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          color: 0xFFFFFF,
          opacity: 0.95
        });

        [0, Math.PI/3, Math.PI*2/3, Math.PI, Math.PI*4/3, Math.PI*5/3].forEach(a => {
          const sprite = new THREE.Sprite(nodeMat.clone());
          sprite.position.set(Math.cos(a)*2.95, Math.sin(a)*2.95, 0.01);
          sprite.scale.setScalar(0.14);
          layerFore.add(sprite);
        });

        // オービター
        interface Orbiter {
          s: THREE.Sprite;
          r: number;
          a: number;
          v: number;
        }
        const orbiters: Orbiter[] = [];
        const addOrbiter = (radius: number, speed: number, size: number) => {
          const s = new THREE.Sprite(nodeMat.clone());
          s.scale.setScalar(size);
          s.position.z = 0.02;
          layerFore.add(s);
          orbiters.push({ s, r: radius, a: Math.random() * Math.PI * 2, v: speed });
        };
        addOrbiter(1.65, 0.25, 0.11);
        addOrbiter(2.05, -0.18, 0.09);
        addOrbiter(3.5, 0.12, 0.12);

        glyphGroup.rotation.z = 0.03;

        return { glyphGroup, layerBack, layerMid, layerFore, orbiters, dash1, dash2 };
      };

      // シーン構築（ChatGPT高品質版）
      const { nebula, nebulaUniforms } = createAdvancedNebula();
      const { stars, starUniforms } = createAdvancedStars();
      const magicCircle = createAdvancedMagicCircle();

      console.log("ThreeBackground: Advanced Magic Circle created");

      // 最初に一度レンダリングしてシーンが見えるかテスト
      console.log("ThreeBackground: Performing initial render");
      renderer.render(scene, camera);
      console.log("ThreeBackground: Initial render completed");

      // 高品質魔法陣アニメーションループ
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        // ネビュラ背景アニメーション
        nebulaUniforms.u_time.value = time;

        // 星の個別瞬きアニメーション
        starUniforms.u_time.value = time;
        stars.rotation.y = time * 0.004;
        stars.rotation.x = Math.sin(time * 0.05) * 0.015;

        // 魔法陣の多層回転
        magicCircle.layerBack.rotation.z = time * 0.005;
        magicCircle.layerMid.rotation.z = -time * 0.007;
        magicCircle.layerFore.rotation.z = time * 0.010;

        // ダッシュラインの流れアニメーション
        (magicCircle.dash1.material as any).dashOffset = (time * 0.03) % 1;
        (magicCircle.dash2.material as any).dashOffset = (-time * 0.02) % 1;

        // オービターの周回動作
        for (const orbiter of magicCircle.orbiters) {
          orbiter.a += orbiter.v * 0.01;
          orbiter.s.position.set(
            Math.cos(orbiter.a) * orbiter.r,
            Math.sin(orbiter.a) * orbiter.r,
            0.02
          );
        }

        // カメラの微細な動き
        if (cameraRef.current) {
          cameraRef.current.position.x = Math.sin(time * 0.05) * 0.03;
          cameraRef.current.position.y = Math.sin(time * 0.08) * 0.02;
        }

        // レンダリング
        renderer.render(scene, camera);
      };

      console.log("ThreeBackground: Starting Advanced Magic Circle animation");
      animate();

      // ウィンドウリサイズ対応
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h, false);
          // ネビュラの解像度更新
          nebulaUniforms.u_resolution.value.set(w, h);
        }
      };

      window.addEventListener('resize', handleResize);
    } catch (error) {
      console.error("ThreeBackground: Error during initialization:", error);
    }

    // クリーンアップ
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [backgroundType]); // backgroundTypeが変わったら再初期化

  // PixiJS初期化用Effect - Octopath Traveler風HD-2D背景
  useEffect(() => {
    if (backgroundType !== "pixijs") {
      return;
    }
    if (!mountRef.current) return;

    console.log("PixiJS: ころころかえます背景 starting...");

    let app: PIXI.Application | null = null;
    let frameId: number | undefined;

    const initPixi = async () => {
      try {
        // PixiJS v8対応: 正しいinit()方法
        app = new PIXI.Application();
        await app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: 0x0E0F13, // テーマ統一（16進数で指定）
          antialias: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          autoDensity: true,
        });

        if (mountRef.current && app.canvas) {
          mountRef.current.appendChild(app.canvas);
          console.log("PixiJS: Canvas mounted");
        } else {
          console.error("PixiJS: Mount ref or app.canvas not available");
          return;
        }

        // === Octopath Traveler風HD-2D要素 ===

        // 1. 奥行きのある背景グラデーション（大地のイメージ）
        const bgGradient = new PIXI.Graphics();
        bgGradient.rect(0, 0, app.screen.width, app.screen.height);
        bgGradient.fill({
          color: 0x1a1b2e,
          alpha: 1,
        });
        app.stage.addChild(bgGradient);

        // 2. 遠景の山々（シルエット）
        const mountains = new PIXI.Graphics();
        mountains.moveTo(0, app.screen.height * 0.7);
        for (let i = 0; i <= app.screen.width; i += 100) {
          const height = app.screen.height * (0.7 + Math.sin(i * 0.01) * 0.15);
          mountains.lineTo(i, height);
        }
        mountains.lineTo(app.screen.width, app.screen.height);
        mountains.lineTo(0, app.screen.height);
        mountains.fill({
          color: 0x2d1b4e,
          alpha: 0.8,
        });
        app.stage.addChild(mountains);

        // 3. 浮遊する光の粒子（ドラクエ風マジックパーティクル）
        interface ParticleData {
          particle: PIXI.Graphics;
          vx: number;
          vy: number;
          life: number;
        }

        // 安全な色の配列（ドラクエ風の金色系）
        const safeColors = [
          0xffd700, // 金色
          0xffdc00, // 明るい金色
          0xffc700, // 濃い金色
          0xffed4a, // 黄金色
          0xfff176, // ライトゴールド
          0xffb300, // オレンジゴールド
        ];

        const particles: ParticleData[] = [];
        for (let i = 0; i < 30; i++) {
          const particle = new PIXI.Graphics();
          particle.circle(0, 0, Math.random() * 2 + 1);
          particle.fill({
            color: safeColors[Math.floor(Math.random() * safeColors.length)], // 安全な色から選択
            alpha: Math.random() * 0.6 + 0.2,
          });

          particle.x = Math.random() * app.screen.width;
          particle.y = Math.random() * app.screen.height;

          const particleData: ParticleData = {
            particle,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.3,
            life: Math.random() * 2 + 1,
          };

          particles.push(particleData);
          app.stage.addChild(particle);
        }

        // 4. 前景の草原（ドット風テクスチャ）
        const foreground = new PIXI.Graphics();
        foreground.rect(0, app.screen.height * 0.85, app.screen.width, app.screen.height * 0.15);
        foreground.fill({
          color: 0x1e4d2b,
          alpha: 0.7,
        });
        app.stage.addChild(foreground);

        // 5. アニメーションループ - パフォーマンス最適化版
        let lastTime = 0;
        const targetFPS = 60;
        const frameInterval = 1000 / targetFPS;

        const animate = (currentTime: number) => {
          // フレームレート調整
          if (currentTime - lastTime < frameInterval) {
            frameId = requestAnimationFrame(animate);
            return;
          }
          lastTime = currentTime;

          // アプリケーションが破棄されていたら停止
          if (!app || !app.stage) {
            return;
          }

          // 光の粒子アニメーション
          particles.forEach(data => {
            const { particle, vx, vy, life } = data;
            particle.x += vx;
            particle.y += vy;

            // 画面外に出たら反対側から再出現
            if (particle.x > app!.screen.width) particle.x = -10;
            if (particle.x < -10) particle.x = app!.screen.width;
            if (particle.y > app!.screen.height) particle.y = -10;
            if (particle.y < -10) particle.y = app!.screen.height;

            // 明滅効果（最適化済み）
            particle.alpha = Math.sin(currentTime * 0.001 * life) * 0.3 + 0.4;
          });

          frameId = requestAnimationFrame(animate);
        };

        animate(performance.now());
        console.log("PixiJS: ころころかえます animation started ｗｗ");

      } catch (error) {
        console.error("PixiJS: Initialization error:", error);
        // 初期化失敗時は app を null に設定
        if (app && app.stage) {
          try {
            app.destroy();
          } catch (e) {
            // 破棄エラーは無視
          }
        }
        app = null;

        // エラー時はフォールバック背景を表示（テキストなし）
        if (mountRef.current) {
          mountRef.current.style.backgroundColor = '#0E0F13';
        }
      }
    };

    initPixi();

    // リサイズ対応 - PixiJS v8対応
    const handleResize = () => {
      try {
        if (app && app.stage && app.renderer) {
          app.renderer.resize(window.innerWidth, window.innerHeight);
        }
      } catch (error) {
        console.warn("PixiJS: Resize error:", error);
      }
    };

    window.addEventListener('resize', handleResize);

    // クリーンアップ - ベストプラクティス準拠
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      if (app && app.stage) {
        try {
          app.destroy();
        } catch (e) {
          console.warn("PixiJS: Destroy error (safe to ignore):", e);
        }
      }
      // DOMのクリーンアップ
      // mountRef.currentの完全クリア
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
        mountRef.current.style.backgroundColor = '';
      }
      console.log("PixiJS: ころころかえます cleaned up ｗｗ");
    };
  }, [backgroundType]);

  // 豪華版が選択された場合は専用コンポーネントを使用
  if (backgroundType === "three3d_advanced") {
    return <ThreeBackgroundAdvanced className={className} />;
  }

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0, // BASEレベル（UI要素の直下）
        pointerEvents: 'none', // マウスイベントを通す
        // CSS背景（cssモード時）- テーマトークン統一
        background: backgroundType === "css" ? 'var(--chakra-colors-bg-canvas)' : backgroundType === "pixijs" ? 'var(--chakra-colors-bg-canvas)' : 'transparent',
      }}
    >
      {/* PixiJS キャンバスはuseEffect内で動的に追加されます */}
    </div>
  );
}