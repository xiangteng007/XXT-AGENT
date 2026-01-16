export function isoNowTaipei(): string {
  // ISO in +08:00
  const d = new Date();
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  const t = new Date(d.getTime() + tzOffsetMs);
  // Return ISO-like without Z, append +08:00
  const iso = t.toISOString().replace("Z", "");
  return `${iso}+08:00`;
}
