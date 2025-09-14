  GET http://localhost:3000/rooms/Jus9qas5cEteAH0elCtT 500 (Internal Server Error)
Router @ webpack-internal:///…s/app-router.js:390
renderWithHooks @ webpack-internal:///…evelopment.js:11121
updateFunctionComponent @ webpack-internal:///…evelopment.js:16290
beginWork$1 @ webpack-internal:///…evelopment.js:18472
beginWork @ webpack-internal:///…evelopment.js:26927
performUnitOfWork @ webpack-internal:///…evelopment.js:25748
workLoopConcurrent @ webpack-internal:///…evelopment.js:25734
renderRootConcurrent @ webpack-internal:///…evelopment.js:25690
performConcurrentWorkOnRoot @ webpack-internal:///…evelopment.js:24504
workLoop @ webpack-internal:///….development.js:256
flushWork @ webpack-internal:///….development.js:225
performWorkUntilDeadline @ webpack-internal:///….development.js:534
main.js:1805 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
index.js:627 Uncaught ModuleBuildError: Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:166:1]
 166 │ 
 167 │ 
 168 │   return (
 169 │     <Box
     ·      ───
 170 │       display="flex"
 171 │       alignItems="center"
 172 │       justifyContent="center"
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
websocket.js:46 [HMR] connected
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
content.js:1 Uncaught (in promise) The message port closed before a response was received.
（匿名） @ content.js:1
hydration-error-info.js:63 ./components/ui/MiniHandDock.tsx
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\MiniHandDock.tsx:166:1]
 166 │ 
 167 │ 
 168 │   return (
 169 │     <Box
     ·      ───
 170 │       display="flex"
 171 │       alignItems="center"
 172 │       justifyContent="center"
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
window.console.error @ setup-hydration-warning.js:18
handleErrors @ hot-reloader-client.js:162
processMessage @ hot-reloader-client.js:239
eval @ hot-reloader-client.js:67
handleMessage @ websocket.js:52
use-on-click-outside.js:30 [Violation] Added non-passive event listener to a scroll-blocking 'touchstart' event. Consider marking event handler as 'passive' to make the page more responsive. See https://www.chromestatus.com/feature/5745543795965952
eval @ use-on-click-outside.js:30
commitHookEffectListMount @ react-dom.development.js:23145
commitPassiveMountOnFiber @ react-dom.development.js:24921
commitPassiveMountEffects_complete @ react-dom.development.js:24886
commitPassiveMountEffects_begin @ react-dom.development.js:24873
commitPassiveMountEffects @ react-dom.development.js:24861
flushPassiveEffectsImpl @ react-dom.development.js:27034
flushPassiveEffects @ react-dom.development.js:26979
commitRootImpl @ react-dom.development.js:26930
commitRoot @ react-dom.development.js:26677
performSyncWorkOnRoot @ react-dom.development.js:26112
flushSyncCallbacks @ react-dom.development.js:12042
commitRootImpl @ react-dom.development.js:26954
commitRoot @ react-dom.development.js:26677
finishConcurrentRender @ react-dom.development.js:25976
performConcurrentWorkOnRoot @ react-dom.development.js:25804
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
content.js:85 [VSC] Content script initialized
