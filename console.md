18:59:30.654 Running build in Washington, D.C., USA (East) – iad1
18:59:30.655 Build machine configuration: 2 cores, 8 GB
18:59:30.678 Cloning github.com/riffluv/ito (Branch: master, Commit: 5e7eaa4)
18:59:39.200 Cloning completed: 8.522s
18:59:39.562 Restored build cache from previous deployment (Cc3V9tUh28WGoHg5nbDwGW8hZSuJ)
18:59:40.625 Running "vercel build"
18:59:41.515 Vercel CLI 48.0.2
18:59:42.142 Installing dependencies...
18:59:45.111 
18:59:45.112 > online-ito@0.1.0 prepare
18:59:45.112 > npm run chakra:typegen
18:59:45.113 
18:59:45.357 
18:59:45.358 > online-ito@0.1.0 chakra:typegen
18:59:45.359 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
18:59:45.359 
18:59:48.222 [90m┌[39m  Chakra CLI ⚡️
18:59:48.992 [?25l[90m│[39m
18:59:49.080 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
18:59:49.081 [?25h[?25l[90m│[39m
18:59:49.461 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
18:59:49.463 [?25h[?25l[90m│[39m
18:59:49.535 [32m◇[39m  ✅ Generated utility typings
18:59:49.535 [?25h[?25l[90m│[39m
18:59:49.614 [32m◇[39m  ✅ Generated token typings
18:59:49.615 [?25h[?25l[90m│[39m
18:59:49.947 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
18:59:49.949 [?25h[90m│[39m
18:59:49.956 [90m└[39m  🎉 Done!
18:59:49.957 
18:59:50.011 
18:59:50.011 up to date in 8s
18:59:50.013 
18:59:50.013 299 packages are looking for funding
18:59:50.013   run `npm fund` for details
18:59:50.045 Detected Next.js version: 14.2.5
18:59:50.054 Running "npm run build"
18:59:50.158 
18:59:50.159 > online-ito@0.1.0 build
18:59:50.159 > next build
18:59:50.159 
18:59:50.807   ▲ Next.js 14.2.5
18:59:50.808 
18:59:50.877    Creating an optimized production build ...
19:00:07.452  ✓ Compiled successfully
19:00:07.454    Skipping linting
19:00:07.454    Checking validity of types ...
19:00:22.888 Failed to compile.
19:00:22.889 
19:00:22.889 ./hooks/useReducedMotionPreference.ts:11:26
19:00:22.895 Type error: Property 'forceAnimations' does not exist on type 'AnimationSettings'.
19:00:22.895 
19:00:22.895 [0m [90m  9 |[39m[0m
19:00:22.895 [0m [90m 10 |[39m [36mexport[39m [36mfunction[39m useReducedMotionPreference(options[33m?[39m[33m:[39m [33mReducedMotionOptions[39m) {[0m
19:00:22.895 [0m[31m[1m>[22m[39m[90m 11 |[39m   [36mconst[39m { reducedMotion[33m,[39m forceAnimations } [33m=[39m useAnimationSettings()[33m;[39m[0m
19:00:22.896 [0m [90m    |[39m                          [31m[1m^[22m[39m[0m
19:00:22.896 [0m [90m 12 |[39m   [36mconst[39m target [33m=[39m useMemo(() [33m=>[39m {[0m
19:00:22.896 [0m [90m 13 |[39m     [36mif[39m (options[33m?[39m[33m.[39mforce) {[0m
19:00:22.896 [0m [90m 14 |[39m       [36mreturn[39m forceAnimations [33m?[39m [36mfalse[39m [33m:[39m reducedMotion[33m;[39m[0m
19:00:23.030 Error: Command "npm run build" exited with 1