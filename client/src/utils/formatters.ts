export function formatDate(isoString: string | null): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString()
}

export function friendlyMimeType(mimeType: string): string {
  return mimeType.replace('application/vnd.google-apps.', 'google-').split('/').pop() ?? mimeType
}
