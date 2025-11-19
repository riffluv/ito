PixiJS OffscreenCanvas Worker Setup – Pixi v8 supports running in a Web Worker by using the WebWorkerAdapter. In the main thread, transfer a canvas to offscreen and send it to the worker. In the worker, set the adapter and initialize the Pixi Application with that OffscreenCanvas
pixijs.com
npmjs.com
 (PixiJS v8 Guide, 2025). For example:
// Main thread
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ width, height, view: offscreen }, [offscreen]);
// Worker thread
DOMAdapter.set(WebWorkerAdapter);
self.onmessage = ({ data: { width, height, view } }) => {
  const app = new Application({ width, height, view });
  // ... add sprites, run ticker, etc.
};
(Source: PixiJS Documentation, updated 2025
pixijs.com
; @pixi/webworker README, 2023-09
npmjs.com
)
Web Worker Bundling (Next.js 14 & Vite) – Modern bundlers allow importing workers easily. In Next.js (Webpack 5+), use the new URL() pattern to ensure the worker script is bundled. For example: const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }); (Next.js App Router, 2025)
park.is
. In Vite, you can use the ?worker query to import a worker constructor. For example:
import CanvasWorker from "./canvas.worker.ts?worker";
const worker = new CanvasWorker();
This spawns the worker with an OffscreenCanvas transferred (Vite docs, 2025)
nabeelvalley.co.za
. (Ye Joo Park, 2025-04-17
park.is
; N. Valley, 2025-01-06
nabeelvalley.co.za
)
Safari/iOS Support & Workarounds – OffscreenCanvas with WebGL is fully supported in Safari 17+ (iOS 17, macOS Sonoma); older Safari 16.x had only partial support (no WebGL context in OffscreenCanvas)
caniuse.com
stackoverflow.com
. For example, Safari 16.4 would throw an error getting a WebGL context on an OffscreenCanvas
stackoverflow.com
. Thus, on iOS 16 and below, Pixi’s WebWorkerAdapter approach will not work. A common fallback is to detect lack of canvas.transferControlToOffscreen and run Pixi on the main thread instead (or skip worker rendering on those devices). (Caniuse.com data, updated 2025-10-11
caniuse.com
; Stack Overflow, 2023-06-01
stackoverflow.com
). Additionally, note that Safari on iOS 17 has a WebGL bug where backgrounding the page can trigger frequent context loss events
discourse.threejs.org
discourse.threejs.org
. If OffscreenCanvas usage on Safari is unstable, consider disabling the worker on those platforms or implementing robust context recovery (see below).
Context Loss Handling in Worker – WebGL contexts (including OffscreenCanvas) can be lost (e.g. due to GPU resets or memory) and must be restored. In a worker, listen for the canvas’s "webglcontextlost" and "webglcontextrestored" events on the OffscreenCanvas. Pixi’s renderer view (the canvas) will emit these events. Best practice is to call event.preventDefault() on the contextlost event to stop the browser’s default attempt to auto-recover, then destroy or pause Pixi rendering. On contextrestored, recreate the Pixi Application or reload resources
discourse.threejs.org
. For example:
app.renderer.view.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  // e.g. pause render loop, flag to reinit on restore
});
app.renderer.view.addEventListener('webglcontextrestored', () => {
  // re-init Pixi Application: create renderer, load textures, etc.
});
If the context continuously fails to restore (happens repeatedly), you may choose to terminate the worker and fall back to main-thread rendering to maintain usability. (Handling context loss is essential – a WebGL context “can happen at any time and apps should properly react”
discourse.threejs.org
. In practice, some developers reload the page or canvas after multiple losses as a last resort
discourse.threejs.org
.) (Three.js forum, 2023-09-09
discourse.threejs.org
discourse.threejs.org
)
Pointer Events & Parallax Throttling – To send frequent pointer updates (e.g. for a parallax background) from the main thread to the worker efficiently, use throttling. It’s recommended to align pointermove events to the display frame rate (about one update per 16ms ~ 60 FPS)
nolanlawson.com
. Browsers don’t always throttle these events to rAF, especially on Safari, so manually using requestAnimationFrame or a throttle timer is ideal
nolanlawson.com
. For example, you can set a flag and on each pointermove use requestAnimationFrame to send only the latest X,Y coordinates to the worker, ensuring you don’t flood postMessage. Keep the message payload minimal (e.g. just {type: "move", x, y} or a delta) to reduce overhead. This approach delivers smooth visual motion without overwhelming the threads. (Nolan Lawson blog, 2019-08-14
nolanlawson.com
)
Command Messaging for Effects – Design the worker communication as command messages rather than heavy data transfers. For instance, instead of sending a large particle dataset for a “firework” effect, send a simple command object and let the worker handle the effect generation. A common pattern is to include a type (or event) field in the message
stackoverflow.com
. For example, the main thread can do: worker.postMessage({ type: "spawnFirework", x: 200, y: 300 });. In the worker’s onmessage, use a switch or if-statement on data.type to handle each command:
// Inside worker:
self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "spawnFirework") {
    spawnFireworkAt(msg.x, msg.y);  // worker creates the effect
  }
};
This way, the main thread only sends a lightweight trigger, and the worker executes the heavy logic (e.g. adding particles via Pixi). This reduces data transfer and keeps the roles clear. (Stack Overflow, 2018-03-18
stackoverflow.com
stackoverflow.com
)
Asset Loading Optimizations – To minimize main-thread work, perform asset loading and preparation in the worker when possible. For example, a worker can fetch() image files or use Pixi’s Assets loader to get an ArrayBuffer/Blob, then use createImageBitmap() to decode images into bitmaps off the main thread. These ImageBitmap objects can be directly used to create Pixi textures in the worker, avoiding blocking the UI during decoding
stackoverflow.com
. (Chrome’s implementation of createImageBitmap will utilize multiple threads internally for decoding, which can improve throughput but might tax the CPU if many large images are decoded at once
stackoverflow.com
.) An alternative is for the main thread to load assets (perhaps to leverage caching or simpler logic) and then transfer the raw data to the worker. For instance, the main thread could fetch an image and send an ArrayBuffer or Blob to the worker; the worker then creates a bitmap from it. Remember to transfer objects (using the second parameter of postMessage) for efficiency – e.g. transferring a Uint8Array or ImageBitmap avoids copying memory
discourse.threejs.org
. In practice, offloading image decoding to a worker can reduce frame drops during asset load, but the overall benefit depends on device capabilities (on low-end, decoding in worker is helpful; on high-end, the difference may be smaller). Ensure to handle cases where some browsers don’t support createImageBitmap in workers (e.g. Safari <=16); in those cases, you might load images on the main thread or use <img> fallback. (Chrome team blog, 2019-11-14
stackoverflow.com
; Three.js forum discussion, 2021-04-14
discourse.threejs.org
)
Performance Gains (Worker vs Main) – Moving rendering off the main thread helps maintain higher FPS and lower input latency under load, especially on slower devices. In one case, adding a complex WebGL animation on the main thread caused a ~5% drop in Lighthouse performance score, which was recovered by offloading it to a Web Worker with OffscreenCanvas
evilmartians.com
. By parallelizing rendering, the main thread is free to handle UI input, preventing frame stalls. This is critical because to achieve 60 FPS, all work each frame must finish in ~10–16 ms
github.com
. Offloading heavy Pixi animations (like fireworks or meteor showers) to a worker can keep the main thread within this budget, preserving responsive interactions (e.g. touch/clicks stay snappy). Real-world tests have shown that on low-end mobile devices, using a worker for background canvas effects yields smoother animations (higher steady FPS) compared to doing the same on the main thread, which often stutters when under load
github.com
. Keep in mind that using a worker does introduce a slight overhead for messaging, so the best gains occur when the worker has substantial work to do (e.g. physics or particle systems) that outweighs the communication cost. Overall, as of 2025, OffscreenCanvas in workers is a proven way to boost canvas render performance for animations and protect input latency on modern browsers
evilmartians.com
github.com
. (Evil Martians blog, 2019-04-02; Chris Price demo, 2020)
引用

