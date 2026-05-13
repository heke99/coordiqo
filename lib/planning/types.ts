export type PlanningSourceType = 'manual' | 'planning_run' | 'template' | 'project' | 'ai_suggestion' | 'replan' | 'what_if'
export type PlanningConflictSeverity = 'info' | 'warning' | 'soft' | 'hard' | 'critical' | 'blocked'

export type PlanningTask = {
  id: string
  company_id: string
  task_type_id?: string | null
  entity_id?: string | null
  assigned_team_id?: string | null
  assigned_staff_id?: string | null
  title: string
  priority?: string | null
  status?: string | null
  time_window_start?: string | null
  time_window_end?: string | null
  scheduled_start?: string | null
  scheduled_end?: string | null
  estimated_duration_minutes?: number | null
  sla_due_at?: string | null
}

export type PlanningStaff = {
  id: string
  company_id: string
  full_name: string
  status?: string | null
  primary_team_id?: string | null
  transport_mode?: string | null
}

export type PlanningShift = {
  id: string
  company_id: string
  staff_profile_id?: string | null
  team_id?: string | null
  title?: string | null
  shift_date?: string | null
  starts_at: string
  ends_at: string
  status?: string | null
  capacity_minutes?: number | null
  planned_minutes?: number | null
  remaining_minutes?: number | null
  planning_locked?: boolean | null
  transport_mode?: string | null
}

export type PlanningRequirement = {
  id: string
  requirement_kind: string
  skill_id?: string | null
  certification_id?: string | null
  required_value?: string | null
  minimum_level?: string | null
  is_hard_requirement?: boolean | null
  description?: string | null
  skills?: { name?: string | null } | null
  certifications?: { name?: string | null } | null
}

export type StaffSkill = {
  id?: string
  staff_profile_id?: string | null
  skill_id: string
  level?: string | null
}

export type StaffCertification = {
  id?: string
  staff_profile_id?: string | null
  certification_id: string
  status?: string | null
  expires_at?: string | null
}

export type StaffAbsence = {
  id: string
  staff_profile_id: string
  starts_at: string
  ends_at: string
  reason?: string | null
}

export type ExistingAssignment = {
  id: string
  task_id?: string | null
  staff_profile_id?: string | null
  team_id?: string | null
  shift_id?: string | null
  planned_start_at: string
  planned_end_at: string
  status?: string | null
  is_locked?: boolean | null
}

export type CandidateScorePart = {
  scoreKey: string
  label: string
  points: number
  maxPoints?: number | null
  isBlocking?: boolean
  message?: string | null
  metadata?: Record<string, unknown>
}

export type PlanningConflict = {
  conflictType: string
  severity: PlanningConflictSeverity
  message: string
  details?: Record<string, unknown>
}

export type CandidateEvaluation = {
  score: number
  eligible: boolean
  rejectionReason: string | null
  explanation: string
  breakdown: CandidateScorePart[]
  conflicts: PlanningConflict[]
}

export type CandidateEvaluationInput = {
  task: PlanningTask
  staff?: PlanningStaff | null
  teamId?: string | null
  shift?: PlanningShift | null
  plannedStartAt: string
  plannedEndAt: string
  requirements: PlanningRequirement[]
  staffSkills: StaffSkill[]
  staffCertifications: StaffCertification[]
  absences: StaffAbsence[]
  existingAssignments: ExistingAssignment[]
  continuityMatch?: boolean
  areaMatch?: boolean
}
