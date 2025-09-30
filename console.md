PS C:\Users\hr-hm\Desktop\codex> npm run build

> online-ito@0.1.0 build
> next build

  ▲ Next.js 14.2.5
  - Environments: .env.local, .env
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
Failed to compile.

./components/ui/SimplePhaseDisplay.tsx
Error:
  × Unexpected token `Box`. Expected jsx identifier
     ╭─[C:\Users\hr-hm\Desktop\codex\components\ui\SimplePhaseDisplay.tsx:233:1]
 233 │   }, [topicText, prefersReduced]);
 234 │
 235 │   return (
 236 │     <Box
     ·      ───
 237 │       ref={containerRef}
 238 │       position="fixed"
 239 │       top={{ base: "12px", md: "16px" }}
     ╰────

Caused by:
    Syntax Error

Import trace for requested module:
./components/ui/SimplePhaseDisplay.tsx
./app/rooms/[roomId]/page.tsx


> Build failed because of webpack errors