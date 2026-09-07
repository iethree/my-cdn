import { createTheme, type MantineColorsTuple } from "@mantine/core";

// hsl(277, 98%, 50%) is shade 6; the rest step lightness up and down.
const plum: MantineColorsTuple = [
  "#f9f0ff",
  "#f1dcff",
  "#e3b8fe",
  "#d086fe",
  "#bc53fd",
  "#ac2bfd",
  "#9d03fc",
  "#8a02de",
  "#7702c0",
  "#6402a2",
];

const font = "Nunito, ui-rounded, system-ui, -apple-system, sans-serif";

export const theme = createTheme({
  primaryColor: "plum",
  colors: { plum },
  primaryShade: { light: 6, dark: 5 },
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
