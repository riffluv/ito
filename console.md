[03:21:44.136] Running build in Washington, D.C., USA (East) – iad1
[03:21:44.137] Build machine configuration: 2 cores, 8 GB
[03:21:44.159] Cloning github.com/riffluv/ito (Branch: master, Commit: 056846a)
[03:21:55.530] Cloning completed: 11.370s
[03:21:55.840] Restored build cache from previous deployment (J6n5XAkBtKpzoUbQpQQhYDPzkH4G)
[03:21:57.375] Running "vercel build"
[03:21:57.776] Vercel CLI 47.1.1
[03:21:58.163] Installing dependencies...
[03:22:03.202] 
[03:22:03.202] > online-ito@0.1.0 prepare
[03:22:03.202] > npm run chakra:typegen
[03:22:03.203] 
[03:22:03.339] 
[03:22:03.339] > online-ito@0.1.0 chakra:typegen
[03:22:03.339] > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
[03:22:03.340] 
[03:22:06.041] [90m┌[39m  Chakra CLI ⚡️
[03:22:06.858] [?25l[90m│[39m
[03:22:06.947] [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
[03:22:06.949] [?25h[?25l[90m│[39m
[03:22:07.289] [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
[03:22:07.290] [?25h[?25l[90m│[39m
[03:22:07.391] [35m◒[39m  Generating utility types[999D[J[32m◇[39m  ✅ Generated utility typings
[03:22:07.392] [?25h[?25l[90m│[39m
[03:22:07.483] [35m◒[39m  Generating token types[999D[J[32m◇[39m  ✅ Generated token typings
[03:22:07.483] [?25h[?25l[90m│[39m
[03:22:07.773] [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
[03:22:07.773] [?25h[90m│[39m
[03:22:07.773] [90m└[39m  🎉 Done!
[03:22:07.774] 
[03:22:07.839] 
[03:22:07.839] added 12 packages in 9s
[03:22:07.839] 
[03:22:07.839] 298 packages are looking for funding
[03:22:07.840]   run `npm fund` for details
[03:22:07.874] Detected Next.js version: 14.2.5
[03:22:07.883] Running "npm run build"
[03:22:07.991] 
[03:22:07.991] > online-ito@0.1.0 build
[03:22:07.992] > next build
[03:22:07.992] 
[03:22:08.668]   ▲ Next.js 14.2.5
[03:22:08.669] 
[03:22:08.728]    Creating an optimized production build ...
[03:22:48.719]  ✓ Compiled successfully
[03:22:48.720]    Skipping linting
[03:22:48.720]    Checking validity of types ...
[03:23:03.694] Failed to compile.
[03:23:03.694] 
[03:23:03.696] ./components/ui/ThreeBackground.tsx:99:19
[03:23:03.696] Type error: 'ctx' is possibly 'null'.
[03:23:03.696] 
[03:23:03.697] [0m [90m  97 |[39m         canvas[33m.[39mwidth [33m=[39m canvas[33m.[39mheight [33m=[39m size[33m;[39m[0m
[03:23:03.697] [0m [90m  98 |[39m         [36mconst[39m ctx [33m=[39m canvas[33m.[39mgetContext([32m'2d'[39m)[33m;[39m[0m
[03:23:03.697] [0m[31m[1m>[22m[39m[90m  99 |[39m         [36mconst[39m g [33m=[39m ctx[33m.[39mcreateRadialGradient(size[33m/[39m[35m2[39m[33m,[39m size[33m/[39m[35m2[39m[33m,[39m [35m0[39m[33m,[39m size[33m/[39m[35m2[39m[33m,[39m size[33m/[39m[35m2[39m[33m,[39m size[33m/[39m[35m2[39m)[33m;[39m[0m
[03:23:03.698] [0m [90m     |[39m                   [31m[1m^[22m[39m[0m
[03:23:03.698] [0m [90m 100 |[39m         g[33m.[39maddColorStop([35m0[39m[33m,[39m [32m'rgba(255,255,255,1)'[39m)[33m;[39m[0m
[03:23:03.698] [0m [90m 101 |[39m         g[33m.[39maddColorStop([35m0.35[39m[33m,[39m [32m'rgba(255,255,255,0.8)'[39m)[33m;[39m[0m
[03:23:03.699] [0m [90m 102 |[39m         g[33m.[39maddColorStop([35m1[39m[33m,[39m [32m'rgba(255,255,255,0)'[39m)[33m;[39m[0m
[03:23:03.834] Error: Command "npm run build" exited with 1