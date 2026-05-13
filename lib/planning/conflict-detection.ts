import type { CandidateEvaluationInput, PlanningConflict, PlanningRequirement } from '@/lib/planning/types'

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime()
}

function isInsideWindow(start: string, end: string, windowStart?: string | null, windowEnd?: string | null) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const windowStartMs = windowStart ? new Date(windowStart).getTime() : null
  const windowEndMs = windowEnd ? new Date(windowEnd).getTime() : null

  if (windowStartMs !== null && startMs < windowStartMs) return false
  if (windowEndMs !== null && endMs > windowEndMs) return false
  return true
}

function requirementLabel(requirement: PlanningRequirement) {
  if (requirement.requirement_kind === 'skill') return requirement.skills?.name ?? requirement.description ?? 'kompetenskrav'
  if (requirement.requirement_kind === 'certification') return requirement.certifications?.name ?? requirement.description ?? 'certifikatkrav'
  return requirement.description ?? requirement.required_value ?? requirement.requirement_kind
}

function severityForRequirement(requirement: PlanningRequirement) {
  return requirement.is_hard_requirement === false ? 'soft' : 'hard'
}

export function detectCandidateConflicts(input: CandidateEvaluationInput): PlanningConflict[] {
  const conflicts: PlanningConflict[] = []
  const staffId = input.staff?.id ?? null
  const taskDuration = Math.max(1, Number(input.task.estimated_duration_minutes ?? 60))

  if (!input.task.entity_id) {
    conflicts.push({
      conflictType: 'missing_entity_or_address',
      severity: 'warning',
      message: 'Uppdraget saknar kopplat objekt/adress och kan inte ruttplaneras säkert.',
      details: { taskId: input.task.id },
    })
  }

  if (!input.staff && !input.teamId) {
    conflicts.push({
      conflictType: 'no_staff_or_team',
      severity: 'hard',
      message: 'Ingen personal eller team är vald för kandidaten.',
      details: { taskId: input.task.id },
    })
  }

  if (input.staff && input.staff.status && input.staff.status !== 'active') {
    conflicts.push({
      conflictType: 'staff_not_active',
      severity: 'hard',
      message: `${input.staff.full_name} är inte aktiv personal.`,
      details: { staffProfileId: input.staff.id, status: input.staff.status },
    })
  }

  if (!input.shift) {
    conflicts.push({
      conflictType: 'missing_shift',
      severity: 'hard',
      message: 'Personen saknar pass som täcker den planerade tiden.',
      details: { plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt },
    })
  } else {
    if (!isInsideWindow(input.plannedStartAt, input.plannedEndAt, input.shift.starts_at, input.shift.ends_at)) {
      conflicts.push({
        conflictType: 'outside_shift_time',
        severity: 'hard',
        message: 'Den planerade tiden ligger utanför valt pass.',
        details: { shiftId: input.shift.id, shiftStart: input.shift.starts_at, shiftEnd: input.shift.ends_at },
      })
    }

    if (input.shift.planning_locked) {
      conflicts.push({
        conflictType: 'locked_shift',
        severity: 'soft',
        message: 'Passet är planeringslåst och bör inte ändras utan override.',
        details: { shiftId: input.shift.id },
      })
    }

    const remaining = Number(input.shift.remaining_minutes ?? input.shift.capacity_minutes ?? 0)
    if (remaining < taskDuration) {
      conflicts.push({
        conflictType: 'shift_capacity_exceeded',
        severity: 'hard',
        message: `Passets kvarvarande kapacitet räcker inte. Behöver ${taskDuration} min, kvar ${Math.max(0, remaining)} min.`,
        details: { shiftId: input.shift.id, requiredMinutes: taskDuration, remainingMinutes: remaining },
      })
    }
  }

  if (!isInsideWindow(input.plannedStartAt, input.plannedEndAt, input.task.time_window_start, input.task.time_window_end)) {
    conflicts.push({
      conflictType: 'time_window_mismatch',
      severity: 'hard',
      message: 'Planerad tid matchar inte uppdragets tidsfönster.',
      details: { timeWindowStart: input.task.time_window_start, timeWindowEnd: input.task.time_window_end },
    })
  }

  if (staffId) {
    for (const absence of input.absences) {
      if (absence.staff_profile_id === staffId && overlaps(input.plannedStartAt, input.plannedEndAt, absence.starts_at, absence.ends_at)) {
        conflicts.push({
          conflictType: 'staff_absent',
          severity: 'hard',
          message: `${input.staff?.full_name ?? 'Personalen'} är frånvarande under denna tid.`,
          details: { absenceId: absence.id, reason: absence.reason ?? null, startsAt: absence.starts_at, endsAt: absence.ends_at },
        })
      }
    }

    for (const assignment of input.existingAssignments) {
      if (assignment.staff_profile_id !== staffId || assignment.task_id === input.task.id) continue
      if (!['draft', 'proposed', 'assigned', 'confirmed'].includes(assignment.status ?? 'assigned')) continue
      if (!overlaps(input.plannedStartAt, input.plannedEndAt, assignment.planned_start_at, assignment.planned_end_at)) continue

      conflicts.push({
        conflictType: assignment.is_locked ? 'locked_assignment_collision' : 'overlapping_assignment',
        severity: assignment.is_locked ? 'hard' : 'hard',
        message: assignment.is_locked ? 'Krockar med låst tilldelning.' : 'Krockar med annan tilldelning.',
        details: { assignmentId: assignment.id, startsAt: assignment.planned_start_at, endsAt: assignment.planned_end_at },
      })
    }
  }

  const skillSet = new Set(input.staffSkills.map((skill) => skill.skill_id))
  const today = new Date().toISOString().slice(0, 10)
  const certMap = new Map(input.staffCertifications.map((cert) => [cert.certification_id, cert]))

  for (const requirement of input.requirements) {
    const severity = severityForRequirement(requirement)
    const label = requirementLabel(requirement)

    if (requirement.requirement_kind === 'skill' && requirement.skill_id && !skillSet.has(requirement.skill_id)) {
      conflicts.push({
        conflictType: 'missing_skill',
        severity,
        message: `Saknar kompetens: ${label}.`,
        details: { requirementId: requirement.id, skillId: requirement.skill_id },
      })
    }

    if (requirement.requirement_kind === 'certification' && requirement.certification_id) {
      const cert = certMap.get(requirement.certification_id)
      if (!cert) {
        conflicts.push({
          conflictType: 'missing_certification',
          severity,
          message: `Saknar certifikat: ${label}.`,
          details: { requirementId: requirement.id, certificationId: requirement.certification_id },
        })
        continue
      }

      if (cert.status !== 'valid' || (cert.expires_at && cert.expires_at < today)) {
        conflicts.push({
          conflictType: 'expired_certification',
          severity,
          message: `Certifikat är inte giltigt: ${label}.`,
          details: { requirementId: requirement.id, certificationId: requirement.certification_id, status: cert.status ?? null, expiresAt: cert.expires_at ?? null },
        })
      }
    }

    if (requirement.requirement_kind === 'transport_mode' && requirement.required_value && input.staff?.transport_mode !== requirement.required_value) {
      conflicts.push({
        conflictType: 'transport_mode_mismatch',
        severity,
        message: `Färdsätt matchar inte kravet: ${requirement.required_value}.`,
        details: { requirementId: requirement.id, required: requirement.required_value, actual: input.staff?.transport_mode ?? null },
      })
    }

    if (requirement.requirement_kind === 'double_staffing') {
      conflicts.push({
        conflictType: 'double_staffing_not_verified',
        severity: severity === 'hard' ? 'soft' : severity,
        message: 'Dubbelbemanning behöver verifieras i planeringsutkastet.',
        details: { requirementId: requirement.id },
      })
    }
  }

  return conflicts
}

export function conflictLevel(conflicts: PlanningConflict[]) {
  if (conflicts.some((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))) return 'hard'
  if (conflicts.some((conflict) => conflict.severity === 'soft')) return 'soft'
  if (conflicts.some((conflict) => conflict.severity === 'warning')) return 'warning'
  if (conflicts.some((conflict) => conflict.severity === 'info')) return 'info'
  return 'none'
}
