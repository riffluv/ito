  455 |     leavingRef.current = false;
> 456 |   }, [roomId, user?.uid]);
      |       ^
  457 |
 GET /rooms/KgNgPvHGXbaDVavTbAga 500 in 242ms
 GET /.well-known/appspecific/com.chrome.devtools.json 404 in 150ms
 GET / 200 in 93ms
 GET /.well-known/appspecific/com.chrome.devtools.json 404 in 37ms
 ⨯ app\rooms\[roomId]\page.tsx (456:7) @ roomId
 ⨯ ReferenceError: roomId is not defined
    at eval (./app/rooms/[roomId]/page.tsx:786:5)
    at (ssr)/./app/rooms/[roomId]/page.tsx (C:\Users\hr-hm\Desktop\codex\.next\server\app\rooms\[roomId]\page.js:369:1)
    at Object.__webpack_require__ [as require] (C:\Users\hr-hm\Desktop\codex\.next\server\webpack-runtime.js:33:43)
    at JSON.parse (<anonymous>)
digest: "2667422869"
  454 |   useEffect(() => {
  455 |     leavingRef.current = false;
> 456 |   }, [roomId, user?.uid]);
      |       ^
  457 |
 GET /rooms/6jCJlT7IWZQGNOaruIJk 500 in 60ms
 GET /.well-known/appspecific/com.chrome.devtools.json 404 in 32ms