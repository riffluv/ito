hydration-error-info.js:63 ./app/rooms/[roomId]/page.tsx
Error: 
  × Expression expected
     ╭─[C:\Users\hr-hm\Desktop\codex\app\rooms\[roomId]\page.tsx:407:1]
 407 │ 
 408 │   // 新しいGameLayoutを使用した予測可能な構造
 409 │   return (
 410 │     <>
     ·      ─
 411 │       <GameLayout
 412 │         header={
 412 │           <Hud
     ╰────

  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\app\rooms\[roomId]\page.tsx:500:1]
 500 │           </Box>
 501 │         }
 502 │         handArea={
 503 │           <Box
     ·            ───
 504 │             display="flex"
 505 │             alignItems="center"
 505 │             justifyContent="space-between"
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
