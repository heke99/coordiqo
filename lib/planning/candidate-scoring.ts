import { conflictLevel, detectCandidateConflicts } from '@/lib/planning/conflict-detection'
import type { CandidateEvaluation, CandidateEvaluationInput, CandidateScorePart } from '@/lib/planning/types'

const DEFAULT_SCORING_WEIGHTS = {
  availability: 30,
  skillMatch: 25,
  certificationMatch: 25,
  validCertificate: 15,
  capacity: 20,
  timeWindow: 20,
  continuity: 15,
  areaMatch: 10,
  softConflict: -10,
  overload: -25,
} as const

function hasHardBlock(conflicts: ReturnType<typeof detectCandidateConflicts>) {
  return conflicts.some((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))
}

function hasConflict(conflicts: ReturnType<typeof detectCandidateConflicts>, type: string) {
  return conflicts.some((conflict) => conflict.conflictType === type)
}

function scorePart(scoreKey: string, label: string, points: number, message?: string | null, isBlocking = false): CandidateScorePart {
  return { scoreKey, label, points, maxPoints: points > 0 ? points : null, message: message ?? null, isBlocking }
}

export function evaluateCandidate(input: CandidateEvaluationInput): CandidateEvaluation {
  const conflicts = detectCandidateConflicts(input)
  const hardBlocked = hasHardBlock(conflicts)
  const breakdown: CandidateScorePart[] = []

  if (!hasConflict(conflicts, 'staff_absent') && input.shift) {
    breakdown.push(scorePart('availability', 'Tillgänglig personal', DEFAULT_SCORING_WEIGHTS.availability, 'Personen har pass och ingen frånvaro som krockar.'))
  } else {
    breakdown.push(scorePart('availability', 'Tillgänglig personal', 0, 'Tillgänglighet saknas eller krockar.', hasConflict(conflicts, 'staff_absent') || hasConflict(conflicts, 'missing_shift')))
  }

  const skillRequirements = input.requirements.filter((requirement) => requirement.requirement_kind === 'skill' && requirement.skill_id)
  const missingSkill = conflicts.some((conflict) => conflict.conflictType === 'missing_skill')
  if (skillRequirements.length === 0) {
    breakdown.push(scorePart('skill_match', 'Rätt kompetens', DEFAULT_SCORING_WEIGHTS.skillMatch, 'Inga specifika kompetenskrav finns.'))
  } else if (!missingSkill) {
    breakdown.push(scorePart('skill_match', 'Rätt kompetens', DEFAULT_SCORING_WEIGHTS.skillMatch, 'Alla kompetenskrav matchar.'))
  } else {
    breakdown.push(scorePart('skill_match', 'Rätt kompetens', 0, 'Ett eller flera kompetenskrav saknas.', conflicts.some((conflict) => conflict.conflictType === 'missing_skill' && conflict.severity === 'hard')))
  }

  const certRequirements = input.requirements.filter((requirement) => requirement.requirement_kind === 'certification' && requirement.certification_id)
  const missingCert = conflicts.some((conflict) => ['missing_certification', 'expired_certification'].includes(conflict.conflictType))
  if (certRequirements.length === 0) {
    breakdown.push(scorePart('certification_match', 'Rätt certifikat', DEFAULT_SCORING_WEIGHTS.certificationMatch, 'Inga specifika certifikatkrav finns.'))
    breakdown.push(scorePart('valid_certificate', 'Certifikat giltigt', DEFAULT_SCORING_WEIGHTS.validCertificate, 'Inga certifikat med utgångsdatum behöver kontrolleras.'))
  } else if (!missingCert) {
    breakdown.push(scorePart('certification_match', 'Rätt certifikat', DEFAULT_SCORING_WEIGHTS.certificationMatch, 'Alla certifikatkrav matchar.'))
    breakdown.push(scorePart('valid_certificate', 'Certifikat giltigt', DEFAULT_SCORING_WEIGHTS.validCertificate, 'Certifikaten är giltiga.'))
  } else {
    breakdown.push(scorePart('certification_match', 'Rätt certifikat', 0, 'Certifikat saknas eller är inte giltigt.', conflicts.some((conflict) => ['missing_certification', 'expired_certification'].includes(conflict.conflictType) && conflict.severity === 'hard')))
    breakdown.push(scorePart('valid_certificate', 'Certifikat giltigt', 0, 'Certifikat behöver åtgärdas.'))
  }

  if (!hasConflict(conflicts, 'shift_capacity_exceeded') && input.shift) {
    breakdown.push(scorePart('capacity', 'Tillräcklig kapacitet', DEFAULT_SCORING_WEIGHTS.capacity, `Passet har ${input.shift.remaining_minutes ?? input.shift.capacity_minutes ?? 0} minuter kvar.`))
  } else if (hasConflict(conflicts, 'shift_capacity_exceeded')) {
    breakdown.push(scorePart('capacity', 'Tillräcklig kapacitet', DEFAULT_SCORING_WEIGHTS.overload, 'Passets kapacitet överskrids.', true))
  }

  if (!hasConflict(conflicts, 'time_window_mismatch') && !hasConflict(conflicts, 'outside_shift_time')) {
    breakdown.push(scorePart('time_window', 'Matchar tidsfönster', DEFAULT_SCORING_WEIGHTS.timeWindow, 'Planerad tid matchar tidsfönster och pass.'))
  } else {
    breakdown.push(scorePart('time_window', 'Matchar tidsfönster', 0, 'Planerad tid matchar inte tidsfönster eller pass.', true))
  }

  if (input.continuityMatch) {
    breakdown.push(scorePart('continuity', 'Kontinuitet', DEFAULT_SCORING_WEIGHTS.continuity, 'Person/team matchar tidigare eller önskad kontinuitet.'))
  }

  if (input.areaMatch || (input.task.assigned_team_id && input.staff?.primary_team_id === input.task.assigned_team_id)) {
    breakdown.push(scorePart('area_match', 'Rätt team/område', DEFAULT_SCORING_WEIGHTS.areaMatch, 'Personen matchar uppdragets team/område.'))
  }

  const softConflictCount = conflicts.filter((conflict) => ['soft', 'warning'].includes(conflict.severity)).length
  if (softConflictCount > 0) {
    breakdown.push(scorePart('soft_conflict', 'Mjuka konflikter', DEFAULT_SCORING_WEIGHTS.softConflict * softConflictCount, `${softConflictCount} mjuk varning behöver granskas.`))
  }

  const score = breakdown.reduce((sum, part) => sum + part.points, 0)
  const eligible = !hardBlocked
  const rejectionReason = eligible ? null : conflicts.find((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))?.message ?? 'Hård konflikt blockerar kandidaten.'
  const staffName = input.staff?.full_name ?? 'Valt team'
  const level = conflictLevel(conflicts)
  const explanation = eligible
    ? `${staffName} föreslås med score ${score}. ${level === 'none' ? 'Inga konflikter hittades.' : 'Varningar finns och behöver granskas.'}`
    : `${staffName} valdes bort: ${rejectionReason}`

  return { score, eligible, rejectionReason, explanation, breakdown, conflicts }
}
