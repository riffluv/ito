/**
 * AppButtonコンポーネントのテスト
 */
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import system from "@/theme";

// テスト用のプロバイダーをラップするヘルパー
function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("AppButton", () => {
  it("should render with default props", () => {
    renderWithChakra(<AppButton>テストボタン</AppButton>);
    
    const button = screen.getByRole("button", { name: "テストボタン" });
    expect(button).toBeInTheDocument();
  });

  it("should render with custom visual variant", () => {
    renderWithChakra(
      <AppButton visual="outline">アウトラインボタン</AppButton>
    );
    
    const button = screen.getByRole("button", { name: "アウトラインボタン" });
    expect(button).toBeInTheDocument();
  });

  it("should render with custom palette", () => {
    renderWithChakra(
      <AppButton palette="brand">ブランドボタン</AppButton>
    );
    
    const button = screen.getByRole("button", { name: "ブランドボタン" });
    expect(button).toBeInTheDocument();
  });

  it("should render with different sizes", () => {
    const sizes: Array<"xs" | "sm" | "md" | "lg"> = ["xs", "sm", "md", "lg"];
    
    sizes.forEach((size) => {
      const { unmount } = renderWithChakra(
        <AppButton size={size}>{size}ボタン</AppButton>
      );
      
      const button = screen.getByRole("button", { name: `${size}ボタン` });
      expect(button).toBeInTheDocument();
      
      unmount();
    });
  });

  it("should render with different densities", () => {
    const densities: Array<"compact" | "comfortable"> = ["compact", "comfortable"];
    
    densities.forEach((density) => {
      const { unmount } = renderWithChakra(
        <AppButton density={density}>{density}ボタン</AppButton>
      );
      
      const button = screen.getByRole("button", { name: `${density}ボタン` });
      expect(button).toBeInTheDocument();
      
      unmount();
    });
  });

  it("should handle disabled state", () => {
    renderWithChakra(<AppButton disabled>無効ボタン</AppButton>);
    
    const button = screen.getByRole("button", { name: "無効ボタン" });
    expect(button).toBeDisabled();
  });

  it("should prefer Chakra props over component props", () => {
    renderWithChakra(
      <AppButton
        visual="outline"
        palette="brand"
        variant="solid"
        colorPalette="brand"
      >
        優先順位テスト
      </AppButton>
    );
    
    const button = screen.getByRole("button", { name: "優先順位テスト" });
    expect(button).toBeInTheDocument();
    // variant="solid" と colorPalette="brand" が優先されることを確認
    // (実際のスタイル検証は統合テストで行う)
  });

  it("should combine custom className with recipe className", () => {
    renderWithChakra(
      <AppButton className="custom-class">カスタムクラス</AppButton>
    );
    
    const button = screen.getByRole("button", { name: "カスタムクラス" });
    expect(button).toHaveClass("custom-class");
  });

  it("should support href prop for link usage", () => {
    renderWithChakra(
      <AppButton as="a" href="/test-link">
        リンクボタン
      </AppButton>
    );

    const link = screen.getByRole("link", { name: "リンクボタン" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test-link");
  });
});
