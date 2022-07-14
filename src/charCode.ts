export function isCharPrintable(char: string): boolean {
  if (char.length !== 1) {
    throw new Error('isCharPrintable only accepts single characters');
  }
  return isCodePrintable(char.charCodeAt(0));
}

export function isCodePrintable(code: number): boolean {
  return (
    code === 0x0A || // new line
    code >= 0x20 && code <= 0x7E // alpha ascii
  )
}
