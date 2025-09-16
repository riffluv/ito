"use client";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeBackgroundAdvancedProps {
  className?: string;
}

export function ThreeBackgroundAdvanced({ className }: ThreeBackgroundAdvancedProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const frameRef = useRef<number>();
  const composerRef = useRef<any>();

  useEffect(() => {
    if (!mountRef.current) return;
    console.log("ThreeBackgroundAdvanced: Starting initialization...");

    let EffectComposer: any, RenderPass: any, UnrealBloomPass: any, ShaderPass: any, FXAAShader: any;

    const initAdvancedBackground = async () => {
      try {
        // 動的にポストプロセッシングをインポート
        const [
          { EffectComposer: EC },
          { RenderPass: RP },
          { UnrealBloomPass: UBP },
          { ShaderPass: SP },
          { FXAAShader: FXAA }
        ] = await Promise.all([
          import('three/examples/jsm/postprocessing/EffectComposer.js'),
          import('three/examples/jsm/postprocessing/RenderPass.js'),
          import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          import('three/examples/jsm/postprocessing/ShaderPass.js'),
          import('three/examples/jsm/shaders/FXAAShader.js')
        ]);

        EffectComposer = EC; RenderPass = RP; UnrealBloomPass = UBP; ShaderPass = SP; FXAAShader = FXAA;

        // シーン初期化
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // カメラ設定
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 0, 10);
        cameraRef.current = camera;

        // 高品質レンダラー設定
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.setClearColor(0x04020a, 1);

        rendererRef.current = renderer;
        if (mountRef.current) {
          mountRef.current.appendChild(renderer.domElement);
        }

        // 共通テクスチャ関数
        const makeCircleTexture = (size = 64): THREE.CanvasTexture => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return new THREE.CanvasTexture(canvas);

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

        // 1. ネビュラ（圧縮版シェーダー）
        const nebulaUniforms = {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        const nebulaMaterial = new THREE.ShaderMaterial({
          uniforms: nebulaUniforms,
          vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `,
          fragmentShader: `
            precision highp float;
            varying vec2 vUv;
            uniform float u_time;
            uniform vec2 u_resolution;
            vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
            vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
            vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
            float snoise(vec2 v){
              const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
              vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
              vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
              vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
              vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m *= m; m *= m;
              vec3 x = 2.0*fract(p*0.0243902439)-1.0; vec3 h = abs(x)-0.5; vec3 ox = floor(x+0.5); vec3 a0 = x-ox;
              m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
              vec3 g; g.x=a0.x*x0.x + h.x*x0.y; g.y=a0.y*x12.x + h.y*x12.y; g.z=a0.z*x12.z + h.z*x12.w;
              return 130.0*dot(m,g);
            }
            float fbm(vec2 st){
              float v=0.0; float a=0.55; mat2 rot=mat2(0.8,-0.6,0.6,0.8);
              for(int i=0;i<6;i++){ v+=a*snoise(st); st=rot*st*2.0+0.1; a*=0.55; }
              return v;
            }
            void main(){
              vec2 p = (vUv-0.5) * vec2(u_resolution.x/u_resolution.y, 1.0);
              float t = u_time*0.045; float n = fbm(p*1.2 + vec2(t,-t*0.6));
              vec3 colA=vec3(0.12,0.02,0.20), colB=vec3(0.71,0.45,1.00), colC=vec3(0.23,0.09,0.36);
              float glow = smoothstep(0.15,0.75,n*0.5+0.5);
              vec3 col = mix(colA, colC, glow); col = mix(col, colB, pow(max(n,0.0),2.0)*0.55);
              float r = length(p); col += 0.15*vec3(0.7,0.3,1.0)*smoothstep(0.8,0.0,r); col *= 1.0 - smoothstep(0.6,1.1,r);
              gl_FragColor = vec4(col,1.0);
            }
          `,
          depthWrite: false
        });

        const nebula = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), nebulaMaterial);
        nebula.position.z = -4.0;
        nebula.frustumCulled = false;
        scene.add(nebula);

        // 2. 高精細スターフィールド（個別瞬き）
        const starGeom = new THREE.BufferGeometry();
        const STAR_COUNT = 1400;
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
            attribute float phase; varying float vPhase;
            void main(){ vPhase = phase; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; float size = 1.2 * (300.0 / -mv.z); gl_PointSize = clamp(size, 1.0, 6.0); }
          `,
          fragmentShader: `
            precision highp float; varying float vPhase; uniform float u_time; uniform sampler2D u_tex;
            void main(){ vec2 uv = gl_PointCoord; vec4 s = texture2D(u_tex, uv); float tw = 0.6 + 0.4 * sin(u_time*2.2 + vPhase); gl_FragColor = vec4(s.rgb, s.a * tw); }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(starGeom, starMat);
        scene.add(stars);

        // 3. 高品質魔法陣システム
        const glyphGroup = new THREE.Group();
        scene.add(glyphGroup);

        const lineMat = new THREE.LineBasicMaterial({ color: 0xE7C8FF, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
        const thinMat = new THREE.LineBasicMaterial({ color: 0xC5A3FF, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
        const dashMat = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 0.22, gapSize: 0.12, scale: 1, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xB07BFF, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

        const circleGeometry = (r = 1, seg = 256) => new THREE.BufferGeometry().setFromPoints(Array.from({length: seg+1}, (_,i) => {
          const a = i/seg * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a)*r, Math.sin(a)*r, 0);
        }));

        const starPolygonGeometry = (n = 5, ro = 2, ri = 1) => new THREE.BufferGeometry().setFromPoints(Array.from({length: n*2+1}, (_,i) => {
          const r = (i%2===0) ? ro : ri;
          const a = i/(n*2) * Math.PI*2 - Math.PI/2;
          return new THREE.Vector3(Math.cos(a)*r, Math.sin(a)*r, 0);
        }));

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
        (dash2.material as any).dashSize = 0.28;
        (dash2.material as any).gapSize = 0.14;
        dash2.computeLineDistances();
        layerMid.add(dash2);

        // 五芒星
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

        // 4. ポストプロセッシング（豪華版の目玉！）
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // UnrealBloom - 魔法陣の発光効果
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.35, // strength
          0.9,  // radius
          0.6   // threshold
        );
        composer.addPass(bloomPass);

        // FXAA - アンチエイリアシング
        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.uniforms['resolution'].value.set(
          1/window.innerWidth,
          1/window.innerHeight
        );
        composer.addPass(fxaaPass);

        composerRef.current = composer;

        console.log("ThreeBackgroundAdvanced: 豪華版初期化完了！");

        // アニメーションループ
        const clock = new THREE.Clock();
        const animate = () => {
          frameRef.current = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          // ネビュラアニメーション
          nebulaUniforms.u_time.value = t;
          starUniforms.u_time.value = t;

          // 星の回転
          stars.rotation.y = t * 0.004;
          stars.rotation.x = Math.sin(t * 0.05) * 0.015;

          // 魔法陣の多層回転
          layerBack.rotation.z = t * 0.005;
          layerMid.rotation.z = -t * 0.007;
          layerFore.rotation.z = t * 0.010;

          // ダッシュラインの流れアニメーション
          (dash1.material as any).dashOffset = (t * 0.03) % 1;
          (dash2.material as any).dashOffset = (-t * 0.02) % 1;

          // オービターの周回
          for (const o of orbiters) {
            o.a += o.v * 0.01;
            o.s.position.set(Math.cos(o.a) * o.r, Math.sin(o.a) * o.r, 0.02);
          }

          // 高品質レンダリング（ポストプロセッシング）
          composer.render();
        };

        animate();

        // リサイズ対応
        const handleResize = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h, false);
          nebulaUniforms.u_resolution.value.set(w, h);
          composer.setSize(w, h);
          fxaaPass.material.uniforms['resolution'].value.set(1/w, 1/h);
          bloomPass.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

      } catch (error) {
        console.error("ThreeBackgroundAdvanced: 初期化エラー:", error);
      }
    };

    initAdvancedBackground();

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
      if (composerRef.current) {
        composerRef.current.dispose();
      }
    };
  }, []);

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
        zIndex: 0,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  );
}