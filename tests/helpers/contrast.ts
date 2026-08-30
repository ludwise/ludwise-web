const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Unsupported colour: ${hex}`);

  const digits = hex.slice(1);
  const expanded =
    digits.length === 3 ? [...digits].map((digit) => `${digit}${digit}`).join('') : digits;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function cssColorToHex(value: string): string {
  const hex = value.trim();
  if (HEX_COLOR.test(hex)) return hex;

  const match = hex.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/iu,
  );
  if (match === null || (match[4] !== undefined && Number.parseFloat(match[4]) !== 1)) {
    throw new Error(`Unsupported CSS colour: ${value}`);
  }

  return `#${match
    .slice(1, 4)
    .map((component) => Number.parseInt(component, 10).toString(16).padStart(2, '0'))
    .join('')}`;
}
