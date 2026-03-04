export interface FalGenerationResult {
  modelUrl: string
  format: string
  providerJobId: string
}

export interface FalAdapter {
  submitImageTo3D(imageUrl: string): Promise<{ providerJobId: string }>
  pollResult(providerJobId: string): Promise<FalGenerationResult | null>
}
