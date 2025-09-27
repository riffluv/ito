PS C:\Users\hr-hm\Desktop\codex> npm run build

> online-ito@0.1.0 build
> next build

  ▲ Next.js 14.2.5
  - Environments: .env.local, .env
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
 ✓ Compiled successfully
   Skipping linting
   Checking validity of types  .Failed to compile.

./components/ui/DragonQuestParty.tsx:295:63
Type error: Type '{ children: (false | "" | Element | undefined)[]; display: "flex"; alignItems: "center"; justify: string; mb: number; }' is not assignable to type 'IntrinsicAttributes & Omit<PatchHtmlProps<Omit<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref">>, "filter" | ... 835 more ... | keyof PolymorphicProps> & Omit<...> & PolymorphicProps & { ...; }'.
  Property 'justify' does not exist on type 'IntrinsicAttributes & Omit<PatchHtmlProps<Omit<DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref">>, "filter" | ... 835 more ... | keyof PolymorphicProps> & Omit<...> & PolymorphicProps & { ...; }'.

  293 |                     <Box flex={1} minW={0}>
  294 |                       {/* 第1行: 名前 + ホストマーク */}
> 295 |                       <Box display="flex" alignItems="center" justify="space-between" mb={1}>
      |                                                               ^
  296 |                         <Text
  297 |                           fontSize="md"
  298 |                           fontWeight="bold"
PS C:\Users\hr-hm\Desktop\codex> 