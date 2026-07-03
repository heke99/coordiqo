import { redirect } from 'next/navigation'

import {
  can,
  isPlatformAdminRole,
  type PermissionAction,
} from '@/lib/auth/permissions'
import { requireAuth, type AuthCompanyMembership, type AuthContext } from '@/lib/auth/session'

/**
 * Auth context where an active company membership is guaranteed.
 * Assignable to AuthContext so existing components (AppShell etc.) keep working.
 */
export type CompanyAuthContext = AuthContext & { membership: AuthCompanyMembership }

/**
 * Requires a logged-in user with an active company membership.
 *
 * - Not logged in -> redirect to /login (via requireAuth)
 * - Logged in but no active company -> redirect to /setup
 * - Inactive/paused company memberships are already filtered out by requireAuth,
 *   which redirects to /login with a friendly message.
 */
export async function requireCompanyContext(existingAuth?: AuthContext): Promise<CompanyAuthContext> {
  const auth = existingAuth ?? (await requireAuth())

  if (!auth.membership) {
    redirect('/setup')
  }

  return auth as CompanyAuthContext
}

/**
 * Same as requireCompanyContext but returns only the active membership.
 */
export async function requireActiveCompanyMembership(existingAuth?: AuthContext): Promise<AuthCompanyMembership> {
  const auth = await requireCompanyContext(existingAuth)
  return auth.membership
}

/**
 * Requires a logged-in platform administrator (owner / platform admin / support admin).
 * Non-admins are sent to a friendly access-denied page.
 */
export async function requirePlatformAdmin(existingAuth?: AuthContext): Promise<AuthContext> {
  const auth = existingAuth ?? (await requireAuth())

  if (!isPlatformAdminRole(auth.platformRole)) {
    redirect('/access-denied')
  }

  return auth
}

/**
 * Requires an active company membership with a specific permission.
 * Users without the permission are sent to a friendly access-denied page.
 */
export async function requireCompanyPermission(
  permission: PermissionAction,
  existingAuth?: AuthContext,
): Promise<CompanyAuthContext> {
  const auth = await requireCompanyContext(existingAuth)

  if (!can(auth.membership.companyRole, permission)) {
    redirect('/access-denied')
  }

  return auth
}

/**
 * Company context for pages that platform admins may open without their own
 * membership (e.g. audit). Returns membership when present, otherwise requires
 * a platform admin role.
 */
export async function requireCompanyContextOrPlatformAdmin(existingAuth?: AuthContext): Promise<AuthContext> {
  const auth = existingAuth ?? (await requireAuth())

  if (!auth.membership && !isPlatformAdminRole(auth.platformRole)) {
    redirect('/setup')
  }

  return auth
}
