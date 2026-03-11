export function maskSecret(value: string): string {
  if (value.length === 0) {
    return '';
  }

  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }

  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}
