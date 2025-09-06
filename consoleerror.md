index.js:627 Uncaught Error: Module not found: Can't resolve '@/lib/firebase/core'
  56 |
  57 |       try {
> 58 |         const { requireDb } = await import("@/lib/firebase/core");
     |                                     ^
  59 |         const { doc, getDoc } = await import("firebase/firestore");
  60 |         const { evaluateSorted } = await import("@/lib/game/rules");
  61 |

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./components/CentralCardBoard.tsx
./app/rooms/[roomId]/page.tsx
    at <unknown> (https://nextjs.org/docs/messages/module-not-found)
    at getNotFoundError (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\build\webpack\plugins\wellknown-errors-plugin\parseNotFoundError.js:124:16)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async getModuleBuildError (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\build\webpack\plugins\wellknown-errors-plugin\webpackModuleError.js:104:27)
    at async (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\build\webpack\plugins\wellknown-errors-plugin\index.js:29:49)
    at async (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\build\webpack\plugins\wellknown-errors-plugin\index.js:27:21)
content.js:1 Uncaught (in promise) The message port closed before a response was received.
content.js:1 Uncaught (in promise) The message port closed before a response was received.
hydration-error-info.js:63 ./components/hooks/useRevealAnimation.ts:58:37
Module not found: Can't resolve '@/lib/firebase/core'
  56 |
  57 |       try {
> 58 |         const { requireDb } = await import("@/lib/firebase/core");
     |                                     ^
  59 |         const { doc, getDoc } = await import("firebase/firestore");
  60 |         const { evaluateSorted } = await import("@/lib/game/rules");
  61 |

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./components/CentralCardBoard.tsx
./app/rooms/[roomId]/page.tsx
console.error @ hydration-error-info.js:63
