// Central permission matrix for ImpulsoDent Hub.
// Roles are stored as lowercase strings on session.role and HubUser.role.
//
// Matrix (canonical source of truth):
//
//   Function               | superadmin | admin | dir.general | dir.clinica | rrhh | odontologo | auxiliar
//   -----------------------|------------|-------|-------------|-------------|------|------------|---------
//   Gestión de empresas    |     ✅      |   ✅   |      ❌      |      ❌      |  ❌   |     ❌      |    ❌
//   Gestión de aplicativos |     ✅      |   ✅   |      ✅      |      ❌      |  ❌   |     ❌      |    ❌
//   Alta de clínicas       |     ✅      |   ✅   |      ✅      |      ❌      |  ❌   |     ❌      |    ❌
//   Alta de usuarios       |     ✅      |   ✅   |      ✅      |      ✅      |  ✅   |     ❌      |    ❌
//   Sync / integraciones   |     ✅      |   ❌   |      ❌      |      ❌      |  ❌   |     ❌      |    ❌
//   Panel de auditoría Hub |     ✅      |   ❌   |      ❌      |      ❌      |  ❌   |     ❌      |    ❌
//   SSO / acceso a apps    |     ✅      |   ✅   |      ✅      |      ✅      |  ✅   |     ✅      |    ✅

export type HubRole =
  | 'superadmin'
  | 'admin'
  | 'direccion_general'
  | 'direccion_clinica'
  | 'rrhh'
  | 'odontologo'
  | 'auxiliar'

export const HUB_ROLES: HubRole[] = [
  'superadmin',
  'admin',
  'direccion_general',
  'direccion_clinica',
  'rrhh',
  'odontologo',
  'auxiliar',
]

export type HubPermission =
  | 'companies:manage'
  | 'apps:manage'
  | 'clinics:manage'
  | 'users:manage'
  | 'sync:manage'
  | 'audit:view'
  | 'sso:use'

const MATRIX: Record<HubPermission, HubRole[]> = {
  'companies:manage': ['superadmin', 'admin'],
  'apps:manage':      ['superadmin', 'admin', 'direccion_general'],
  'clinics:manage':   ['superadmin', 'admin', 'direccion_general'],
  'users:manage':     ['superadmin', 'admin', 'direccion_general', 'direccion_clinica', 'rrhh'],
  'sync:manage':      ['superadmin'],
  'audit:view':       ['superadmin'],
  'sso:use':          ['superadmin', 'admin', 'direccion_general', 'direccion_clinica', 'rrhh', 'odontologo', 'auxiliar'],
}

export function hasPermission(role: string | null | undefined, perm: HubPermission): boolean {
  if (!role) return false
  return MATRIX[perm].includes(role as HubRole)
}

/**
 * Whether a role should be able to see anything at all under /admin/*.
 * Odontólogo/Auxiliar only have sso:use, so they get bounced from admin to /.
 */
export function canAccessAdmin(role: string | null | undefined): boolean {
  return (
    hasPermission(role, 'companies:manage') ||
    hasPermission(role, 'apps:manage') ||
    hasPermission(role, 'clinics:manage') ||
    hasPermission(role, 'users:manage') ||
    hasPermission(role, 'sync:manage') ||
    hasPermission(role, 'audit:view')
  )
}

/** Roles that can create users, limited to the perms they themselves hold. */
export function canCreateRole(actor: string | null | undefined, target: HubRole): boolean {
  if (!actor) return false
  // Superadmin can assign any role
  if (actor === 'superadmin') return true
  // Admin can create any role except superadmin
  if (actor === 'admin') return target !== 'superadmin'
  // Dir. general: cannot create superadmin or admin
  if (actor === 'direccion_general') return !['superadmin', 'admin'].includes(target)
  // Dir. clínica / RRHH: can only create the non-management roles
  if (actor === 'direccion_clinica' || actor === 'rrhh') {
    return ['direccion_clinica', 'rrhh', 'odontologo', 'auxiliar'].includes(target)
  }
  return false
}
