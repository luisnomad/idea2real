import type { FalAdapter, FalGenerationResult } from './types.js'

/**
 * Stub fal.ai adapter for development and testing.
 * Simulates a generation that completes after a fixed delay.
 */
export function createStubFalAdapter(): FalAdapter {
  const pendingJobs = new Map<string, { startedAt: number }>()

  return {
    async submitImageTo3D(_imageUrl: string) {
      const providerJobId = `fal_stub_${crypto.randomUUID().slice(0, 8)}`
      pendingJobs.set(providerJobId, { startedAt: Date.now() })
      return { providerJobId }
    },

    async pollResult(providerJobId: string): Promise<FalGenerationResult | null> {
      const job = pendingJobs.get(providerJobId)
      if (!job) return null

      // Simulate 3s processing time
      const elapsed = Date.now() - job.startedAt
      if (elapsed < 3000) return null

      pendingJobs.delete(providerJobId)
      return {
        modelUrl: `https://fal-stub.example.com/models/${providerJobId}.glb`,
        format: 'glb',
        providerJobId,
      }
    },
  }
}
