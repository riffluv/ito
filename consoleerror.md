hydration-error-info.js:63 ./app/page.tsx
Error: 
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\app\page.tsx:136:1]
 136 │   };
 137 │ 
 138 │   return (
 139 │     <Box bg="canvasBg">
     ·      ───
 140 │       {/* フルブリード背景: 新リッチブラック */}
 141 │       <Hero onPlay={openCreateFlow} onRules={() => router.push("/rules")} />
 142 │       
     ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
content.js:1 Uncaught (in promise) The message port closed before a response was received.
