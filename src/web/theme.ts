import { createTheme, type MantineColorsTuple } from "@mantine/core";
import { shadesFor } from "../shared/colors";

const font = "Nunito, ui-rounded, system-ui, -apple-system, sans-serif";

export function makeTheme(color: string) {
  return createTheme({
    primaryColor: "brand",
    colors: { brand: shadesFor(color) as unknown as MantineColorsTuple },
    primaryShade: { light: 6, dark: 5 },
    autoContrast: true,
    luminanceThreshold: 0.4,
    fontFamily: font,
    headings: { fontFamily: font, fontWeight: "800" },
    defaultRadius: "md",
    cursorType: "pointer",
    components: {
      Button: { defaultProps: { radius: "xl", fw: 800 } },
      Badge: { defaultProps: { radius: "sm", variant: "light", tt: "none", fw: 700 } },
      TextInput: { defaultProps: { radius: "md" } },
      TagsInput: { defaultProps: { radius: "md" } },
      Modal: { defaultProps: { radius: "lg", overlayProps: { blur: 2 } } },
    },
  });
}
