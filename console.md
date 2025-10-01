react-dom.development.js:38560 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
log.ts:69 [presence] connection-offline Object
app-index.js:33 Warning: React has detected a change in the order of Hooks called by RoomPageContent. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
1. useContext                 useContext
2. useContext                 useContext
3. useContext                 useContext
4. useState                   useState
5. useState                   useState
6. useState                   useState
7. useState                   useState
8. useState                   useState
9. useRef                     useRef
10. useRef                    useRef
11. useRef                    useRef
12. useRef                    useRef
13. useState                  useState
14. useState                  useState
15. useState                  useState
16. useRef                    useRef
17. useEffect                 useEffect
18. useEffect                 useEffect
19. useEffect                 useEffect
20. useMemo                   useMemo
21. useEffect                 useEffect
22. useState                  useState
23. useState                  useState
24. useState                  useState
25. useState                  useState
26. useRef                    useRef
27. useEffect                 useEffect
28. useEffect                 useEffect
29. useEffect                 useEffect
30. useEffect                 useEffect
31. useMemo                   useMemo
32. useEffect                 useEffect
33. useMemo                   useMemo
34. useEffect                 useEffect
35. useEffect                 useEffect
36. useMemo                   useMemo
37. useMemo                   useMemo
38. useState                  useState
39. useState                  useState
40. useRef                    useRef
41. useRef                    useRef
42. useState                  useState
43. useMemo                   useMemo
44. useEffect                 useEffect
45. useCallback               useCallback
46. useCallback               useCallback
47. useMemo                   useMemo
48. useMemo                   useMemo
49. useState                  useState
50. useState                  useState
51. useState                  useState
52. useRef                    useRef
53. useRef                    useRef
54. useMemo                   useMemo
55. useCallback               useCallback
56. useCallback               useCallback
57. useEffect                 useEffect
58. useEffect                 useEffect
59. useEffect                 useEffect
60. useEffect                 useEffect
61. useEffect                 useEffect
62. useCallback               useCallback
63. useRef                    useRef
64. useEffect                 useEffect
65. useCallback               useCallback
66. useCallback               useCallback
67. useEffect                 useEffect
68. useMemo                   useMemo
69. useRef                    useRef
70. useRef                    useRef
71. useEffect                 useEffect
72. useEffect                 useEffect
73. useMemo                   useMemo
74. useState                  useState
75. useEffect                 useEffect
76. useEffect                 useEffect
77. useEffect                 useEffect
78. useMemo                   useMemo
79. useMemo                   useMemo
80. useEffect                 useEffect
81. useRef                    useRef
82. useRef                    useRef
83. useEffect                 useEffect
84. useEffect                 useEffect
85. useCallback               useCallback
86. useRef                    useRef
87. useEffect                 useEffect
88. useCallback               useCallback
89. useCallback               useCallback
90. useEffect                 useEffect
91. useCallback               useCallback
92. useRef                    useRef
93. useEffect                 useEffect
94. useEffect                 useEffect
95. useEffect                 useEffect
96. useMemo                   useMemo
97. useMemo                   useMemo
98. useMemo                   useMemo
99. useMemo                   useMemo
100. useMemo                  useMemo
101. undefined                useMemo
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    at RoomPageContent (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:92:11)
    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:1328:79)
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser
window.console.error @ app-index.js:33
app-index.js:33 Warning: Cannot update a component (`HotReload`) while rendering a different component (`RoomPageContent`). To locate the bad setState() call inside `RoomPageContent`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
    at RoomPageContent (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:92:11)
    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:1328:79)
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
    at AnimationProvider (webpack-internal:///(app-pages-browser)/./lib/animation/AnimationContext.tsx:18:11)
    at SoundProvider (webpack-internal:///(app-pages-browser)/./lib/audio/SoundProvider.tsx:25:11)
    at ChakraProvider (webpack-internal:///(app-pages-browser)/./node_modules/@chakra-ui/react/dist/esm/styled-system/provider.js:19:20)
    at ClientProviders (webpack-internal:///(app-pages-browser)/./components/ClientProviders.tsx:39:11)
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
    at RoomPageContent (page.tsx:845:28)
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
    at RoomPageContent (page.tsx:845:28)
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
    at RoomPageContent (page.tsx:845:28)
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
    at RoomPageContent (page.tsx:845:28)
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

    at RoomPageContent (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:92:11)
    at RoomPage (webpack-internal:///(app-pages-browser)/./app/rooms/[roomId]/page.tsx:1328:79)
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
    at AnimationProvider (webpack-internal:///(app-pages-browser)/./lib/animation/AnimationContext.tsx:18:11)
    at SoundProvider (webpack-internal:///(app-pages-browser)/./lib/audio/SoundProvider.tsx:25:11)
    at ChakraProvider (webpack-internal:///(app-pages-browser)/./node_modules/@chakra-ui/react/dist/esm/styled-system/provider.js:19:20)
    at ClientProviders (webpack-internal:///(app-pages-browser)/./components/ClientProviders.tsx:39:11)
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
log.ts:69 [presence] detach Object
log.ts:69 [presence] detach Object
index.esm2017.js:85 [2025-10-01T09:37:35.507Z]  @firebase/firestore: Firestore (10.14.1): BloomFilter error:  {"name":"BloomFilterError"}
defaultLogHandler @ index.esm2017.js:85
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=S6PGdYlpxFJX_CCoPNqqlifqf_rXbBcIbRikSHwkY4U&SID=z2aAQgRSKvFou4MjVXWbtA&RID=67043&TYPE=terminate&zx=aepf36cgspkq:1  Failed to load resource: the server responded with a status of 400 ()
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=fROI8THvJ6912Mll4nAA04j5xLQlp6Ax4mXLbNy2xHM&SID=UJACM9aQ8JvHOeRhKM23SA&RID=97646&AID=1&zx=wt47ozsm031b&t=1:1  Failed to load resource: the server responded with a status of 400 ()
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=fROI8THvJ6912Mll4nAA04j5xLQlp6Ax4mXLbNy2xHM&SID=UJACM9aQ8JvHOeRhKM23SA&RID=97647&TYPE=terminate&zx=cqmpq08xrq3x:1  Failed to load resource: the server responded with a status of 400 ()
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=CMLjAriin9BkQ98S-uQTG6PU6BnVhwDx4_5Twn2AXO0&SID=xHe1tXPVvLfpAwgyys4hxw&RID=37113&TYPE=terminate&zx=kjpgshlh6z99:1  Failed to load resource: the server responded with a status of 400 ()
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=rqjPYuW2DiBpkO32fXM7eDjVT2EOBmJsXBbxiKv2S_0&SID=wCDfMrlJzEjfeq-a5zxqQw&RID=4669&TYPE=terminate&zx=fsqgw3hiqzb4:1  Failed to load resource: the server responded with a status of 400 ()
firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fonline-ito%2Fdatabases%2F(default)&gsessionid=1Pvzxt8mXY1IdjVBvBz8CMZsHeDFqy9QKgRBCZaOtzI&SID=XVC01wkr2MjXVmV1xm04BQ&RID=80322&TYPE=terminate&zx=9rep9zpvhb4f:1  Failed to load resource: the server responded with a status of 400 ()
