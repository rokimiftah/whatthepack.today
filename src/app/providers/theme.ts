import type { MantineColorsTuple } from "@mantine/core";

import { createTheme } from "@mantine/core";

// src/app/providers/theme.ts

const brand: MantineColorsTuple = [
  "#f3f8ff",
  "#e1edff",
  "#caddff",
  "#adc8ff",
  "#8eb1ff",
  "#769fff",
  "#648fff",
  "#5276df",
  "#425fba",
  "#30468c",
];

export const appTheme = createTheme({
  colors: {
    brand,
  },
  primaryColor: "brand",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.25rem",
  },
  primaryShade: {
    light: 6,
    dark: 5,
  },
});
