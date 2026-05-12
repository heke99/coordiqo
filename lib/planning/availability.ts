import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getStaffShiftsForDate(companyId: string, staffProfileId: string, date: string) {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('*')
    .eq('company_id', companyId)
    .eq('staff_profile_id', staffProfileId)
    .eq('shift_date', date)
    .is('archived_at', null)
    .order('starts_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getStaffAbsencesForPeriod(companyId: string, staffProfileId: string, startsAt: string, endsAt: string) {
  const { data, error } = await supabaseAdmin
    .from('absences')
    .select('*')
    .eq('company_id', companyId)
    .eq('staff_profile_id', staffProfileId)
    .eq('affects_planning', true)
    .is('archived_at', null)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function checkStaffAvailability(companyId: string, staffProfileId: string, startsAt: string, endsAt: string) {
  const [absences, shiftsResult] = await Promise.all([
    getStaffAbsencesForPeriod(companyId, staffProfileId, startsAt, endsAt),
    supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('company_id', companyId)
      .eq('staff_profile_id', staffProfileId)
      .is('archived_at', null)
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt),
  ])

  const shifts = shiftsResult.data ?? []
  return {
    isAvailable: absences.length === 0 && shifts.length > 0,
    absences,
    shifts,
    reasons: [
      ...(absences.length ? ['Frånvaro överlappar perioden.'] : []),
      ...(!shifts.length ? ['Inget pass täcker perioden.'] : []),
    ],
  }
}
