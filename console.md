15:55:15.106 Running build in Washington, D.C., USA (East) – iad1
15:55:15.106 Build machine configuration: 2 cores, 8 GB
15:55:15.128 Cloning github.com/riffluv/ito (Branch: master, Commit: e744709)
15:55:19.735 Cloning completed: 4.606s
15:55:20.030 Restored build cache from previous deployment (HFXY9z5ugx2F9HUKiADHQr5cUcMi)
15:55:21.190 Running "vercel build"
15:55:21.575 Vercel CLI 48.1.6
15:55:21.963 Installing dependencies...
15:55:24.997 
15:55:24.998 > online-ito@0.1.0 prepare
15:55:24.998 > npm run chakra:typegen
15:55:24.998 
15:55:25.140 
15:55:25.140 > online-ito@0.1.0 chakra:typegen
15:55:25.140 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
15:55:25.140 
15:55:27.564 [90m┌[39m  Chakra CLI ⚡️
15:55:28.365 [?25l[90m│[39m
15:55:28.454 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
15:55:28.455 [?25h[?25l[90m│[39m
15:55:28.792 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
15:55:28.793 [?25h[?25l[90m│[39m
15:55:28.928 [35m◒[39m  Generating utility types[999D[J[32m◇[39m  ✅ Generated utility typings
15:55:28.929 [?25h[?25l[90m│[39m
15:55:29.006 [32m◇[39m  ✅ Generated token typings
15:55:29.007 [?25h[?25l[90m│[39m
15:55:29.354 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
15:55:29.355 [?25h[90m│[39m
15:55:29.355 [90m└[39m  🎉 Done!
15:55:29.356 
15:55:29.420 
15:55:29.421 up to date in 7s
15:55:29.421 
15:55:29.421 299 packages are looking for funding
15:55:29.421   run `npm fund` for details
15:55:29.454 Detected Next.js version: 14.2.5
15:55:29.464 Running "npm run build"
15:55:29.571 
15:55:29.571 > online-ito@0.1.0 build
15:55:29.572 > next build
15:55:29.572 
15:55:30.265   ▲ Next.js 14.2.5
15:55:30.266 
15:55:30.338    Creating an optimized production build ...
15:55:47.904  ✓ Compiled successfully
15:55:47.906    Skipping linting
15:55:47.907    Checking validity of types ...
15:56:04.075 Failed to compile.
15:56:04.075 
15:56:04.076 ./components/CreateRoomModal.tsx:108:18
15:56:04.076 Type error: The operand of a 'delete' operator must be optional.
15:56:04.076 
15:56:04.076 [0m [90m 106 |[39m           console[33m.[39mwarn([32m"[rooms] create-room without creator fields (fallback)"[39m[33m,[39m error)[33m;[39m[0m
15:56:04.077 [0m [90m 107 |[39m           [36mconst[39m fallbackPayload [33m=[39m { [33m...[39mbaseRoomData }[33m;[39m[0m
15:56:04.077 [0m[31m[1m>[22m[39m[90m 108 |[39m           [36mdelete[39m fallbackPayload[33m.[39mcreatorId[33m;[39m[0m
15:56:04.077 [0m [90m     |[39m                  [31m[1m^[22m[39m[0m
15:56:04.077 [0m [90m 109 |[39m           [36mdelete[39m fallbackPayload[33m.[39mcreatorName[33m;[39m[0m
15:56:04.077 [0m [90m 110 |[39m           roomRef [33m=[39m [36mawait[39m addDoc(collection(db[33m![39m[33m,[39m [32m"rooms"[39m)[33m,[39m fallbackPayload)[33m;[39m[0m
15:56:04.077 [0m [90m 111 |[39m         } [36melse[39m {[0m
15:56:04.218 Error: Command "npm run build" exited with 1