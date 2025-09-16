[17:35:57.693] Running build in Washington, D.C., USA (East) – iad1
[17:35:57.693] Build machine configuration: 2 cores, 8 GB
[17:35:57.715] Cloning github.com/riffluv/ito (Branch: master, Commit: 8a8491c)
[17:36:03.411] Cloning completed: 5.696s
[17:36:03.588] Restored build cache from previous deployment (CVgA1bFNYb9KFZ4SL2dwdhK2cz6s)
[17:36:04.744] Running "vercel build"
[17:36:05.133] Vercel CLI 47.1.1
[17:36:05.515] Installing dependencies...
[17:36:08.865] 
[17:36:08.865] > online-ito@0.1.0 prepare
[17:36:08.866] > npm run chakra:typegen
[17:36:08.866] 
[17:36:09.089] 
[17:36:09.089] > online-ito@0.1.0 chakra:typegen
[17:36:09.090] > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
[17:36:09.090] 
[17:36:11.766] [90m┌[39m  Chakra CLI ⚡️
[17:36:12.580] [?25l[90m│[39m
[17:36:12.667] [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
[17:36:12.669] [?25h[?25l[90m│[39m
[17:36:13.087] [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
[17:36:13.089] [?25h[?25l[90m│[39m
[17:36:13.164] [32m◇[39m  ✅ Generated utility typings
[17:36:13.165] [?25h[?25l[90m│[39m
[17:36:13.241] [32m◇[39m  ✅ Generated token typings
[17:36:13.242] [?25h[?25l[90m│[39m
[17:36:13.618] [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
[17:36:13.627] [?25h[90m│[39m
[17:36:13.629] [90m└[39m  🎉 Done!
[17:36:13.629] 
[17:36:13.686] 
[17:36:13.687] up to date in 8s
[17:36:13.687] 
[17:36:13.687] 298 packages are looking for funding
[17:36:13.690]   run `npm fund` for details
[17:36:13.721] Detected Next.js version: 14.2.5
[17:36:13.730] Running "npm run build"
[17:36:13.838] 
[17:36:13.839] > online-ito@0.1.0 build
[17:36:13.841] > next build
[17:36:13.842] 
[17:36:14.534]   ▲ Next.js 14.2.5
[17:36:14.535] 
[17:36:14.606]    Creating an optimized production build ...
[17:36:26.749]  ✓ Compiled successfully
[17:36:26.750]    Skipping linting
[17:36:26.751]    Checking validity of types ...
[17:36:41.772] Failed to compile.
[17:36:41.772] 
[17:36:41.773] ./components/ui/AppCard.tsx:27:7
[17:36:41.773] Type error: ',' expected.
[17:36:41.773] 
[17:36:41.774] [0m [90m 25 |[39m     [33m...[39m(selected [33m&&[39m {[0m
[17:36:41.774] [0m [90m 26 |[39m       boxShadow[33m:[39m [32m"4px 4px 0 rgba(59, 130, 246, 0.8), 8px 8px 0 rgba(59, 130, 246, 0.6),"[39m[0m
[17:36:41.774] [0m[31m[1m>[22m[39m[90m 27 |[39m       bg[33m:[39m [32m"blue.50"[39m[33m,[39m[0m
[17:36:41.774] [0m [90m    |[39m       [31m[1m^[22m[39m[0m
[17:36:41.775] [0m [90m 28 |[39m     })[33m,[39m[0m
[17:36:41.775] [0m [90m 29 |[39m   }[0m
[17:36:41.775] [0m [90m 30 |[39m   [0m
[17:36:41.892] Error: Command "npm run build" exited with 1