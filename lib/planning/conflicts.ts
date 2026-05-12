export type AvailabilityConflictInput = {
  shiftId?: string | null
  staffProfileId?: string | null
  teamId?: string | null
  conflictType: string
  severity?: 'info' | 'warning' | 'critical'
  message: string
  details?: Record<string, unknown>
}

export function buildAvailabilityConflict(input: AvailabilityConflictInput) {
  return {
    shift_id: input.shiftId ?? null,
    staff_profile_id: input.staffProfileId ?? null,
    team_id: input.teamId ?? null,
    conflict_type: input.conflictType,
    severity: input.severity ?? 'warning',
    status: 'open',
    message: input.message,
    details: input.details ?? {},
  }
}
