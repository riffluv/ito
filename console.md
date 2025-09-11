react-dom.development.js:29835 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
index.js:627 Uncaught ModuleBuildError: Module build failed (from ./node_modules/next/dist/build/webpack/loaders/next-swc-loader.js):
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\DragonQuestNotify.tsx:217:1]
 217 │   }, [notification.duration, notification.id]);
 218 │ 
 219 │   return (
 220 │     <Box
     ·      ───
 221 │       ref={containerRef}
 222 │       mb={3}
 223 │       css={{
     ╰────


Caused by:
    Syntax Error
    at processResult (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:400590)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\webpack\bundle5.js:28:402302)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:8645)
    at <unknown> (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:5019)
    at r.callback (file://C:\Users\hr-hm\Desktop\codex\node_modules\next\dist\compiled\loader-runner\LoaderRunner.js:1:4039)
websocket.js:46 [HMR] connected
hydration-error-info.js:63 ./components/ui/DragonQuestNotify.tsx
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\DragonQuestNotify.tsx:217:1]
 217 │   }, [notification.duration, notification.id]);
 218 │ 
 219 │   return (
 220 │     <Box
     ·      ───
 221 │       ref={containerRef}
 222 │       mb={3}
 223 │       css={{
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
content.js:1 Uncaught (in promise) The message port closed before a response was received.
content.js:1 Uncaught (in promise) The message port closed before a response was received.
content.js:85 [VSC] Content script initialized
