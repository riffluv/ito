  GET http://localhost:3000/rooms/sRkkiSIYhQABFgqNWMsb 500 (Internal Server Error)
performFullReload @ webpack-internal:///…oader-client.js:393
handleApplyUpdates @ webpack-internal:///…oader-client.js:352
eval @ webpack-internal:///…oader-client.js:382
Promise.then
tryApplyUpdates @ webpack-internal:///…oader-client.js:379
handleSuccess @ webpack-internal:///…oader-client.js:112
processMessage @ webpack-internal:///…oader-client.js:254
eval @ webpack-internal:///…loader-client.js:67
handleMessage @ webpack-internal:///…ges/websocket.js:52
index.js:627 Uncaught ModuleBuildError: Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):
Error: 
  × Unexpected token `Dialog`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\CreateRoomModal.tsx:103:1]
 103 │   };;;
 104 │ 
 105 │   return (
 106 │     <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onClose()}>
     ·      ──────
 107 │       <Dialog.Backdrop />
 108 │       <Dialog.Positioner>
 109 │         <Dialog.Content>
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
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
hydration-error-info.js:63 ./components/CreateRoomModal.tsx
Error: 
  × Unexpected token `Dialog`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\CreateRoomModal.tsx:103:1]
 103 │   };;;
 104 │ 
 105 │   return (
 106 │     <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onClose()}>
     ·      ──────
 107 │       <Dialog.Backdrop />
 108 │       <Dialog.Positioner>
 109 │         <Dialog.Content>
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
window.console.error @ setup-hydration-warning.js:18
handleErrors @ hot-reloader-client.js:162
processMessage @ hot-reloader-client.js:239
eval @ hot-reloader-client.js:67
handleMessage @ websocket.js:52