  GET http://localhost:3000/rooms/bkkP94Qu4rsAvO7HUzR7 500 (Internal Server Error)
Router @ webpack-internal:///…s/app-router.js:390
renderWithHooks @ webpack-internal:///…evelopment.js:11121
updateFunctionComponent @ webpack-internal:///…evelopment.js:16290
beginWork$1 @ webpack-internal:///…evelopment.js:18472
beginWork @ webpack-internal:///…evelopment.js:26927
performUnitOfWork @ webpack-internal:///…evelopment.js:25748
workLoopSync @ webpack-internal:///…evelopment.js:25464
renderRootSync @ webpack-internal:///…evelopment.js:25419
performConcurrentWorkOnRoot @ webpack-internal:///…evelopment.js:24504
workLoop @ webpack-internal:///….development.js:256
flushWork @ webpack-internal:///….development.js:225
performWorkUntilDeadline @ webpack-internal:///….development.js:534
index.js:627 Uncaught ModuleBuildError: Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):
Error: 
  × Expression expected
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:355:1]
 355 │     </HStack>
 356 │   );
 357 │ }
 358 │         >
     ·         ─
 359 │           {typeof me?.number === "number" ? me.number : "?"}
 360 │         </Box>
 360 │ 
     ╰────

  × Unexpected token `me`. Expected ... , *,  (, [, :, , ?, =, an identifier, public, protected, private, readonly, <.
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:356:1]
 356 │   );
 357 │ }
 358 │         >
 359 │           {typeof me?.number === "number" ? me.number : "?"}
     ·                   ──
 360 │         </Box>
 361 │ 
 361 │         <Input
     ╰────


Caused by:
    Syntax Error
    at processResult (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:400590)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:402302)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:8645)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:5019)
    at r.callback (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:4039)
getServerError @ nodeStackFrames.js:38
eval @ index.js:627
setTimeout
hydrate @ index.js:615
await in hydrate
pageBootrap @ page-bootstrap.js:27
eval @ next-dev.js:25
Promise.then
eval @ next-dev.js:23
./node_modules/next/dist/client/next-dev.js @ main.js:809
options.factory @ webpack.js:647
__webpack_require__ @ webpack.js:37
__webpack_exec__ @ main.js:1942
（匿名） @ main.js:1943
webpackJsonpCallback @ webpack.js:1195
（匿名） @ main.js:9
hydration-error-info.js:63 ./components/ui/MiniHandDock.tsx
Error: 
  × Expression expected
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:355:1]
 355 │     </HStack>
 356 │   );
 357 │ }
 358 │         >
     ·         ─
 359 │           {typeof me?.number === "number" ? me.number : "?"}
 360 │         </Box>
 360 │ 
     ╰────

  × Unexpected token `me`. Expected ... , *,  (, [, :, , ?, =, an identifier, public, protected, private, readonly, <.
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:356:1]
 356 │   );
 357 │ }
 358 │         >
 359 │           {typeof me?.number === "number" ? me.number : "?"}
     ·                   ──
 360 │         </Box>
 361 │ 
 361 │         <Input
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
window.console.error @ setup-hydration-warning.js:18
handleErrors @ hot-reloader-client.js:162
processMessage @ hot-reloader-client.js:239
eval @ hot-reloader-client.js:67
handleMessage @ websocket.js:52
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
