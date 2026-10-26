/** يحوّل لون hex (#rrggbb) لـ rgba(...) بشفافية محددة. بيرجّع اللون زي ما هو لو مش hex. */
export function colorWithAlpha(color: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
