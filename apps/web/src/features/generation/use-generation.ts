import { useQuery } from '@tanstack/react-query'
import { getGeneration, getJob } from './api'

export function useGenerationDetail(generationId: string | null) {
  return useQuery({
    queryKey: ['generation', generationId],
    queryFn: () => getGeneration(generationId!),
    enabled: !!generationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'succeeded' || status === 'failed') return false
      return 2_000 // poll every 2s while processing
    },
  })
}

export function useJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'succeeded' || status === 'failed' || status === 'cancelled') return false
      return 2_000
    },
  })
}
