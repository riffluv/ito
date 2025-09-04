index.js:627 Uncaught ModuleBuildError: Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\app\page.tsx:138:1]
 138 │   ];
 139 │ 
 140 │   return (
 141 │     <Box bg="canvasBg" minH="100vh">
     ·      ───
 142 │       {/* === HERO SECTION === */}
 143 │       <Box
 143 │         position="relative"
     ╰────


Caused by:
    Syntax Error
    at processResult (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:400590)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:402302)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:8645)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:5019)
    at r.callback (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:4039)
hydration-error-info.js:63 ./app/page.tsx
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\app\page.tsx:138:1]
 138 │   ];
 139 │ 
 140 │   return (
 141 │     <Box bg="canvasBg" minH="100vh">
     ·      ───
 142 │       {/* === HERO SECTION === */}
 143 │       <Box
 143 │         position="relative"
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
content.js:1 Uncaught (in promise) The message port closed before a response was received.
content.js:1 Uncaught (in promise) The message port closed before a response was received.
:3000/favicon.ico:1  Failed to load resource: the server responded with a status of 404 (Not Found)
