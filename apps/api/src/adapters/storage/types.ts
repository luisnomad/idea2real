export interface PresignedUrlResult {
  uploadUrl: string
  storageKey: string
  expiresAt: string
}

export interface StorageAdapter {
  createPresignedUploadUrl(key: string, mimeType: string): Promise<PresignedUrlResult>
  getDownloadUrl(storageKey: string): Promise<string>
}
