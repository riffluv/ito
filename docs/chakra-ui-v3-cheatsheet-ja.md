# Chakra UI v3 チートシート（Next.js / App Router）
最終更新: 2025-08-21 (Asia/Tokyo)

— これ1枚で v3 の実装が進む最小セット。codex cli に読ませてもOK。

## 1) インストール
```bash
npm i @chakra-ui/react @emotion/react next-themes
```

## 2) Provider（App Router）
`src/components/ui/provider.tsx`
```tsx
"use client"
import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import { ThemeProvider } from "next-themes"

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
```

`src/app/layout.tsx`
```tsx
import { Provider } from "@/components/ui/provider"
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body><Provider>{children}</Provider></body>
    </html>
  )
}
```

## 3) Theming（Panda 風）
`src/theme/system.ts`
```ts
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

export const config = defineConfig({
  theme: {
    tokens: {
      colors: { brand: { value: "#5A67D8" } },
      fonts: {
        heading: { value: "Inter, ui-sans-serif" },
        body: { value: "Inter, ui-sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        bg: { value: { base: "{colors.white}", _dark: "{colors.gray.900}" } },
        fg: { value: { base: "{colors.gray.900}", _dark: "{colors.gray.50}" } },
      },
    },
  },
})
export const system = createSystem(defaultConfig, config)
export default system
```

`provider.tsx` で `defaultSystem` の代わりに `system` を渡すとテーマ有効。

## 4) Color Mode（v3）
- 旧 API（`ColorModeScript`/`useColorModeValue`）はやめる。
- `next-themes` で `ThemeProvider attribute="class"`。色切替は **Semantic Tokens**。

トグル例：
```tsx
"use client"
import { Button } from "@chakra-ui/react"
import { useTheme } from "next-themes"
export function ColorModeButton() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()
  const current = resolvedTheme ?? theme ?? systemTheme ?? "light"
  return <Button onClick={() => setTheme(current === "dark" ? "light" : "dark")}>
    {current}
  </Button>
}
```

## 5) Recipes（型安全なバリアント）
`src/theme/recipes/button.recipe.ts`
```ts
import { defineRecipe } from "@chakra-ui/react"
export const buttonRecipe = defineRecipe({
  className: "app-btn",
  base: { fontWeight: "semibold", borderRadius: "lg" },
  variants: {
    visual: {
      solid: { bg: "brand", color: "white" },
      outline: { borderWidth: "1px", borderColor: "brand", color: "brand" },
    },
    size: { sm: { px: 3 }, md: { px: 4 }, lg: { px: 6 } },
  },
  defaultVariants: { visual: "solid", size: "md" },
})
```
使用例：
```tsx
"use client"
import { chakra, useRecipe, Button as CButton } from "@chakra-ui/react"
import { buttonRecipe } from "@/theme/recipes/button.recipe"
export function Button({ visual, size, ...rest }: any) {
  const styles = useRecipe({ recipe: buttonRecipe })({ visual, size })
  const Styled = chakra(CButton, { base: styles })
  return <Styled {...rest} />
}
```

## 6) コンポーネント API（v3 形）
```tsx
import { List } from "@chakra-ui/react"
<List.Root gap="2">
  <List.Item>Item 1</List.Item>
  <List.Item>Item 2</List.Item>
</List.Root>
```

## 7) Tooltip（v3）
**プロップ名が v2 から変更**: `label→content`, `hasArrow→showArrow`, `isDisabled→disabled`。  
位置は `positioning={{ placement, gutter, offset }}`。

基本：
```tsx
import { Tooltip, Button } from "@chakra-ui/react"
<Tooltip content="説明" showArrow>
  <Button size="sm">Hover</Button>
</Tooltip>
```
ディレイ/インタラクティブ：
```tsx
<Tooltip content="詳細" openDelay={400} closeDelay={100} interactive>
  <Button>Info</Button>
</Tooltip>
```
位置：
```tsx
<Tooltip content="TOP" positioning={{ placement: "top", gutter: 8 }} showArrow>
  <Button>Top</Button>
</Tooltip>
```
無効化（ラップ推奨）:
```tsx
<Tooltip content="利用不可">
  <span><Button isDisabled>保存</Button></span>
</Tooltip>
```

## 8) Next.js/リアルタイムUIの要点
- **不変更新**: `setList(prev => prev.filter(x => x.id !== id))`
- **key は ID**（index 禁止）
- **購読クリーンアップ**: `return () => socket.off(...)`
- **サーバで人数チェック**など **権限は必ずサーバ側**で最終判定

## 9) CLI（オフライン運用）
```bash
npx @chakra-ui/cli snippet add      # Provider / ColorMode 雛形
npx @chakra-ui/cli eject --outdir ./src/theme   # Tokens/Recipes を出力
npx @chakra-ui/cli typegen ./src/theme/system.ts # レシピ型生成
```

## 10) よくある移行ポイント
- `styleConfig` → `defineRecipe` / `defineSlotRecipe`
- 旧 Color Mode API 廃止 → `next-themes` + Semantic Tokens
- import 形の変更（`List.Root` 等のサブコンポーネント）

―― 以上。
