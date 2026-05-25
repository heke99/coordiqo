import type { CandidateEvaluation, PlanningConflict, PlanningConflictSeverity } from '@/lib/planning/types'

export type PlanningSeverityBucket = 'blocking' | 'warning' | 'info'

export type PlanningRiskSummary = {
  riskScore: number
  blockingCount: number
  warningCount: number
  infoCount: number
  conflictCount: number
  canPublishWithoutOverride: boolean
  requiresOverride: boolean
  highestSeverity: PlanningConflictSeverity | 'none'
  summary: string
}

const BLOCKING_SEVERITIES = new Set<PlanningConflictSeverity>(['hard', 'critical', 'blocked'])
const WARNING_SEVERITIES = new Set<PlanningConflictSeverity>(['soft', 'warning'])

export function isBlockingSeverity(severity: string | null | undefined) {
  return severity ? BLOCKING_SEVERITIES.has(severity as PlanningConflictSeverity) : false
}

export function isWarningSeverity(severity: string | null | undefined) {
  return severity ? WARNING_SEVERITIES.has(severity as PlanningConflictSeverity) : false
}

export function requiresConflictOverride(conflicts: Pick<PlanningConflict, 'severity'>[]) {
  return conflicts.some((conflict) => isBlockingSeverity(conflict.severity) || isWarningSeverity(conflict.severity))
}

export function summarizePlanningConflicts(conflicts: Pick<PlanningConflict, 'severity' | 'message' | 'conflictType'>[]): PlanningRiskSummary {
  const blockingCount = conflicts.filter((conflict) => isBlockingSeverity(conflict.severity)).length
  const warningCount = conflicts.filter((conflict) => isWarningSeverity(conflict.severity)).length
  const infoCount = conflicts.filter((conflict) => conflict.severity === 'info').length
  const conflictCount = conflicts.length

  const riskScore = Math.min(100, Math.max(0, blockingCount * 35 + warningCount * 12 + infoCount * 4))
  const highestSeverity: PlanningRiskSummary['highestSeverity'] = blockingCount
    ? 'hard'
    : warningCount
      ? 'warning'
      : infoCount
        ? 'info'
        : 'none'

  const parts: string[] = []
  if (blockingCount) parts.push(`${blockingCount} blockerande`)
  if (warningCount) parts.push(`${warningCount} varning${warningCount === 1 ? '' : 'ar'}`)
  if (infoCount) parts.push(`${infoCount} info`)

  return {
    riskScore,
    blockingCount,
    warningCount,
    infoCount,
    conflictCount,
    canPublishWithoutOverride: blockingCount === 0,
    requiresOverride: blockingCount > 0 || warningCount > 0,
    highestSeverity,
    summary: parts.length ? parts.join(' · ') : 'Inga konflikter',
  }
}

export function summarizeCandidateEvaluation(evaluation: CandidateEvaluation): PlanningRiskSummary {
  return summarizePlanningConflicts(evaluation.conflicts)
}

export function overrideMetadata(params: {
  reason: string
  actorUserId: string
  approvedAt?: string
  conflictSummary: PlanningRiskSummary
}) {
  return {
    conflictOverride: true,
    overrideReason: params.reason,
    overrideApprovedBy: params.actorUserId,
    overrideApprovedAt: params.approvedAt ?? new Date().toISOString(),
    conflictSummary: params.conflictSummary,
  }
}
