export type OptimizationJob = {
  id: string
  taskId?: string | null
  latitude?: number | null
  longitude?: number | null
  serviceSeconds?: number
  priority?: number
  timeWindowStart?: string | null
  timeWindowEnd?: string | null
}

export type OptimizationVehicle = {
  id: string
  staffProfileId?: string | null
  startLatitude?: number | null
  startLongitude?: number | null
  endLatitude?: number | null
  endLongitude?: number | null
  capacity?: number[]
}

export type VroomOptimizationRequest = {
  jobs: OptimizationJob[]
  vehicles: OptimizationVehicle[]
}

export type OptimizedStop = {
  jobId: string
  vehicleId: string | null
  stopOrder: number
  travelSeconds: number
  distanceMeters: number
  waitingSeconds: number
}

export type OptimizationResult = {
  provider: 'fallback' | 'vroom'
  status: 'completed' | 'failed'
  stops: OptimizedStop[]
  unassigned: Array<{ jobId: string; reason: string }>
  metrics: {
    totalTravelSeconds: number
    totalDistanceMeters: number
  }
  providerPayload?: unknown
}

function hasCoordinates(job: OptimizationJob) {
  return typeof job.latitude === 'number' && typeof job.longitude === 'number'
}

function timeWindowSortValue(job: OptimizationJob) {
  return job.timeWindowStart ?? job.timeWindowEnd ?? ''
}

export function createFallbackOptimization(input: VroomOptimizationRequest): OptimizationResult {
  const vehicle = input.vehicles[0] ?? null
  const assignable = input.jobs.filter(hasCoordinates)
  const unassigned = input.jobs
    .filter((job) => !hasCoordinates(job))
    .map((job) => ({ jobId: job.id, reason: 'missing_coordinates' }))

  const stops = [...assignable]
    .sort((a, b) => {
      const byWindow = timeWindowSortValue(a).localeCompare(timeWindowSortValue(b))
      if (byWindow !== 0) return byWindow
      return (b.priority ?? 0) - (a.priority ?? 0)
    })
    .map((job, index) => ({
      jobId: job.id,
      vehicleId: vehicle?.id ?? null,
      stopOrder: index + 1,
      travelSeconds: index === 0 ? 0 : 900,
      distanceMeters: index === 0 ? 0 : 5000,
      waitingSeconds: 0,
    }))

  return {
    provider: 'fallback',
    status: 'completed',
    stops,
    unassigned,
    metrics: {
      totalTravelSeconds: stops.reduce((sum, stop) => sum + stop.travelSeconds, 0),
      totalDistanceMeters: stops.reduce((sum, stop) => sum + stop.distanceMeters, 0),
    },
  }
}

export async function runVroomOptimization(input: VroomOptimizationRequest): Promise<OptimizationResult> {
  const endpoint = process.env.VROOM_API_URL
  if (!endpoint) return createFallbackOptimization(input)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    return {
      ...createFallbackOptimization(input),
      status: 'failed',
      provider: 'vroom',
      providerPayload: { status: response.status, body: await response.text() },
    }
  }

  const payload = await response.json()
  return {
    ...createFallbackOptimization(input),
    provider: 'vroom',
    providerPayload: payload,
  }
}

