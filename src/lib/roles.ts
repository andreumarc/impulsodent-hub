export interface RoleDef {
  value: string
  label: string
  color: string
  bg: string
}

export const HUB_ROLES: RoleDef[] = [
  { value: 'superadmin',        label: 'Superadmin',         color: '#7c3aed', bg: '#ede9fe' },
  { value: 'admin',             label: 'Administrador',      color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'direccion_general', label: 'Dirección General',  color: '#0f766e', bg: '#ccfbf1' },
  { value: 'direccion_clinica', label: 'Dirección Clínica',  color: '#0369a1', bg: '#e0f2fe' },
  { value: 'rrhh',              label: 'RRHH',               color: '#b45309', bg: '#fef3c7' },
  { value: 'odontologo',        label: 'Odontólogo',         color: '#0891b2', bg: '#e0f2fe' },
  { value: 'auxiliar',          label: 'Auxiliar',           color: '#374151', bg: '#f3f4f6' },
  { value: 'demo',              label: 'Demo',               color: '#6b7280', bg: '#f3f4f6' },
]

export const APP_ROLES: RoleDef[] = [
  { value: 'superadmin',        label: 'Superadmin',         color: '#7c3aed', bg: '#ede9fe' },
  { value: 'admin',             label: 'Administrador',      color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'direccion_general', label: 'Dirección General',  color: '#0f766e', bg: '#ccfbf1' },
  { value: 'direccion_clinica', label: 'Dirección Clínica',  color: '#0369a1', bg: '#e0f2fe' },
  { value: 'rrhh',              label: 'RRHH',               color: '#b45309', bg: '#fef3c7' },
  { value: 'odontologo',        label: 'Odontólogo',         color: '#0891b2', bg: '#e0f2fe' },
  { value: 'auxiliar',          label: 'Auxiliar',           color: '#374151', bg: '#f3f4f6' },
]

export function getRoleStyle(role: string, palette: RoleDef[] = APP_ROLES) {
  return palette.find((r) => r.value === role) ?? { color: '#374151', bg: '#f3f4f6', label: role, value: role }
}
