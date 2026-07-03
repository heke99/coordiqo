import {
  getIndustryProfile,
  type IndustryProfile,
  type OnboardingTemplateStep,
} from '@/lib/industry/registry'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type OnboardingSessionRow = {
  id: string
  company_id: string
  status: string
  current_step: string | null
  completed_steps: string[] | null
  settings: Record<string, unknown> | null
  completed_at: string | null
}

export type OnboardingStepStatus = {
  step: OnboardingTemplateStep
  done: boolean
  /** Marked done automatically because the underlying data already exists. */
  autoDetected: boolean
  /** Marked done manually by a user. */
  manuallyMarked: boolean
}

export type OnboardingProgress = {
  profile: IndustryProfile
  session: OnboardingSessionRow | null
  steps: OnboardingStepStatus[]
  requiredRemaining: OnboardingStepStatus[]
  completedCount: number
  totalCount: number
  isComplete: boolean
}

/**
 * Steps that are considered done automatically when the company already has
 * the corresponding data — so companies never re-do work they already did.
 */
async function detectAutoCompletedSteps(companyId: string): Promise<Set<string>> {
  const [teams, staff, entities, taskTypes, resources, runtimeConfig] = await Promise.all([
    supabaseAdmin.from('teams').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('entities').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('task_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('resource_assets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('industry_runtime_configs').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ])

  const auto = new Set<string>()
  auto.add('company_information')
  if (Number(runtimeConfig.count ?? 0) > 0) auto.add('industry_model')
  if (Number(teams.count ?? 0) > 0) auto.add('team_roles')
  if (Number(staff.count ?? 0) > 0) auto.add('staff')
  if (Number(entities.count ?? 0) > 0) auto.add('entities')
  if (Number(taskTypes.count ?? 0) > 0) auto.add('task_types')
  if (Number(resources.count ?? 0) > 0) auto.add('resources')
  return auto
}

export async function getOnboardingProgress(
  companyId: string,
  industryCode: string | null | undefined,
): Promise<OnboardingProgress> {
  const [profile, sessionResult, autoCompleted] = await Promise.all([
    getIndustryProfile(industryCode),
    supabaseAdmin
      .from('company_onboarding_sessions')
      .select('id, company_id, status, current_step, completed_steps, settings, completed_at')
      .eq('company_id', companyId)
      .maybeSingle(),
    detectAutoCompletedSteps(companyId),
  ])

  const session = (sessionResult.data ?? null) as OnboardingSessionRow | null
  const manuallyCompleted = new Set(session?.completed_steps ?? [])
  const sessionCompleted = session?.status === 'completed'

  const steps: OnboardingStepStatus[] = profile.onboardingTemplate.map((step) => {
    const manuallyMarked = manuallyCompleted.has(step.key)
    const autoDetected = autoCompleted.has(step.key)
    const done = sessionCompleted || manuallyMarked || (step.key === 'finish' ? sessionCompleted : autoDetected)
    return { step, done, autoDetected, manuallyMarked }
  })

  const requiredRemaining = steps.filter((status) => status.step.required && !status.done && status.step.key !== 'finish')
  const completedCount = steps.filter((status) => status.done).length

  return {
    profile,
    session,
    steps,
    requiredRemaining,
    completedCount,
    totalCount: steps.length,
    isComplete: Boolean(sessionCompleted),
  }
}
