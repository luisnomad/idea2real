import { describe, it, expectTypeOf } from 'vitest'
import type {
  ErrorEnvelope,
  HealthResponse,
  User,
  Prompt,
  PrintTech,
  Generation,
  GenerationStatus,
  Model,
  ModelFormat,
  Asset,
  AssetKind,
  Job,
  JobType,
  JobStatus,
  CleanupRequest,
  CleanupResponse,
  CleanupResult,
  CleanupOperation,
} from '../index.js'

describe('Generated types compile correctly', () => {
  it('ErrorEnvelope has error.code and error.message', () => {
    expectTypeOf<ErrorEnvelope>().toHaveProperty('error')
    expectTypeOf<ErrorEnvelope['error']>().toHaveProperty('code')
    expectTypeOf<ErrorEnvelope['error']>().toHaveProperty('message')
  })

  it('HealthResponse has status and version', () => {
    expectTypeOf<HealthResponse>().toHaveProperty('status')
    expectTypeOf<HealthResponse>().toHaveProperty('version')
  })

  it('User has id, email, displayName, timestamps', () => {
    expectTypeOf<User>().toHaveProperty('id')
    expectTypeOf<User>().toHaveProperty('email')
    expectTypeOf<User>().toHaveProperty('displayName')
    expectTypeOf<User>().toHaveProperty('createdAt')
    expectTypeOf<User>().toHaveProperty('updatedAt')
  })

  it('Prompt has printTech as PrintTech enum', () => {
    expectTypeOf<Prompt>().toHaveProperty('printTech')
    expectTypeOf<Prompt['printTech']>().toEqualTypeOf<PrintTech>()
  })

  it('Generation has status as GenerationStatus enum', () => {
    expectTypeOf<Generation>().toHaveProperty('status')
    expectTypeOf<Generation['status']>().toEqualTypeOf<GenerationStatus>()
  })

  it('Model has format as ModelFormat enum', () => {
    expectTypeOf<Model>().toHaveProperty('format')
    expectTypeOf<Model['format']>().toEqualTypeOf<ModelFormat>()
  })

  it('Asset has kind as AssetKind enum', () => {
    expectTypeOf<Asset>().toHaveProperty('kind')
    expectTypeOf<Asset['kind']>().toEqualTypeOf<AssetKind>()
  })

  it('Job has type as JobType and status as JobStatus', () => {
    expectTypeOf<Job>().toHaveProperty('type')
    expectTypeOf<Job['type']>().toEqualTypeOf<JobType>()
    expectTypeOf<Job>().toHaveProperty('status')
    expectTypeOf<Job['status']>().toEqualTypeOf<JobStatus>()
  })

  it('CleanupRequest has operations array of CleanupOperation', () => {
    expectTypeOf<CleanupRequest>().toHaveProperty('operations')
    expectTypeOf<CleanupRequest['operations']>().toEqualTypeOf<CleanupOperation[]>()
  })

  it('CleanupResponse has jobId and status', () => {
    expectTypeOf<CleanupResponse>().toHaveProperty('jobId')
    expectTypeOf<CleanupResponse>().toHaveProperty('status')
  })

  it('CleanupResult has mesh metadata', () => {
    expectTypeOf<CleanupResult>().toHaveProperty('vertexCount')
    expectTypeOf<CleanupResult>().toHaveProperty('faceCount')
    expectTypeOf<CleanupResult>().toHaveProperty('isManifold')
    expectTypeOf<CleanupResult>().toHaveProperty('isWatertight')
  })
})
