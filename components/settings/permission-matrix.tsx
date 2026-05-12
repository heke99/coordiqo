import { COMPANY_ROLE_LABELS, COMPANY_ROLE_RANK, PERMISSION_MATRIX, type CompanyRole, type PermissionAction } from '@/lib/auth/permissions'

const roles = Object.keys(COMPANY_ROLE_RANK).sort(
  (a, b) => COMPANY_ROLE_RANK[b as CompanyRole] - COMPANY_ROLE_RANK[a as CompanyRole]
) as CompanyRole[]

const actions = Object.keys(PERMISSION_MATRIX) as PermissionAction[]

export function PermissionMatrix() {
  return (
    <section className="coordiqo-card overflow-hidden">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Rollmatris</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Den här matrisen visar nuvarande kodstyrda behörighetsgränser. I nästa steg kan vi göra företagsunika overrides ovanpå samma struktur.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">Behörighet</th>
              {roles.map((role) => (
                <th key={role} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700">{COMPANY_ROLE_LABELS[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {actions.map((action) => (
              <tr key={action}>
                <td className="sticky left-0 z-10 min-w-72 bg-white px-4 py-4">
                  <p className="font-semibold text-slate-950">{PERMISSION_MATRIX[action].label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{PERMISSION_MATRIX[action].description}</p>
                </td>
                {roles.map((role) => {
                  const allowed = COMPANY_ROLE_RANK[role] >= COMPANY_ROLE_RANK[PERMISSION_MATRIX[action].minimumRole]
                  return (
                    <td key={`${action}-${role}`} className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${allowed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-100'}`}>
                        {allowed ? 'Tillåtet' : 'Nej'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
