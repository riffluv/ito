// GameCard一貫性テスト - FLAT vs FLIP VARIANTの整列統一を確保
import { render } from '@testing-library/react';
import { GameCard } from './GameCard';

describe('GameCard Consistency Tests', () => {
  const testCases = [
    { clue: "短い", description: "短いテキスト" },
    { clue: "中程度の長さテキスト", description: "中程度テキスト" },
    { clue: "非常に長い連想ワードのテキスト例", description: "長いテキスト" },
  ];

  testCases.forEach(({ clue, description }) => {
    it(`${description}でFLAT/FLIP VARIANTが同じスタイルを持つ`, () => {
      // FLAT VARIANT
      const { container: flatContainer } = render(
        <GameCard
          variant="flat"
          clue={clue}
          name="テストプレイヤー"
          index={0}
        />
      );

      // FLIP VARIANT (フロント面)
      const { container: flipContainer } = render(
        <GameCard
          variant="flip"
          flipped={false}
          clue={clue}
          name="テストプレイヤー"
          index={0}
        />
      );

      const flatTextElement = flatContainer.querySelector('[style*="translate(-50%, -50%)"]');
      const flipTextElement = flipContainer.querySelector('[style*="translate(-50%, -50%)"]');

      expect(flatTextElement).toBeTruthy();
      expect(flipTextElement).toBeTruthy();

      if (flatTextElement && flipTextElement) {
        const flatStyle = getComputedStyle(flatTextElement);
        const flipStyle = getComputedStyle(flipTextElement);

        // 🎯 重要: padding, width, alignment の統一性をテスト
        expect(flatStyle.padding).toBe(flipStyle.padding);
        expect(flatStyle.width).toBe(flipStyle.width);
        expect(flatStyle.display).toBe(flipStyle.display);
        expect(flatStyle.alignItems).toBe(flipStyle.alignItems);
        expect(flatStyle.justifyContent).toBe(flipStyle.justifyContent);
        expect(flatStyle.fontSize).toBe(flipStyle.fontSize);
        expect(flatStyle.lineHeight).toBe(flipStyle.lineHeight);
      }
    });
  });

  it('数字表示では両バリアント間でスタイル統一される', () => {
    const { container: flatContainer } = render(
      <GameCard
        variant="flat"
        number={42}
        name="テストプレイヤー"
        index={0}
      />
    );

    const { container: flipContainer } = render(
      <GameCard
        variant="flip"
        flipped={true}
        number={42}
        name="テストプレイヤー"
        index={0}
      />
    );

    const flatNumElement = flatContainer.querySelector('[style*="translate(-50%, -50%)"]');
    const flipNumElement = flipContainer.querySelector('[style*="translate(-50%, -50%)"]');

    expect(flatNumElement).toBeTruthy();
    expect(flipNumElement).toBeTruthy();

    if (flatNumElement && flipNumElement) {
      const flatStyle = getComputedStyle(flatNumElement);
      const flipStyle = getComputedStyle(flipNumElement);

      expect(flatStyle.fontSize).toBe(flipStyle.fontSize);
      expect(flatStyle.textAlign).toBe(flipStyle.textAlign);
      expect(flatStyle.fontWeight).toBe(flipStyle.fontWeight);
    }
  });
});