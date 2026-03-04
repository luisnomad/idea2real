import type { StorageAdapter } from './types.js'

export function createStubStorageAdapter(): StorageAdapter {
  return {
    async createPresignedUploadUrl(key: string, _mimeType: string) {
      return {
        uploadUrl: `http://localhost:9000/idea2real-assets/${key}?presigned=true`,
        storageKey: key,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }
    },

    async getDownloadUrl(storageKey: string) {
      return `http://localhost:9000/idea2real-assets/${storageKey}?download=true`
    },
  }
}
