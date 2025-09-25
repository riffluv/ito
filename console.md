16:09:07.865 Running build in Washington, D.C., USA (East) – iad1
16:09:07.865 Build machine configuration: 2 cores, 8 GB
16:09:07.879 Cloning github.com/riffluv/ito (Branch: master, Commit: ad94dd0)
16:09:12.494 Cloning completed: 4.615s
16:09:12.709 Restored build cache from previous deployment (HFXY9z5ugx2F9HUKiADHQr5cUcMi)
16:09:13.772 Running "vercel build"
16:09:14.224 Vercel CLI 48.1.6
16:09:14.604 Installing dependencies...
16:09:18.194 
16:09:18.195 > online-ito@0.1.0 prepare
16:09:18.195 > npm run chakra:typegen
16:09:18.195 
16:09:18.357 
16:09:18.357 > online-ito@0.1.0 chakra:typegen
16:09:18.358 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
16:09:18.358 
16:09:21.015 [90m┌[39m  Chakra CLI ⚡️
16:09:21.753 [?25l[90m│[39m
16:09:21.835 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
16:09:21.836 [?25h[?25l[90m│[39m
16:09:22.187 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
16:09:22.189 [?25h[?25l[90m│[39m
16:09:22.269 [35m◒[39m  Generating utility types[999D[J[32m◇[39m  ✅ Generated utility typings
16:09:22.270 [?25h[?25l[90m│[39m
16:09:22.352 [35m◒[39m  Generating token types[999D[J[32m◇[39m  ✅ Generated token typings
16:09:22.352 [?25h[?25l[90m│[39m
16:09:22.646 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
16:09:22.646 [?25h[90m│[39m
16:09:22.646 [90m└[39m  🎉 Done!
16:09:22.646 
16:09:22.708 
16:09:22.709 up to date in 8s
16:09:22.709 
16:09:22.710 299 packages are looking for funding
16:09:22.710   run `npm fund` for details
16:09:22.741 Detected Next.js version: 14.2.5
16:09:22.749 Running "npm run build"
16:09:22.852 
16:09:22.852 > online-ito@0.1.0 build
16:09:22.855 > next build
16:09:22.855 
16:09:23.538   ▲ Next.js 14.2.5
16:09:23.539 
16:09:23.609    Creating an optimized production build ...
16:09:39.701  ✓ Compiled successfully
16:09:39.703    Skipping linting
16:09:39.703    Checking validity of types ...
16:09:54.025 Failed to compile.
16:09:54.025 
16:09:54.026 ./lib/firebase/rooms.ts:61:7
16:09:54.026 Type error: Type 'string | undefined' is not assignable to type 'string | null'.
16:09:54.026   Type 'undefined' is not assignable to type 'string | null'.
16:09:54.027 
16:09:54.027 [0m [90m 59 |[39m     [36mlet[39m token[33m:[39m string [33m|[39m [36mnull[39m [33m=[39m [36mnull[39m[33m;[39m[0m
16:09:54.027 [0m [90m 60 |[39m     [36mtry[39m {[0m
16:09:54.027 [0m[31m[1m>[22m[39m[90m 61 |[39m       token [33m=[39m [36mawait[39m auth[33m?[39m[33m.[39mcurrentUser[33m?[39m[33m.[39mgetIdToken([36mtrue[39m)[33m;[39m[0m
16:09:54.028 [0m [90m    |[39m       [31m[1m^[22m[39m[0m
16:09:54.028 [0m [90m 62 |[39m     } [36mcatch[39m (error) {[0m
16:09:54.028 [0m [90m 63 |[39m       logWarn([32m"rooms"[39m[33m,[39m [32m"leave-room-token-failed"[39m[33m,[39m error)[33m;[39m[0m
16:09:54.028 [0m [90m 64 |[39m     }[0m
16:09:54.151 Error: Command "npm run build" exited with 1