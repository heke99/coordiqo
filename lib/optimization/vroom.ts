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

type VroomJobMapping = Map<number, OptimizationJob>
type VroomVehicleMapping = Map<number, OptimizationVehicle>
type VroomStep = { type?: string; job?: number; duration?: number; arrival?: number; distance?: number; waiting_time?: number }
type VroomRoute = { vehicle?: number; steps?: VroomStep[] }
type VroomUnassigned = { id?: number; description?: string }
type VroomResponse = {
  routes?: VroomRoute[]
  unassigned?: VroomUnassigned[]
  summary?: { distance?: number; duration?: number }
}

function hasCoordinates(job: OptimizationJob) {
  return typeof job.latitude === 'number' && typeof job.longitude === 'number'
}

function timeWindowSortValue(job: OptimizationJob) {
  return job.timeWindowStart ?? job.timeWindowEnd ?? ''
}

function toUnixSeconds(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor(date.getTime() / 1000)
}

function buildVroomPayload(input: VroomOptimizationRequest) {
  const jobMapping: VroomJobMapping = new Map()
  const vehicleMapping: VroomVehicleMapping = new Map()
  const jobs = input.jobs
    .filter(hasCoordinates)
    .map((job, index) => {
      const id = index + 1
      jobMapping.set(id, job)
      const start = toUnixSeconds(job.timeWindowStart)
      const end = toUnixSeconds(job.timeWindowEnd)
      return {
        id,
        location: [job.longitude, job.latitude],
        service: job.serviceSeconds ?? 1800,
        priority: Math.max(0, Math.min(100, job.priority ?? 50)),
        ...(start && end ? { time_windows: [[start, end]] } : {}),
      }
    })
  const vehicles = input.vehicles.map((vehicle, index) => {
    const id = index + 1
    vehicleMapping.set(id, vehicle)
    return {
      id,
      ...(typeof vehicle.startLatitude === 'number' && typeof vehicle.startLongitude === 'number' ? { start: [vehicle.startLongitude, vehicle.startLatitude] } : {}),
      ...(typeof vehicle.endLatitude === 'number' && typeof vehicle.endLongitude === 'number' ? { end: [vehicle.endLongitude, vehicle.endLatitude] } : {}),
      ...(vehicle.capacity?.length ? { capacity: vehicle.capacity } : {}),
    }
  })
  return { payload: { jobs, vehicles }, jobMapping, vehicleMapping }
}

function parseVroomResult(payload: VroomResponse, input: VroomOptimizationRequest, jobMapping: VroomJobMapping, vehicleMapping: VroomVehicleMapping): OptimizationResult {
  const stops: OptimizedStop[] = []
  for (const route of payload?.routes ?? []) {
    const vehicle = vehicleMapping.get(Number(route.vehicle))
    let order = 0
    for (const step of route.steps ?? []) {
      if (step.type !== 'job') continue
      order += 1
      const job = jobMapping.get(Number(step.job))
      if (!job) continue
      stops.push({
        jobId: job.id,
        vehicleId: vehicle?.id ?? null,
        stopOrder: order,
        travelSeconds: Math.round(step.duration ?? step.arrival ?? 0),
        distanceMeters: Math.round(step.distance ?? 0),
        waitingSeconds: Math.round(step.waiting_time ?? 0),
      })
    }
  }
  const unassigned = (payload?.unassigned ?? []).map((item) => {
    const job = jobMapping.get(Number(item.id))
    return { jobId: job?.id ?? String(item.id), reason: item.description ?? 'unassigned' }
  })
  const fallbackUnassigned = input.jobs.filter((job) => !hasCoordinates(job)).map((job) => ({ jobId: job.id, reason: 'missing_coordinates' }))
  return {
    provider: 'vroom',
    status: 'completed',
    stops,
    unassigned: [...unassigned, ...fallbackUnassigned],
    metrics: {
      totalDistanceMeters: Math.round(payload?.summary?.distance ?? stops.reduce((sum, stop) => sum + stop.distanceMeters, 0)),
      totalTravelSeconds: Math.round(payload?.summary?.duration ?? stops.reduce((sum, stop) => sum + stop.travelSeconds, 0)),
    },
    providerPayload: payload,
  }
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
  const apiKey = process.env.VROOM_API_KEY
  if (!endpoint) return createFallbackOptimization(input)

  try {
    const { payload: vroomPayload, jobMapping, vehicleMapping } = buildVroomPayload(input)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey, authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(vroomPayload),
    })

    if (!response.ok) {
      return {
        ...createFallbackOptimization(input),
        status: 'failed',
        provider: 'vroom',
        providerPayload: { status: response.status, body: await response.text() },
      }
    }

    const payload = await response.json().catch(async () => ({ body: await response.text().catch(() => '') })) as VroomResponse
    return parseVroomResult(payload, input, jobMapping, vehicleMapping)
  } catch (error) {
    return {
      ...createFallbackOptimization(input),
      status: 'failed',
      provider: 'vroom',
      providerPayload: { error: error instanceof Error ? error.message : 'Den externa optimeringstjänsten kunde inte nås.' },
    }
  }
}

