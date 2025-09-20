react-dom.development.js:38560 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
content.js:85 [VSC] Content script initialized
log.ts:18 [useLobbyCounts] presence-config Object
app-index.js:33 Warning: React has detected a change in the order of Hooks called by RoomPage. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
1. useContext                 useContext
2. useContext                 useContext
3. useContext                 useContext
4. useContext                 useContext
5. useState                   useState
6. useState                   useState
7. useState                   useState
8. useRef                     useRef
9. useEffect                  useEffect
10. useEffect                 useEffect
11. useMemo                   useMemo
12. useState                  useState
13. useState                  useState
14. useState                  useState
15. useState                  useState
16. useRef                    useRef
17. useEffect                 useEffect
18. useEffect                 useEffect
19. useEffect                 useEffect
20. useEffect                 useEffect
21. useMemo                   useMemo
22. useEffect                 useEffect
23. useMemo                   useMemo
24. useEffect                 useEffect
25. useEffect                 useEffect
26. useMemo                   useMemo
27. useMemo                   useMemo
28. useState                  useState
29. useState                  useState
30. useState                  useState
31. useRef                    useRef
32. useRef                    useRef
33. useEffect                 useEffect
34. useEffect                 useEffect
35. useMemo                   useMemo
36. useEffect                 useEffect
37. useEffect                 useEffect
38. useEffect                 useEffect
39. useEffect                 useEffect
40. useEffect                 useEffect
41. useMemo                   useMemo
42. useState                  useState
43. useEffect                 useEffect
44. useEffect                 useEffect
45. useEffect                 useEffect
46. useEffect                 useEffect
47. useCallback               useCallback
48. useCallback               useCallback
49. useCallback               useCallback
50. useEffect                 useEffect
51. useCallback               useCallback
52. useRef                    useRef
53. useEffect                 useEffect
54. useCallback               useCallback
55. useCallback               useCallback
56. useEffect                 useEffect
57. useCallback               useCallback
58. useEffect                 useEffect
59. useMemo                   useMemo
60. useMemo                   useMemo
61. undefined                 useMemo
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:181:79)
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)
window.console.error @ app-index.js:33
app-index.js:33 Warning: Cannot update a component (`HotReload`) while rendering a different component (`RoomPage`). To locate the bad setState() call inside `RoomPage`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:181:79)
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at main
    at ClientFrame (webpack-internal:///(app-pages-browser)/./app/ClientFrame.tsx:19:11)
    at AuthProvider (webpack-internal:///(app-pages-browser)/./context/AuthContext.tsx:18:11)
    at AuthClientWrapper (webpack-internal:///(app-pages-browser)/./components/AuthClientWrapper.tsx:10:11)
    at div
    at eval (webpack-internal:///(app-pages-browser)/./node_modules/@emotion/react/dist/emotion-element-489459f2.browser.development.esm.js:55:66)
    at TransitionProvider (webpack-internal:///(app-pages-browser)/./components/ui/TransitionProvider.tsx:22:11)
    at AnimationProvider (webpack-internal:///(app-pages-browser)/./lib/animation/AnimationContext.tsx:16:11)
    at ChakraProvider (webpack-internal:///(app-pages-browser)/./node_modules/@chakra-ui/react/dist/esm/styled-system/provider.js:19:20)
    at ClientProviders (webpack-internal:///(app-pages-browser)/./components/ClientProviders.tsx:37:11)
    at BailoutToCSR (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/shared/lib/lazy-dynamic/dynamic-bailout-to-csr.js:13:11)
    at Suspense
    at LoadableComponent (Server)
    at Providers (Server)
    at body
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:117:11)
window.console.error @ app-index.js:33
react-dom.development.js:11435 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at HTMLUnknownElement.callCallback (react-dom.development.js:20565:14)
    at Object.invokeGuardedCallbackImpl (react-dom.development.js:20614:16)
    at invokeGuardedCallback (react-dom.development.js:20689:29)
    at beginWork (react-dom.development.js:26949:7)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at performConcurrentWorkOnRoot (react-dom.development.js:24504:74)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
redirect-boundary.js:57 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at beginWork (react-dom.development.js:26927:14)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at performConcurrentWorkOnRoot (react-dom.development.js:24504:74)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
react-dom.development.js:11435 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at HTMLUnknownElement.callCallback (react-dom.development.js:20565:14)
    at Object.invokeGuardedCallbackImpl (react-dom.development.js:20614:16)
    at invokeGuardedCallback (react-dom.development.js:20689:29)
    at beginWork (react-dom.development.js:26949:7)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at recoverFromConcurrentError (react-dom.development.js:24597:20)
    at performConcurrentWorkOnRoot (react-dom.development.js:24542:26)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
redirect-boundary.js:57 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at beginWork (react-dom.development.js:26927:14)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at recoverFromConcurrentError (react-dom.development.js:24597:20)
    at performConcurrentWorkOnRoot (react-dom.development.js:24542:26)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
app-index.js:33 The above error occurred in the <RedirectErrorBoundary> component:

    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:181:79)
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at main
    at ClientFrame (webpack-internal:///(app-pages-browser)/./app/ClientFrame.tsx:19:11)
    at AuthProvider (webpack-internal:///(app-pages-browser)/./context/AuthContext.tsx:18:11)
    at AuthClientWrapper (webpack-internal:///(app-pages-browser)/./components/AuthClientWrapper.tsx:10:11)
    at div
    at eval (webpack-internal:///(app-pages-browser)/./node_modules/@emotion/react/dist/emotion-element-489459f2.browser.development.esm.js:55:66)
    at TransitionProvider (webpack-internal:///(app-pages-browser)/./components/ui/TransitionProvider.tsx:22:11)
    at AnimationProvider (webpack-internal:///(app-pages-browser)/./lib/animation/AnimationContext.tsx:16:11)
    at ChakraProvider (webpack-internal:///(app-pages-browser)/./node_modules/@chakra-ui/react/dist/esm/styled-system/provider.js:19:20)
    at ClientProviders (webpack-internal:///(app-pages-browser)/./components/ClientProviders.tsx:37:11)
    at BailoutToCSR (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/shared/lib/lazy-dynamic/dynamic-bailout-to-csr.js:13:11)
    at Suspense
    at LoadableComponent (Server)
    at Providers (Server)
    at body
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:117:11)

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundaryHandler.
window.console.error @ app-index.js:33
log.ts:18 [presence] detach Object
log.ts:18 [presence] remove-path Object
log.ts:18 [presence] removed Object
react-dom.development.js:11435 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at HTMLUnknownElement.callCallback (react-dom.development.js:20565:14)
    at Object.invokeGuardedCallbackImpl (react-dom.development.js:20614:16)
    at invokeGuardedCallback (react-dom.development.js:20689:29)
    at beginWork (react-dom.development.js:26949:7)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at performConcurrentWorkOnRoot (react-dom.development.js:24504:74)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
redirect-boundary.js:57 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at beginWork (react-dom.development.js:26927:14)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at performConcurrentWorkOnRoot (react-dom.development.js:24504:74)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
react-dom.development.js:11435 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at HTMLUnknownElement.callCallback (react-dom.development.js:20565:14)
    at Object.invokeGuardedCallbackImpl (react-dom.development.js:20614:16)
    at invokeGuardedCallback (react-dom.development.js:20689:29)
    at beginWork (react-dom.development.js:26949:7)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at recoverFromConcurrentError (react-dom.development.js:24597:20)
    at performConcurrentWorkOnRoot (react-dom.development.js:24542:26)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
redirect-boundary.js:57 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (react-dom.development.js:11435:15)
    at updateMemo (react-dom.development.js:12613:14)
    at Object.useMemo (react-dom.development.js:13563:16)
    at useMemo (react.development.js:2537:21)
    at RoomPage (page.tsx:689:37)
    at renderWithHooks (react-dom.development.js:11121:18)
    at updateFunctionComponent (react-dom.development.js:16290:20)
    at beginWork$1 (react-dom.development.js:18472:16)
    at beginWork (react-dom.development.js:26927:14)
    at performUnitOfWork (react-dom.development.js:25748:12)
    at workLoopSync (react-dom.development.js:25464:5)
    at renderRootSync (react-dom.development.js:25419:7)
    at recoverFromConcurrentError (react-dom.development.js:24597:20)
    at performConcurrentWorkOnRoot (react-dom.development.js:24542:26)
    at workLoop (scheduler.development.js:256:34)
    at flushWork (scheduler.development.js:225:14)
    at MessagePort.performWorkUntilDeadline (scheduler.development.js:534:21)
app-index.js:33 The above error occurred in the <RedirectErrorBoundary> component:

    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:181:79)
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:370:11)
    at main
    at ClientFrame (webpack-internal:///(app-pages-browser)/./app/ClientFrame.tsx:19:11)
    at AuthProvider (webpack-internal:///(app-pages-browser)/./context/AuthContext.tsx:18:11)
    at AuthClientWrapper (webpack-internal:///(app-pages-browser)/./components/AuthClientWrapper.tsx:10:11)
    at div
    at eval (webpack-internal:///(app-pages-browser)/./node_modules/@emotion/react/dist/emotion-element-489459f2.browser.development.esm.js:55:66)
    at TransitionProvider (webpack-internal:///(app-pages-browser)/./components/ui/TransitionProvider.tsx:22:11)
    at AnimationProvider (webpack-internal:///(app-pages-browser)/./lib/animation/AnimationContext.tsx:16:11)
    at ChakraProvider (webpack-internal:///(app-pages-browser)/./node_modules/@chakra-ui/react/dist/esm/styled-system/provider.js:19:20)
    at ClientProviders (webpack-internal:///(app-pages-browser)/./components/ClientProviders.tsx:37:11)
    at BailoutToCSR (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/shared/lib/lazy-dynamic/dynamic-bailout-to-csr.js:13:11)
    at Suspense
    at LoadableComponent (Server)
    at Providers (Server)
    at body
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:117:11)

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundaryHandler.
window.console.error @ app-index.js:33
log.ts:18 [presence] detach Object
log.ts:18 [presence] remove-path Object
log.ts:18 [presence] removed Object
hot-reloader-client.js:187 [Fast Refresh] rebuilding
hot-reloader-client.js:44 [Fast Refresh] done in 66ms
