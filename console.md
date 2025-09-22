15:35:10.456 Running build in Washington, D.C., USA (East) – iad1
15:35:10.457 Build machine configuration: 2 cores, 8 GB
15:35:10.474 Cloning github.com/riffluv/ito (Branch: master, Commit: f1eec78)
15:35:16.376 Cloning completed: 5.901s
15:35:16.536 Restored build cache from previous deployment (4CetNvjxqwoujd66F9pUqDnKnPsp)
15:35:17.668 Running "vercel build"
15:35:18.084 Vercel CLI 48.0.2
15:35:18.662 Installing dependencies...
15:35:21.817 
15:35:21.819 > online-ito@0.1.0 prepare
15:35:21.819 > npm run chakra:typegen
15:35:21.819 
15:35:21.954 
15:35:21.954 > online-ito@0.1.0 chakra:typegen
15:35:21.955 > npx @chakra-ui/cli typegen ./theme/index.ts --outdir types
15:35:21.955 
15:35:24.511 [90m┌[39m  Chakra CLI ⚡️
15:35:25.315 [?25l[90m│[39m
15:35:25.401 [35m◒[39m  Generating conditions types[999D[J[32m◇[39m  ✅ Generated conditions typings
15:35:25.402 [?25h[?25l[90m│[39m
15:35:25.743 [35m◒[39m  Generating recipe types[999D[J[32m◇[39m  ✅ Generated recipe typings
15:35:25.744 [?25h[?25l[90m│[39m
15:35:25.822 [32m◇[39m  ✅ Generated utility typings
15:35:25.822 [?25h[?25l[90m│[39m
15:35:25.901 [32m◇[39m  ✅ Generated token typings
15:35:25.903 [?25h[?25l[90m│[39m
15:35:26.214 [35m◒[39m  Generating system types[999D[J[32m◇[39m  ✅ Generated system types
15:35:26.223 [?25h[90m│[39m
15:35:26.224 [90m└[39m  🎉 Done!
15:35:26.224 
15:35:26.280 
15:35:26.280 up to date in 7s
15:35:26.281 
15:35:26.281 299 packages are looking for funding
15:35:26.281   run `npm fund` for details
15:35:26.313 Detected Next.js version: 14.2.5
15:35:26.321 Running "npm run build"
15:35:26.424 
15:35:26.426 > online-ito@0.1.0 build
15:35:26.426 > next build
15:35:26.426 
15:35:27.075   ▲ Next.js 14.2.5
15:35:27.076 
15:35:27.149    Creating an optimized production build ...
15:35:33.204 Failed to compile.
15:35:33.204 
15:35:33.205 ./pages/api/rooms/[roomId]/heartbeat.ts
15:35:33.206 Module not found: Can't resolve '@/lib/firebase/server'
15:35:33.206 
15:35:33.206 https://nextjs.org/docs/messages/module-not-found
15:35:33.207 
15:35:33.208 
15:35:33.208 > Build failed because of webpack errors
15:35:33.249 Error: Command "npm run build" exited with 1