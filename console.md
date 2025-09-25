16:03:42.595 Running build in Washington, D.C., USA (East) – iad1
16:03:42.595 Build machine configuration: 2 cores, 8 GB
16:03:42.608 Cloning github.com/riffluv/ito (Branch: master, Commit: ab547cc)
16:03:47.729 Cloning completed: 5.121s
16:03:47.929 Restored build cache from previous deployment (HFXY9z5ugx2F9HUKiADHQr5cUcMi)
16:03:49.039 Running "vercel build"
16:03:49.426 Vercel CLI 48.1.6
16:03:49.814 Installing dependencies...
16:03:52.886 
16:03:52.886 > online-ito@0.1.0 prepare
16:03:52.887 > npm run chakra:typegen
16:03:52.887 
16:03:53.024 
16:03:53.025 > online-ito@0.1.0 chakra:typegen
16:03:53.026 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
16:03:53.026 
16:03:55.607 [90m┌[39m  Chakra CLI ⚡️
16:03:56.409 [?25l[90m│[39m
16:03:56.500 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
16:03:56.500 [?25h[?25l[90m│[39m
16:03:56.889 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
16:03:56.890 [?25h[?25l[90m│[39m
16:03:56.977 [35m◒[39m  Generating utility types[999D[J[32m◇[39m  ✅ Generated utility typings
16:03:56.978 [?25h[?25l[90m│[39m
16:03:57.076 [35m◒[39m  Generating token types[999D[J[32m◇[39m  ✅ Generated token typings
16:03:57.076 [?25h[?25l[90m│[39m
16:03:57.384 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
16:03:57.389 [?25h[90m│[39m
16:03:57.390 [90m└[39m  🎉 Done!
16:03:57.390 
16:03:57.450 
16:03:57.450 up to date in 7s
16:03:57.451 
16:03:57.452 299 packages are looking for funding
16:03:57.452   run `npm fund` for details
16:03:57.484 Detected Next.js version: 14.2.5
16:03:57.494 Running "npm run build"
16:03:57.603 
16:03:57.604 > online-ito@0.1.0 build
16:03:57.604 > next build
16:03:57.604 
16:03:58.370   ▲ Next.js 14.2.5
16:03:58.371 
16:03:58.444    Creating an optimized production build ...
16:04:16.289  ✓ Compiled successfully
16:04:16.290    Skipping linting
16:04:16.291    Checking validity of types ...
16:04:32.187 Failed to compile.
16:04:32.188 
16:04:32.188 ./components/CreateRoomModal.tsx:108:11
16:04:32.188 Type error: Type 'undefined' is not assignable to type 'string'.
16:04:32.188 
16:04:32.188 [0m [90m 106 |[39m           console[33m.[39mwarn([32m"[rooms] create-room without creator fields (fallback)"[39m[33m,[39m error)[33m;[39m[0m
16:04:32.188 [0m [90m 107 |[39m           [36mconst[39m fallbackPayload [33m=[39m { [33m...[39mbaseRoomData }[33m;[39m[0m
16:04:32.189 [0m[31m[1m>[22m[39m[90m 108 |[39m           fallbackPayload[33m.[39mcreatorId [33m=[39m undefined[33m;[39m[0m
16:04:32.189 [0m [90m     |[39m           [31m[1m^[22m[39m[0m
16:04:32.189 [0m [90m 109 |[39m           fallbackPayload[33m.[39mcreatorName [33m=[39m undefined[33m;[39m[0m
16:04:32.189 [0m [90m 110 |[39m           roomRef [33m=[39m [36mawait[39m addDoc(collection(db[33m![39m[33m,[39m [32m"rooms"[39m)[33m,[39m fallbackPayload)[33m;[39m[0m
16:04:32.189 [0m [90m 111 |[39m         } [36melse[39m {[0m
16:04:32.323 Error: Command "npm run build" exited with 1