/** Check signatures before passing untrusted bytes to a native image decoder. */
export function isSupportedRasterSignature(bytes: Uint8Array, declaredType: string) {
  const startsWith = (prefix: number[]) => bytes.length >= prefix.length
    && prefix.every((value, index) => bytes[index] === value);
  if (declaredType === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (declaredType === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (declaredType === "image/webp") {
    return bytes.length >= 12 && startsWith([0x52, 0x49, 0x46, 0x46])
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}
