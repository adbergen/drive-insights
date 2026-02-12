export function formatDate(isoString: string | null): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString()
}

export function friendlyMimeType(mimeType: string): string {
  return mimeType.replace('application/vnd.google-apps.', 'google-').split('/').pop() ?? mimeType
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
