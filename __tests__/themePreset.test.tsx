import {
  ThemePresetProvider,
  useThemePresets,
} from "@/context/ThemePresetContext";
import { render, screen } from "@testing-library/react";
import React from "react";

function ActiveName() {
  const { active } = useThemePresets();
  return <span data-testid="active-name">{active?.name}</span>;
}

describe("ThemePresetContext", () => {
  test("default active preset is first (default)", () => {
    render(
      <ThemePresetProvider>
        <ActiveName />
      </ThemePresetProvider>
    );
    expect(screen.getByTestId("active-name").textContent).toBe("default");
  });

  test("setActiveByName switches active", () => {
    function Switcher() {
      const { setActiveByName } = useThemePresets();
      React.useEffect(() => {
        setActiveByName("warm");
      }, [setActiveByName]);
      return <ActiveName />;
    }
    render(
      <ThemePresetProvider>
        <Switcher />
      </ThemePresetProvider>
    );
    expect(screen.getByTestId("active-name").textContent).toBe("warm");
  });

  test("registerPreset adds new preset and can activate", () => {
    function Register() {
      const { registerPreset, setActiveByName } = useThemePresets();
      React.useEffect(() => {
        registerPreset({ name: "test-preset", description: "Test" });
        setActiveByName("test-preset");
      }, [registerPreset, setActiveByName]);
      return <ActiveName />;
    }
    render(
      <ThemePresetProvider>
        <Register />
      </ThemePresetProvider>
    );
    expect(screen.getByTestId("active-name").textContent).toBe("test-preset");
  });
});
