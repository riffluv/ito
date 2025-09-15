"use client";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface HD2DBackgroundProps {
  className?: string;
}

export function HD2DBackground({ className }: HD2DBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const [backgroundType, setBackgroundType] = useState<"css" | "light3d" | "rich3d">("css");

  // LocalStorageから設定読み込み & イベントリスナー設定
  useEffect(() => {
    // 初期設定読み込み
    const loadBackgroundType = () => {
      try {
        const saved = localStorage.getItem("backgroundType");
        if (saved && ["css", "light3d", "rich3d"].includes(saved)) {
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
    // CSS背景の場合はThree.jsを初期化しない
    if (backgroundType === "css") {
      return;
    }
    if (!mountRef.current) return;

    console.log("HD2DBackground: Starting initialization...");

    try {
      // シーン初期化
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      console.log("HD2DBackground: Scene created");

      // カメラ設定（HD-2D風の視点）
      const camera = new THREE.PerspectiveCamera(
        35, // FOV - オクトパス風の広角
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.set(0, 2, 10); // より近い位置から開始
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;
      console.log("HD2DBackground: Camera positioned at", camera.position);

      // レンダラー設定
      const renderer = new THREE.WebGLRenderer({
        antialias: false, // ピクセルアート風にアンチエイリアス無効
        alpha: false // デバッグのためalpha無効にして背景色を確実に表示
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x0f0a1a, 1); // 深い紫の夜空
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      console.log("HD2DBackground: HD-2D renderer configured");

      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
      console.log("HD2DBackground: Canvas mounted to DOM");

      // ===== 上品な動的背景システム =====

      // 1. 美しいグラデーション背景
      const createElegantGradient = () => {
        const skyGeometry = new THREE.PlaneGeometry(120, 80);
        const skyMaterial = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
              // ドラクエ風の落ち着いた色合い
              vec3 deepBlue = vec3(0.08, 0.06, 0.20);     // 深い青
              vec3 warmPurple = vec3(0.18, 0.12, 0.28);   // 暖かい紫
              vec3 darkBrown = vec3(0.12, 0.08, 0.06);    // ダークブラウン（下部）

              // 縦方向のグラデーション
              float gradientY = smoothstep(0.0, 1.0, vUv.y);
              vec3 baseGradient = mix(darkBrown, deepBlue, gradientY);
              baseGradient = mix(baseGradient, warmPurple, gradientY * 0.7);

              // 微細な波動効果（非常に控えめ）
              float wave = sin(vUv.x * 8.0 + time * 0.5) * sin(vUv.y * 6.0 + time * 0.3) * 0.02;
              baseGradient += wave;

              // 極めて控えめな星のきらめき
              float stars = sin(vUv.x * 40.0 + time * 0.8) * sin(vUv.y * 30.0 + time * 0.6) * 0.008;
              if (stars > 0.005) {
                baseGradient += vec3(0.02, 0.02, 0.03);
              }

              gl_FragColor = vec4(baseGradient, 1.0);
            }
          `,
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        sky.position.set(0, 0, -50);
        scene.add(sky);
        return { sky, skyMaterial };
      };

      // 2. 控えめなパーティクル（少数精鋭）
      const createSubtleParticles = () => {
        // 背景タイプに応じてパーティクル数を調整
        const particleCount = backgroundType === "light3d" ? 30 : 60;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 100;    // x
          positions[i * 3 + 1] = Math.random() * 60 - 20;   // y
          positions[i * 3 + 2] = (Math.random() - 0.5) * 60; // z

          // ドラクエ風の色合い（青と金）
          const isGold = Math.random() < 0.3;
          const color = isGold
            ? new THREE.Color(0.8, 0.7, 0.4)  // 落ち着いたゴールド
            : new THREE.Color(0.4, 0.5, 0.8); // 落ち着いたブルー

          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;

          velocities[i * 3] = (Math.random() - 0.5) * 0.01;     // x velocity (さらに控えめ)
          velocities[i * 3 + 1] = Math.random() * 0.02 + 0.005; // y velocity (ゆっくり上昇)
          velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01; // z velocity
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        const particleMaterial = new THREE.PointsMaterial({
          size: 0.2, // さらに小さく
          transparent: true,
          opacity: 0.6, // より透明に
          vertexColors: true,
          blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particles, particleMaterial);
        scene.add(particleSystem);
        return particleSystem;
      };

      // 3. シンプルな環境光のみ
      const setupSubtleLighting = () => {
        const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
        scene.add(ambientLight);
      };

      // シーン構築（シンプル版）
      const { sky, skyMaterial } = createElegantGradient();
      const subtleParticles = createSubtleParticles();
      setupSubtleLighting();

      console.log("HD2DBackground: HD-2D magical world created");

      // 最初に一度レンダリングしてシーンが見えるかテスト
      console.log("HD2DBackground: Performing initial render");
      renderer.render(scene, camera);
      console.log("HD2DBackground: Initial render completed");

      // 上品でスムーズなアニメーションループ
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        // グラデーション背景の時間アニメーション
        skyMaterial.uniforms.time.value = time;

        // 控えめなパーティクルアニメーション
        const particlePositions = subtleParticles.geometry.attributes.position.array;
        const velocities = subtleParticles.geometry.attributes.velocity.array;

        for (let i = 0; i < particlePositions.length; i += 3) {
          particlePositions[i] += velocities[i];         // x
          particlePositions[i + 1] += velocities[i + 1]; // y
          particlePositions[i + 2] += velocities[i + 2]; // z

          // パーティクルが上に浮上しすぎたらリセット
          if (particlePositions[i + 1] > 40) {
            particlePositions[i + 1] = -20;
            particlePositions[i] = (Math.random() - 0.5) * 100;
            particlePositions[i + 2] = (Math.random() - 0.5) * 60;
          }

          // 境界でラップ
          if (Math.abs(particlePositions[i]) > 50) {
            particlePositions[i] = -particlePositions[i];
          }
          if (Math.abs(particlePositions[i + 2]) > 30) {
            particlePositions[i + 2] = -particlePositions[i + 2];
          }
        }
        subtleParticles.geometry.attributes.position.needsUpdate = true;

        // カメラのごく微細な動き（ほとんど気づかないレベル）
        if (cameraRef.current) {
          cameraRef.current.position.x = Math.sin(time * 0.05) * 0.03;
          cameraRef.current.position.y = 2 + Math.sin(time * 0.08) * 0.02;
        }

        // レンダリング
        renderer.render(scene, camera);
      };

      console.log("HD2DBackground: Starting HD-2D magical animation");
      animate();
    } catch (error) {
      console.error("HD2DBackground: Error during initialization:", error);
    }

    // ウィンドウリサイズ対応
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
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
        // CSS背景（cssモード時）- リッチブラック
        background: backgroundType === "css" ? `
          linear-gradient(135deg, rgba(139, 69, 19, 0.12) 0%, rgba(101, 67, 33, 0.06) 35%, transparent 70%),
          linear-gradient(45deg, rgba(47, 27, 12, 0.08) 0%, transparent 50%, rgba(160, 82, 45, 0.04) 100%),
          radial-gradient(ellipse 70% 50% at 30% 70%, rgba(139, 69, 19, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse 50% 30% at 70% 30%, rgba(218, 165, 32, 0.06) 0%, transparent 40%),
          radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.02) 1px, transparent 0),
          radial-gradient(circle at 10px 6px, rgba(139, 69, 19, 0.03) 0.8px, transparent 0),
          #1a1b2e
        ` : 'transparent',
      }}
    />
  );
}