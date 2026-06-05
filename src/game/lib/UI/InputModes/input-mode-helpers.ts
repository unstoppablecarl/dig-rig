export function formatKeys(s: string): string {
  return s.replace(/\[([^\]]+)\]/g, (_, key: string) => {
    const label = key.length === 1 ? key.toUpperCase() : key
    return `<kbd>${label}</kbd>`
  })
}
