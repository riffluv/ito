01:19:50.530 Running build in Washington, D.C., USA (East) – iad1
01:19:50.530 Build machine configuration: 2 cores, 8 GB
01:19:50.546 Cloning github.com/riffluv/ito (Branch: master, Commit: be5d37d)
01:19:57.112 Cloning completed: 6.565s
01:19:57.298 Restored build cache from previous deployment (4uZehu4DuqPdyVs317vQBevJNS3q)
01:19:58.483 Running "vercel build"
01:19:58.860 Vercel CLI 48.1.1
01:19:59.266 Installing dependencies...
01:20:02.878 
01:20:02.879 > online-ito@0.1.0 prepare
01:20:02.879 > npm run chakra:typegen
01:20:02.880 
01:20:03.016 
01:20:03.017 > online-ito@0.1.0 chakra:typegen
01:20:03.017 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
01:20:03.018 
01:20:05.640 [90m┌[39m  Chakra CLI ⚡️
01:20:06.499 [?25l[90m│[39m
01:20:06.608 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
01:20:06.609 [?25h[?25l[90m│[39m
01:20:06.982 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
01:20:06.984 [?25h[?25l[90m│[39m
01:20:07.085 [35m◒[39m  Generating utility types[999D[J[32m◇[39m  ✅ Generated utility typings
01:20:07.085 [?25h[?25l[90m│[39m
01:20:07.204 [35m◒[39m  Generating token types[999D[J[32m◇[39m  ✅ Generated token typings
01:20:07.205 [?25h[?25l[90m│[39m
01:20:07.513 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
01:20:07.519 [?25h[90m│[39m
01:20:07.520 [90m└[39m  🎉 Done!
01:20:07.520 
01:20:07.578 
01:20:07.579 up to date in 8s
01:20:07.579 
01:20:07.580 299 packages are looking for funding
01:20:07.580   run `npm fund` for details
01:20:07.611 Detected Next.js version: 14.2.5
01:20:07.620 Running "npm run build"
01:20:07.729 
01:20:07.729 > online-ito@0.1.0 build
01:20:07.729 > next build
01:20:07.729 
01:20:08.395   ▲ Next.js 14.2.5
01:20:08.396 
01:20:08.471    Creating an optimized production build ...
01:20:24.905  ✓ Compiled successfully
01:20:24.907    Skipping linting
01:20:24.908    Checking validity of types ...
01:20:41.062 Failed to compile.
01:20:41.063 
01:20:41.063 ./lib/firebase/rooms.ts:112:42
01:20:41.063 Type error: Argument of type 'CollectionReference<DocumentData, DocumentData>' is not assignable to parameter of type 'DocumentReference<DocumentData, DocumentData>'.
01:20:41.063   Types of property 'type' are incompatible.
01:20:41.063     Type '"collection"' is not assignable to type '"document"'.
01:20:41.063 
01:20:41.063 [0m [90m 110 |[39m[0m
01:20:41.063 [0m [90m 111 |[39m         [36mconst[39m playersRef [33m=[39m collection(db[33m![39m[33m,[39m [32m"rooms"[39m[33m,[39m roomId[33m,[39m [32m"players"[39m)[33m;[39m[0m
01:20:41.064 [0m[31m[1m>[22m[39m[90m 112 |[39m         [36mconst[39m playersSnap [33m=[39m [36mawait[39m tx[33m.[39m[36mget[39m(playersRef)[33m;[39m[0m
01:20:41.064 [0m [90m     |[39m                                          [31m[1m^[22m[39m[0m
01:20:41.064 [0m [90m 113 |[39m         [36mconst[39m playerDocs [33m=[39m playersSnap[33m.[39mdocs[33m;[39m[0m
01:20:41.064 [0m [90m 114 |[39m         remainingCount [33m=[39m playerDocs[33m.[39mlength[33m;[39m[0m
01:20:41.064 [0m [90m 115 |[39m[0m
01:20:41.192 Error: Command "npm run build" exited with 1