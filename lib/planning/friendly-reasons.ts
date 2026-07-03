/**
 * Standardized customer-facing Swedish reasons for why planning could not
 * assign work. Raw algorithm/provider codes must never be shown to customers.
 */

export const PLANNING_REASON_LABELS: Record<string, string> = {
  // Staff availability
  no_staff_or_team: 'Ingen tillgänglig personal',
  no_candidates: 'Ingen tillgänglig personal',
  missing_shift: 'Ingen tillgänglig personal',
  staff_not_active: 'Ingen tillgänglig personal',
  staff_absent: 'Personal frånvarande',
  unassigned: 'Ingen tillgänglig personal',
  no_vehicle: 'Fordonet har inte kapacitet',

  // Competence
  missing_skill: 'Saknar kompetens',
  missing_certification: 'Saknar certifikat',
  expired_certification: 'Saknar giltigt certifikat',

  // Resources and capacity
  missing_resource: 'Saknar nödvändig resurs',
  resource_unavailable: 'Saknar nödvändig resurs',
  resource_conflict: 'Saknar nödvändig resurs',
  shift_capacity_exceeded: 'Kapaciteten räcker inte',
  vehicle_capacity_exceeded: 'Fordonet har inte kapacitet',
  capacity: 'Fordonet har inte kapacitet',

  // Time
  time_window_mismatch: 'Utanför tidsfönster',
  outside_shift_time: 'Utanför tidsfönster',
  time_window: 'Utanför tidsfönster',
  travel_time_exceeded: 'För lång restid',

  // Collisions and locks
  overlapping_assignment: 'Dubbelbokning',
  double_booking: 'Dubbelbokning',
  locked_assignment_collision: 'Uppdraget är låst',
  locked_shift: 'Passet är låst',

  // Data quality
  missing_entity_or_address: 'Adress saknas',
  missing_address: 'Adress saknas',
  missing_coordinates: 'Adress saknas',

  // Providers
  routing_unavailable: 'Ruttjänsten är tillfälligt otillgänglig',
  provider_error: 'Ruttjänsten är tillfälligt otillgänglig',

  // Softer signals
  team_mismatch: 'Utanför team/område',
  transport_mode_mismatch: 'Färdsätt matchar inte kravet',
  double_staffing_not_verified: 'Dubbelbemanning behöver verifieras',
}

/**
 * Maps a conflict/reason code (and optional stored message) to a friendly
 * Swedish reason. Stored Swedish messages pass through when no code matches.
 */
export function friendlyPlanningReason(code: string | null | undefined, storedMessage?: string | null): string {
  if (code && PLANNING_REASON_LABELS[code]) return PLANNING_REASON_LABELS[code]
  if (storedMessage && storedMessage.trim() !== '') return storedMessage
  return 'Uppdraget kunde inte planeras automatiskt. Granska underlaget eller tilldela manuellt.'
}
