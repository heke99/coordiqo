export type CapacityInput = {
  startsAt: string
  endsAt: string
  breakMinutes?: number | null
  bufferMinutes?: number | null
  plannedMinutes?: number | null
}

export function minutesBetween(startsAt: string, endsAt: string) {
  const diff = new Date(endsAt).getTime() - new Date(startsAt).getTime()
  if (!Number.isFinite(diff)) return 0
  return Math.max(0, Math.round(diff / 60000))
}

export function calculateShiftCapacity(input: CapacityInput) {
  const totalMinutes = minutesBetween(input.startsAt, input.endsAt)
  const breakMinutes = Math.max(0, Number(input.breakMinutes ?? 0))
  const bufferMinutes = Math.max(0, Number(input.bufferMinutes ?? 0))
  const plannedMinutes = Math.max(0, Number(input.plannedMinutes ?? 0))
  const capacityMinutes = Math.max(0, totalMinutes - breakMinutes - bufferMinutes)
  return {
    totalMinutes,
    breakMinutes,
    bufferMinutes,
    capacityMinutes,
    plannedMinutes,
    remainingMinutes: Math.max(0, capacityMinutes - plannedMinutes),
  }
}
