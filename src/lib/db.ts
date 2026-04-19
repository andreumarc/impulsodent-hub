import { prisma } from './prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  slug: string
  cif: string | null
  city: string | null
  email: string | null
  phone: string | null
  address: string | null
  subscription_plan: string
  subscription_expires_at: string | null
  max_clinics: number
  max_users: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface HubUser {
  id: string
  email: string
  password_hash: string
  name: string
  role: string
  company_id: string | null
  active: boolean
  created_at: string
  updated_at: string
  company?: Pick<Company, 'id' | 'name' | 'slug'>
}

export interface AppAccess {
  company_id: string
  app_id: string
  granted_at: string
}

export interface AppRegistration {
  id: string
  app_id: string
  name: string
  sync_url: string | null
  api_secret: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

export interface SyncLog {
  id: string
  app_id: string
  company_id: string | null
  event: string
  status: string
  response_code: number | null
  error_message: string | null
  created_at: string
}

function serializeCompany(c: {
  id: string; name: string; slug: string; cif?: string | null; city?: string | null
  email: string | null; phone: string | null; address: string | null
  subscription_plan: string; subscription_expires_at: Date | null
  max_clinics: number; max_users: number
  active: boolean; created_at: Date; updated_at: Date
}): Company {
  return {
    ...c,
    cif: c.cif ?? null,
    city: c.city ?? null,
    subscription_expires_at: c.subscription_expires_at?.toISOString() ?? null,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }
}

function serializeUser(u: {
  id: string; email: string; password_hash: string; name: string; role: string
  company_id: string | null; active: boolean; created_at: Date; updated_at: Date
  company?: { id: string; name: string; slug: string } | null
}): HubUser {
  return {
    ...u,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
    company: u.company ?? undefined,
  }
}

function serializeReg(r: {
  id: string; app_id: string; name: string; sync_url: string | null; api_secret: string | null
  sync_enabled: boolean; last_sync_at: Date | null
}): AppRegistration {
  return { ...r, last_sync_at: r.last_sync_at?.toISOString() ?? null }
}

// ─── Companies ────────────────────────────────────────────────────────────────

export async function listCompanies(): Promise<Company[]> {
  const rows = await prisma.company.findMany({ orderBy: { name: 'asc' } })
  return rows.map(serializeCompany)
}

export async function listCompaniesWithStats() {
  const rows = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: {
      appAccess: { select: { app_id: true } },
      _count: { select: { users: true } },
    },
  })
  return rows.map((c) => ({
    ...serializeCompany(c),
    appIds: c.appAccess.map((a) => a.app_id),
    userCount: c._count.users,
  }))
}

export async function getCompany(id: string): Promise<Company | null> {
  const row = await prisma.company.findUnique({ where: { id } })
  return row ? serializeCompany(row) : null
}

export async function createCompany(input: {
  name: string; slug: string; cif?: string; city?: string; email?: string; phone?: string; address?: string
  subscription_plan?: string; subscription_expires_at?: string | null; max_clinics?: number; max_users?: number
}): Promise<Company> {
  const { subscription_expires_at, ...rest } = input
  const row = await prisma.company.create({
    data: {
      ...rest,
      active: true,
      ...(subscription_expires_at != null
        ? { subscription_expires_at: new Date(subscription_expires_at) }
        : {}),
    },
  })
  return serializeCompany(row)
}

export async function updateCompany(
  id: string,
  input: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Company> {
  const row = await prisma.company.update({ where: { id }, data: input })
  return serializeCompany(row)
}

export async function deleteCompany(id: string): Promise<void> {
  await prisma.company.delete({ where: { id } })
}

// ─── App Access ───────────────────────────────────────────────────────────────

export async function getCompanyAppAccess(companyId: string): Promise<string[]> {
  const rows = await prisma.companyAppAccess.findMany({
    where: { company_id: companyId },
    select: { app_id: true },
  })
  return rows.map((r) => r.app_id)
}

export async function setCompanyAppAccess(companyId: string, appIds: string[]): Promise<void> {
  await prisma.companyAppAccess.deleteMany({ where: { company_id: companyId } })
  if (appIds.length === 0) return
  await prisma.companyAppAccess.createMany({
    data: appIds.map((app_id) => ({ company_id: companyId, app_id })),
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<HubUser[]> {
  const rows = await prisma.hubUser.findMany({
    orderBy: { name: 'asc' },
    include: { company: { select: { id: true, name: true, slug: true } } },
  })
  return rows.map(serializeUser)
}

export async function getUserByEmail(email: string): Promise<HubUser | null> {
  const row = await prisma.hubUser.findUnique({ where: { email } })
  return row ? serializeUser(row) : null
}

export async function getUser(id: string): Promise<HubUser | null> {
  const row = await prisma.hubUser.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true, slug: true } } },
  })
  return row ? serializeUser(row) : null
}

export async function createUser(input: {
  email: string; password_hash: string; name: string; role: string; company_id?: string | null
}): Promise<HubUser> {
  const row = await prisma.hubUser.create({ data: { ...input, active: true } })
  return serializeUser(row)
}

export async function updateUser(
  id: string,
  input: Partial<Pick<HubUser, 'name' | 'email' | 'role' | 'company_id' | 'active'> & { password_hash?: string }>,
): Promise<HubUser> {
  const row = await prisma.hubUser.update({ where: { id }, data: input })
  return serializeUser(row)
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.hubUser.delete({ where: { id } })
}

export async function listCompanyUsers(companyId: string): Promise<HubUser[]> {
  const rows = await prisma.hubUser.findMany({
    where: { company_id: companyId },
    orderBy: { name: 'asc' },
  })
  return rows.map(serializeUser)
}

// ─── App Registrations ────────────────────────────────────────────────────────

export async function listAppRegistrations(): Promise<AppRegistration[]> {
  const rows = await prisma.appRegistration.findMany({ orderBy: { name: 'asc' } })
  return rows.map(serializeReg)
}

export async function updateAppRegistration(
  appId: string,
  input: Pick<AppRegistration, 'sync_url' | 'api_secret' | 'sync_enabled'>,
): Promise<AppRegistration> {
  const row = await prisma.appRegistration.update({ where: { app_id: appId }, data: input })
  return serializeReg(row)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const [companies, users, appAccess] = await Promise.all([
    prisma.company.count(),
    prisma.hubUser.count(),
    prisma.companyAppAccess.count(),
  ])
  return { companies, users, appAccess }
}

// ─── User App Roles ───────────────────────────────────────────────────────────

export interface UserAppRole {
  user_id: string
  app_id: string
  role: string
}

export async function getUserAppRoles(userId: string): Promise<UserAppRole[]> {
  return prisma.userAppRole.findMany({ where: { user_id: userId } })
}

export async function setUserAppRoles(userId: string, roles: { app_id: string; role: string }[]): Promise<void> {
  await prisma.userAppRole.deleteMany({ where: { user_id: userId } })
  if (roles.length === 0) return
  await prisma.userAppRole.createMany({ data: roles.map((r) => ({ user_id: userId, ...r })) })
}

// ─── Sync Logs ────────────────────────────────────────────────────────────────

export async function createSyncLog(input: {
  app_id: string; company_id: string; event: string; status: string
  response_code?: number; error_message?: string
}): Promise<void> {
  await prisma.syncLog.create({ data: input })
}
