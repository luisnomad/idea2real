import type { GenerationStatus, JobStatus, JobType, AssetKind } from '@idea2real/contracts'

export interface StoredAsset {
  id: string
  userId: string
  kind: AssetKind
  mimeType: string
  storageKey: string
  fileSizeBytes: number
  parentId?: string
  createdAt: string
  updatedAt: string
}

export interface StoredGeneration {
  id: string
  promptId: string
  userId: string
  status: GenerationStatus
  provider: string
  providerJobId?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  artifacts: string[] // asset IDs
}

export interface StoredJob {
  id: string
  userId: string
  type: JobType
  status: JobStatus
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  errorMessage?: string
  progress?: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// In-memory MVP stores — replace with Drizzle/Postgres later
const assets = new Map<string, StoredAsset>()
const generations = new Map<string, StoredGeneration>()
const jobs = new Map<string, StoredJob>()

export const assetStore = {
  get: (id: string) => assets.get(id),
  set: (id: string, asset: StoredAsset) => assets.set(id, asset),
  list: () => [...assets.values()],
  clear: () => assets.clear(),
}

export const generationStore = {
  get: (id: string) => generations.get(id),
  set: (id: string, gen: StoredGeneration) => generations.set(id, gen),
  list: () => [...generations.values()],
  clear: () => generations.clear(),
}

export const jobStore = {
  get: (id: string) => jobs.get(id),
  set: (id: string, job: StoredJob) => jobs.set(id, job),
  list: () => [...jobs.values()],
  clear: () => jobs.clear(),
}