Environments | PixiJS

https://pixijs.com/8.x/guides/concepts/environments

@pixi/webworker - npm

https://www.npmjs.com/package/@pixi/webworker

Ye Joo Park's Blog

https://park.is/blog_posts/20250417_nextjs_comlink_examples/

Web Workers and Vite

https://nabeelvalley.co.za/blog/2025/06-01/web-workers/

OffscreenCanvas | Can I use... Support tables for HTML5, CSS3, etc

https://caniuse.com/offscreencanvas

three.js - OffscreenCanvas + ThreeJS issue on Safari - Stack Overflow

https://stackoverflow.com/questions/76380311/offscreencanvas-threejs-issue-on-safari

"Context Lost" when backgrounding Safari on iOS 17 Developer Beta 8 - Questions - three.js forum

https://discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772

"Context Lost" when backgrounding Safari on iOS 17 Developer Beta 8 - Questions - three.js forum

https://discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772

"Context Lost" when backgrounding Safari on iOS 17 Developer Beta 8 - Questions - three.js forum

https://discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772

"Context Lost" when backgrounding Safari on iOS 17 Developer Beta 8 - Questions - three.js forum

https://discourse.threejs.org/t/context-lost-when-backgrounding-safari-on-ios-17-developer-beta-8/55772

Browsers, input events, and frame throttling | Read the Tea Leaves

https://nolanlawson.com/2019/08/14/browsers-input-events-and-frame-throttling/

javascript - Can web workers support multiple events like message and progress? - Stack Overflow

https://stackoverflow.com/questions/49347014/can-web-workers-support-multiple-events-like-message-and-progress

javascript - Can web workers support multiple events like message and progress? - Stack Overflow

https://stackoverflow.com/questions/49347014/can-web-workers-support-multiple-events-like-message-and-progress

javascript - Decode images in web worker - Stack Overflow

https://stackoverflow.com/questions/58856403/decode-images-in-web-worker

Performance ideas (loading objects in workers, faster texture uploads, etc) - Discussion - three.js forum

https://discourse.threejs.org/t/performance-ideas-loading-objects-in-workers-faster-texture-uploads-etc/25328

Faster WebGL/Three.js 3D graphics with OffscreenCanvas and Web Workers—Martian Chronicles, Evil Martians’ team blog

https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers

GitHub - chrisprice/offscreen-canvas: Examples of chart rendering using offscreen canvas

https://github.com/chrisprice/offscreen-canvas
すべての情報源

pixijs

npmjs

park

nabeelvalley.co

caniuse

stackoverflow

discourse.threejs

nolanlawson