import { supabaseAdmin } from '@/lib/supabase/admin'

export type RuleEvaluationResult = {
  hardBlockers: number
  softWarnings: number
  messages: string[]
}

export async function evaluateTaskAssignment(params: {
  companyId: string
  taskId: string
  staffProfileId: string
  actorUserId?: string | null
}): Promise<RuleEvaluationResult> {
  const { companyId, taskId, staffProfileId } = params

  const [{ data: requirements }, { data: staff }, { data: staffSkills }, { data: staffCertifications }, { data: rules }] = await Promise.all([
    supabaseAdmin
      .from('task_requirements')
      .select('id, requirement_kind, skill_id, certification_id, required_value, minimum_level, is_hard_requirement, description, skills(name), certifications(name)')
      .eq('company_id', companyId)
      .eq('task_id', taskId)
      .is('archived_at', null),
    supabaseAdmin
      .from('staff_profiles')
      .select('id, full_name, transport_mode, status')
      .eq('company_id', companyId)
      .eq('id', staffProfileId)
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('staff_skills')
      .select('id, skill_id, level')
      .eq('company_id', companyId)
      .eq('staff_profile_id', staffProfileId)
      .is('archived_at', null),
    supabaseAdmin
      .from('staff_certifications')
      .select('id, certification_id, status, expires_at')
      .eq('company_id', companyId)
      .eq('staff_profile_id', staffProfileId)
      .is('archived_at', null),
    supabaseAdmin
      .from('assignment_rules')
      .select('id, rule_key, severity')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('archived_at', null),
  ])

  await supabaseAdmin
    .from('rule_violations')
    .update({ status: 'resolved', resolved_by: params.actorUserId ?? null, resolved_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('task_id', taskId)
    .eq('staff_profile_id', staffProfileId)
    .eq('status', 'open')

  const messages: string[] = []
  const violations: any[] = []
  const skillSet = new Set((staffSkills ?? []).map((row: any) => row.skill_id))
  const today = new Date().toISOString().slice(0, 10)
  const certMap = new Map((staffCertifications ?? []).map((row: any) => [row.certification_id, row]))
  const ruleByKey = new Map((rules ?? []).map((rule: any) => [rule.rule_key, rule]))

  if (!staff) {
    violations.push({
      company_id: companyId,
      task_id: taskId,
      staff_profile_id: staffProfileId,
      severity: 'hard',
      violation_code: 'staff_not_found',
      message: 'Tilldelad personal kunde inte hittas eller är arkiverad.',
      details: {},
    })
  }

  for (const requirement of requirements ?? []) {
    const hard = requirement.is_hard_requirement !== false
    if (requirement.requirement_kind === 'skill' && requirement.skill_id && !skillSet.has(requirement.skill_id)) {
      const rule: any = ruleByKey.get('required_skill_must_match')
      violations.push({
        company_id: companyId,
        task_id: taskId,
        staff_profile_id: staffProfileId,
        assignment_rule_id: rule?.id ?? null,
        task_requirement_id: requirement.id,
        severity: hard ? 'hard' : 'soft',
        violation_code: 'missing_skill',
        message: `Saknar kompetens: ${(requirement as any).skills?.name ?? 'kompetenskrav'}.`,
        details: { requirement_kind: requirement.requirement_kind, skill_id: requirement.skill_id },
      })
    }

    if (requirement.requirement_kind === 'certification' && requirement.certification_id) {
      const cert: any = certMap.get(requirement.certification_id)
      const isValid = cert && cert.status === 'valid' && (!cert.expires_at || cert.expires_at >= today)
      if (!isValid) {
        const rule: any = ruleByKey.get('required_certification_must_be_valid')
        violations.push({
          company_id: companyId,
          task_id: taskId,
          staff_profile_id: staffProfileId,
          assignment_rule_id: rule?.id ?? null,
          task_requirement_id: requirement.id,
          severity: hard ? 'hard' : 'soft',
          violation_code: 'missing_or_expired_certification',
          message: `Saknar giltigt certifikat: ${(requirement as any).certifications?.name ?? 'certifikatkrav'}.`,
          details: { certification_id: requirement.certification_id, current_status: cert?.status ?? null, expires_at: cert?.expires_at ?? null },
        })
      }
    }

    if (requirement.requirement_kind === 'transport_mode' && requirement.required_value && staff?.transport_mode !== requirement.required_value) {
      const rule: any = ruleByKey.get('transport_mode_should_match')
      violations.push({
        company_id: companyId,
        task_id: taskId,
        staff_profile_id: staffProfileId,
        assignment_rule_id: rule?.id ?? null,
        task_requirement_id: requirement.id,
        severity: hard ? 'hard' : 'soft',
        violation_code: 'transport_mode_mismatch',
        message: `Färdsätt matchar inte kravet: ${requirement.required_value}.`,
        details: { required: requirement.required_value, actual: staff?.transport_mode ?? null },
      })
    }
  }

  if (violations.length > 0) {
    await supabaseAdmin.from('rule_violations').insert(violations)
    messages.push(...violations.map((violation) => violation.message))
  } else {
    messages.push('Inga öppna regelbrott hittades för tilldelningen.')
  }

  return {
    hardBlockers: violations.filter((violation) => violation.severity === 'hard').length,
    softWarnings: violations.filter((violation) => violation.severity === 'soft').length,
    messages,
  }
}
