export const scaleForDpi = (value: string): string =>
  `calc(${value} * var(--dpi-scale))`;

