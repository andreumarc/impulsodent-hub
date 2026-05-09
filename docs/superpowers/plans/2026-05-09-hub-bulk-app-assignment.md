# Hub — Asignación de apps a usuarios desde el panel admin · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ver y gestionar qué apps tiene asignada cada usuario directamente desde `/admin/users`: columna visual de apps, drawer lateral por fila para edición rápida, y dos acciones masivas (añadir / quitar apps a usuarios seleccionados).

**Architecture:** Funcionalidad puramente aditiva. El modelo `UserAppRole` ya soporta todo lo necesario; no hay migraciones de Prisma. Se añade una columna en el listado, un drawer que reusa `<AppsSection>` existente, dos modales de bulk con sus dos endpoints API. La modificación más grande es a `src/app/(admin)/admin/users/page.tsx`.

**Tech Stack:** Next.js 16 (App Router), Prisma 5, React 19, Tailwind CSS, lucide-react. Sin framework de tests automatizados — verificación vía `npm run lint`, `npm run build`, dev server manual, y curl para endpoints.

**Spec:** `docs/superpowers/specs/2026-05-09-hub-bulk-app-assignment-design.md`

---

## File Structure

### Crear nuevos
- `src/components/admin/UserAppsCell.tsx` — celda de la columna "Apps" (chips con tooltip)
- `src/components/admin/UserAppsDrawer.tsx` — drawer lateral para edición rápida
- `src/components/admin/BulkAddAppsModal.tsx` — modal de añadir apps a seleccionados
- `src/components/admin/BulkRemoveAppsModal.tsx` — modal de quitar apps a seleccionados
- `src/app/api/admin/users/bulk/apps/add/route.ts` — endpoint bulk add (dos fases)
- `src/app/api/admin/users/bulk/apps/remove/route.ts` — endpoint bulk remove (una fase)

### Modificar
- `src/lib/db.ts` — `listUsers()` debe incluir `appRoles`; `serializeUser` debe propagarlas; `HubUser` interface gana `app_roles`
- `src/app/(admin)/admin/users/page.tsx` — interface local `HubUser` añade `app_roles`; nueva columna; botón "Apps" por fila; botones bulk; drawer + modales como state

---

## Pre-flight (una sola vez antes de empezar)

- [ ] **Step 0.1: Confirm git clean**

```bash
cd C:/Users/IAPC/Desktop/.claude/impulsodent-hub
git status
```
Expected: working tree clean (o sin cambios inesperados que pisemos).

- [ ] **Step 0.2: Confirm baseline build pasa**

```bash
npm run build
```
Expected: build OK. Si falla aquí ya, parar y resolver — no es de este feature.

- [ ] **Step 0.3: Confirm dev server arranca**

```bash
npm run dev
```
Abrir `http://localhost:3000/admin/users` en navegador → cargar sin errores. Cerrar dev server (Ctrl+C) antes de empezar tareas.

---

## Task 1: Backend — `listUsers()` devuelve `app_roles`

**Files:**
- Modify: `src/lib/db.ts:23-40, 86-105, 214-223`

**Goal:** que `GET /api/admin/users` devuelva en cada usuario un campo `app_roles: { app_id, role }[]`. La columna del listado lo necesita en cliente sin hacer N+1 fetches.

- [ ] **Step 1.1: Ampliar la interface `HubUser` en `src/lib/db.ts`**

Localizar la interface `HubUser` (líneas ~23-40) y añadir un campo opcional `app_roles`. Tras el cambio:

```ts
export interface HubUser {
  id: string
  email: string
  password_hash: string
  name: string
  role: string
  company_id: string | null
  active: boolean
  clinic_access_all: boolean
  company_access_all: boolean
  subscription_plan: string
  subscription_expires_at: string | null
  max_clinics: number
  created_at: string
  updated_at: string
  company?: Pick<Company, 'id' | 'name' | 'slug'>
  companies: Array<Pick<Company, 'id' | 'name' | 'slug'>>
  app_roles?: Array<{ app_id: string; role: string }>  // ← NUEVO
}
```

- [ ] **Step 1.2: Ampliar `serializeUser()` para propagar `appRoles`**

Localizar `serializeUser` (líneas ~86-105). Modificar la signature de su parámetro y el return para incluir `appRoles`:

```ts
function serializeUser(u: {
  id: string; email: string; password_hash: string; name: string; role: string
  company_id: string | null; active: boolean; clinic_access_all?: boolean; company_access_all?: boolean
  subscription_plan: string; subscription_expires_at: Date | null; max_clinics: number
  created_at: Date; updated_at: Date
  company?: { id: string; name: string; slug: string } | null
  companyAccess?: Array<{ company: { id: string; name: string; slug: string } }>
  appRoles?: Array<{ app_id: string; role: string }>  // ← NUEVO
}): HubUser {
  const companies = u.companyAccess?.map((ca) => ca.company) ?? (u.company ? [u.company] : [])
  return {
    ...u,
    clinic_access_all: u.clinic_access_all !== false,
    company_access_all: u.company_access_all === true,
    subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
    company: u.company ?? undefined,
    companies,
    app_roles: u.appRoles?.map((r) => ({ app_id: r.app_id, role: r.role })),  // ← NUEVO
  }
}
```

- [ ] **Step 1.3: Modificar `listUsers()` para incluir `appRoles`**

Localizar `listUsers` (líneas ~214-223). Añadir `appRoles` al `include`:

```ts
export async function listUsers(): Promise<HubUser[]> {
  const rows = await prisma.hubUser.findMany({
    orderBy: { name: 'asc' },
    include: {
      company: { select: { id: true, name: true, slug: true } },
      companyAccess: { include: { company: { select: { id: true, name: true, slug: true } } } },
      appRoles: { select: { app_id: true, role: true } },  // ← NUEVO
    },
  })
  return rows.map(serializeUser)
}
```

- [ ] **Step 1.4: Lint**

```bash
npm run lint
```
Expected: ningún error. Avisos preexistentes no relacionados se pueden ignorar.

- [ ] **Step 1.5: Build (verifica que Prisma genera tipos correctamente)**

```bash
npm run build
```
Expected: build OK. El `prisma generate` está integrado en el build script.

- [ ] **Step 1.6: Verificación manual con dev server**

```bash
npm run dev
```
En otra terminal:
```bash
curl -s http://localhost:3000/api/admin/users -H "Cookie: <pegar cookie de sesión actual>" | jq '.[0] | keys'
```
Expected: el array de keys incluye `"app_roles"`. Si has logueado en navegador, copiar la cookie `session` desde DevTools → Application → Cookies.

Alternativa sin curl: en el navegador, ir a `http://localhost:3000/admin/users`, abrir DevTools → Network → click en `users` (request a `/api/admin/users`), inspeccionar Response — cada usuario debe tener `app_roles: [...]`.

Cerrar dev server.

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/db.ts
git commit -m "$(cat <<'EOF'
feat(hub): expose app_roles in listUsers response

The admin users list page needs per-user app assignments to render
the new Apps column without N+1 fetches. Add appRoles to the Prisma
include and propagate through serializeUser.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `<UserAppsCell>` — chips de apps por usuario

**Files:**
- Create: `src/components/admin/UserAppsCell.tsx`

**Goal:** componente puro que renderiza la celda "Apps" del listado. Lógica: superadmin → "Todas (N)"; 0 apps → guion; ≤4 apps → chips; >4 apps → 4 chips + "+N". Tooltip vía `title` HTML nativo.

- [ ] **Step 2.1: Crear el componente**

```tsx
// src/components/admin/UserAppsCell.tsx
import Link from 'next/link'
import { APPS, type AppDef } from '@/lib/apps'

interface UserAppsCellProps {
  user: {
    id: string
    role: string
    app_roles?: Array<{ app_id: string; role: string }>
  }
  /** Optional click handler to open the drawer for this user. If absent, chips are passive. */
  onOpenDrawer?: (userId: string) => void
}

const PUBLIC_APPS = APPS.filter((a) => !a.internal)
const APP_BY_ID = new Map<string, AppDef>(PUBLIC_APPS.map((a) => [a.id, a]))

function abbrev(app: AppDef): string {
  return app.name.slice(0, 2).toUpperCase()
}

function sortApps(appIds: string[]): AppDef[] {
  const apps = appIds
    .map((id) => APP_BY_ID.get(id))
    .filter((a): a is AppDef => Boolean(a))
  return apps.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.name.localeCompare(b.name)
  })
}

function Chip({
  app, role, size = 'sm', onClick,
}: {
  app: AppDef
  role?: string
  size?: 'sm' | 'xs'
  onClick?: () => void
}) {
  const dim = size === 'sm' ? 24 : 20
  return (
    <span
      onClick={onClick}
      title={role ? `${app.name} · ${role}` : app.name}
      style={{
        width: dim, height: dim, background: app.bgColor, color: app.color,
      }}
      className={`inline-flex items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {abbrev(app)}
    </span>
  )
}

export function UserAppsCell({ user, onOpenDrawer }: UserAppsCellProps) {
  // Superadmin: implicit access to ALL non-internal apps
  if (user.role === 'superadmin') {
    return (
      <button
        type="button"
        onClick={() => onOpenDrawer?.(user.id)}
        title={`Acceso a todas las apps (rol superadmin)`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors"
      >
        Todas
        <span className="opacity-60">({PUBLIC_APPS.length})</span>
      </button>
    )
  }

  const roles = user.app_roles ?? []
  if (roles.length === 0) {
    return <span className="text-sm text-gray-400">—</span>
  }

  const sorted = sortApps(roles.map((r) => r.app_id))
  const roleByApp = new Map(roles.map((r) => [r.app_id, r.role]))

  const visible = sorted.slice(0, 4)
  const overflow = sorted.slice(4)

  const overflowTitle = overflow
    .map((a) => `${a.name} · ${roleByApp.get(a.id) ?? ''}`)
    .join('\n')

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((app) => (
        <Chip
          key={app.id}
          app={app}
          role={roleByApp.get(app.id)}
          onClick={onOpenDrawer ? () => onOpenDrawer(user.id) : undefined}
        />
      ))}
      {overflow.length > 0 && (
        <span
          title={overflowTitle}
          onClick={onOpenDrawer ? () => onOpenDrawer(user.id) : undefined}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500 ${onOpenDrawer ? 'cursor-pointer hover:bg-gray-200' : ''}`}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/admin/UserAppsCell.tsx
git commit -m "$(cat <<'EOF'
feat(hub): add UserAppsCell component for users list column

Renders up to 4 app chips with abbreviation badges, +N overflow with
title-attribute tooltip, and a special "Todas (N)" pill for superadmin
users. Sort order: by app.category then alphabetical. Pure component,
not yet wired into the page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Integrar columna "Apps" en el listado

**Files:**
- Modify: `src/app/(admin)/admin/users/page.tsx` (interface local, nueva `<th>`, nueva `<td>`)

**Goal:** la columna aparece en `/admin/users` entre `Empresa` y `Estado`, con el mismo breakpoint `hidden lg:table-cell`. El click en chips abre el drawer (que aún no existe — pasamos un noop hasta Task 5).

- [ ] **Step 3.1: Ampliar la interface local `HubUser`**

Localizar la interface (línea ~15) y añadir el campo:

```ts
interface HubUser {
  id: string; name: string; email: string; role: string; active: boolean
  created_at: string; company: { id: string; name: string; slug: string } | null
  companies?: Array<{ id: string; name: string; slug: string }>
  company_access_all?: boolean
  subscription_plan: string; subscription_expires_at: string | null
  app_roles?: Array<{ app_id: string; role: string }>  // ← NUEVO
}
```

- [ ] **Step 3.2: Importar `<UserAppsCell>`**

Cerca de los demás imports (línea ~7):

```ts
import { UserAppsCell } from '@/components/admin/UserAppsCell'
```

- [ ] **Step 3.3: Añadir cabecera `<th>` "Apps"**

Localizar la fila del thead (línea ~309-323). Insertar entre la `<th>` de Empresa y la de Estado:

```tsx
<th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Empresa</th>
<th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Apps</th>
<th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Estado</th>
```

- [ ] **Step 3.4: Añadir celda `<td>` con `<UserAppsCell>`**

Localizar el `<td>` de Empresa (línea ~352-354). Insertar después:

```tsx
<td className="px-4 py-3 hidden lg:table-cell">
  <CompaniesCell user={u} />
</td>
<td className="px-4 py-3 hidden lg:table-cell">
  <UserAppsCell user={u} />
</td>
<td className="px-4 py-3">
  ...Estado...
</td>
```

(no se pasa `onOpenDrawer` todavía — se añade en Task 5)

- [ ] **Step 3.5: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 3.6: Verificación manual visual**

```bash
npm run dev
```
- Abrir `http://localhost:3000/admin/users`
- Verificar:
  - [ ] Aparece columna "Apps" entre "Empresa" y "Estado" en pantallas ≥lg
  - [ ] Usuario superadmin (`marcandreuguerao@gmail.com`) muestra `Todas (N)` (N = número de apps no internas, hoy ~20)
  - [ ] Usuarios con apps asignadas muestran chips
  - [ ] Usuarios sin apps muestran `—`
  - [ ] Hover sobre chip → tooltip "AppName · role"
  - [ ] Reducir ancho a <1024px → la columna desaparece

Cerrar dev server.

- [ ] **Step 3.7: Commit**

```bash
git add src/app/(admin)/admin/users/page.tsx
git commit -m "$(cat <<'EOF'
feat(hub): add Apps column to users admin list

Surface each user's per-app role assignments inline using the new
UserAppsCell component. Hidden below lg breakpoint — chip density is
too high for narrow tables. Drawer wiring comes in a follow-up task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `<UserAppsDrawer>` — panel lateral para edición rápida

**Files:**
- Create: `src/components/admin/UserAppsDrawer.tsx`

**Goal:** drawer lateral derecha que reusa `<AppsSection>`. Recibe `userId`, carga el detalle del usuario, permite editar app_roles, guarda con `PUT /api/admin/users/[id]` (solo el campo `app_roles`), maneja "cambios sin guardar" con `window.confirm()`.

- [ ] **Step 4.1: Crear el componente**

```tsx
// src/components/admin/UserAppsDrawer.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { X, ExternalLink, LayoutGrid } from 'lucide-react'
import { AppsSection } from '@/app/(admin)/admin/users/new/page'

interface UserAppsDrawerProps {
  /** When set, drawer is open and shows this user. null = closed. */
  userId: string | null
  /** Header data; pulled from the users list to avoid an extra fetch. */
  userName: string
  userEmail: string
  /** Called when user saves successfully. Receives the new app_roles list so the parent can update its local state optimistically. */
  onSave: (userId: string, appRoles: Array<{ app_id: string; role: string }>) => void
  /** Called when drawer should close (X, ESC, backdrop, switch). */
  onClose: () => void
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function UserAppsDrawer({
  userId, userName, userEmail, onSave, onClose,
}: UserAppsDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [appRoles, setAppRoles] = useState<Record<string, string>>({})
  const [initialAppRoles, setInitialAppRoles] = useState<Record<string, string>>({})

  const isDirty = JSON.stringify(appRoles) !== JSON.stringify(initialAppRoles)
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // Load user detail when userId changes
  useEffect(() => {
    if (!userId) return
    setLoading(true); setError(''); setSuccess(false)
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((u: { app_roles?: Array<{ app_id: string; role: string }> }) => {
        const initial: Record<string, string> = {}
        for (const r of u.app_roles ?? []) initial[r.app_id] = r.role
        setAppRoles(initial)
        setInitialAppRoles(initial)
      })
      .catch(() => setError('Error cargando usuario'))
      .finally(() => setLoading(false))
  }, [userId])

  const requestClose = useCallback(() => {
    if (isDirtyRef.current && !window.confirm('Tienes cambios sin guardar. ¿Descartar?')) return
    onClose()
  }, [onClose])

  // ESC key closes (with dirty check)
  useEffect(() => {
    if (!userId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [userId, requestClose])

  async function handleSave() {
    if (!userId) return
    setSaving(true); setError('')
    const app_roles = Object.entries(appRoles)
      .filter(([, role]) => role)
      .map(([app_id, role]) => ({ app_id, role }))

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_roles }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
        return
      }
      setSuccess(true)
      onSave(userId, app_roles)
      setTimeout(() => onClose(), 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (!userId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={requestClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-white shadow-xl border-l border-gray-100 flex flex-col"
        role="dialog"
        aria-label={`Apps de ${userName}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: '#0d9488' }}
            >
              {getInitials(userName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-brand-500" />
                Apps · {userName}
              </h2>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              <Link
                href={`/admin/users/${userId}`}
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-brand-600 hover:underline"
              >
                Editar usuario completo <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-10">Cargando…</div>
          ) : (
            <>
              <AppsSection appRoles={appRoles} setAppRoles={setAppRoles} />
              <p className="mt-3 text-[11px] text-gray-400 px-1">
                ⓘ Las clínicas globales se editan desde Editar usuario completo.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}
          {success ? (
            <div className="py-2 text-center text-sm font-semibold text-green-600">
              ✓ Apps actualizadas
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || loading || !isDirty}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                onClick={requestClose}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 4.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/admin/UserAppsDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(hub): add UserAppsDrawer for inline app role editing

Side panel that reuses the existing AppsSection component, fetches
the target user, edits per-app roles in isolation, and persists via
the existing PUT /api/admin/users/[id] endpoint with only the
app_roles field. Native confirm() on close when dirty. ESC and
backdrop both close. Optimistic table update is delegated to the
parent via the onSave callback.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrar drawer + botón "Apps" por fila

**Files:**
- Modify: `src/app/(admin)/admin/users/page.tsx`

**Goal:** botón nuevo "Apps" en la columna `Acciones` entre "Contraseña" y "Desactivar". Estado del drawer en la página. Click en chips de la columna también abre drawer. Tras guardar, los chips se actualizan optimistamente sin re-fetch.

- [ ] **Step 5.1: Importar el drawer y el icono**

En los imports de la página (línea ~5-7):

```ts
import { Plus, Power, KeyRound, ChevronRight, Users, X, Eye, EyeOff, RefreshCw, Trash2, LayoutGrid } from 'lucide-react'
import { HUB_ROLES, getRoleStyle } from '@/lib/roles'
import { UserAppsCell } from '@/components/admin/UserAppsCell'
import { UserAppsDrawer } from '@/components/admin/UserAppsDrawer'
```

- [ ] **Step 5.2: Añadir state del drawer**

Dentro de `UsersPage()`, junto al resto de useState (línea ~150-157):

```ts
const [drawerUser, setDrawerUser] = useState<HubUser | null>(null)
```

- [ ] **Step 5.3: Renderizar el drawer**

En el JSX de retorno, junto al `<PasswordModal>` (línea ~218):

```tsx
{pwdUser && <PasswordModal user={pwdUser} onClose={() => setPwdUser(null)} />}
<UserAppsDrawer
  userId={drawerUser?.id ?? null}
  userName={drawerUser?.name ?? ''}
  userEmail={drawerUser?.email ?? ''}
  onClose={() => setDrawerUser(null)}
  onSave={(uid, appRoles) => {
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, app_roles: appRoles } : u))
  }}
/>
```

- [ ] **Step 5.4: Pasar `onOpenDrawer` a `<UserAppsCell>`**

Localizar la celda de Apps en `<td>` (de Task 3) y añadir el callback:

```tsx
<td className="px-4 py-3 hidden lg:table-cell">
  <UserAppsCell user={u} onOpenDrawer={() => setDrawerUser(u)} />
</td>
```

- [ ] **Step 5.5: Añadir botón "Apps" por fila**

Localizar la celda de Acciones (línea ~381-400). Insertar el botón "Apps" entre "Contraseña" y "Desactivar":

```tsx
<td className="px-4 py-3">
  <div className="flex items-center gap-0.5">
    <button onClick={() => setPwdUser(u)}
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors">
      <KeyRound className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Contraseña</span>
    </button>
    <button onClick={() => setDrawerUser(u)}
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors">
      <LayoutGrid className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Apps</span>
    </button>
    <button onClick={() => toggleActive(u)}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        u.active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
      }`}>
      <Power className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{u.active ? 'Desactivar' : 'Activar'}</span>
    </button>
    <Link href={`/admin/users/${u.id}`}
      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-gray-100 rounded-lg transition-colors">
      <ChevronRight className="w-4 h-4" />
    </Link>
  </div>
</td>
```

- [ ] **Step 5.6: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 5.7: Verificación manual**

```bash
npm run dev
```
- Abrir `http://localhost:3000/admin/users` logueado como superadmin.
- [ ] Click botón "Apps" en una fila → drawer abre por la derecha
- [ ] Drawer muestra el nombre y email del usuario en la cabecera
- [ ] Drawer carga las apps actuales con su rol
- [ ] Cambiar el rol de una app → botón "Guardar cambios" se habilita
- [ ] Click "Cancelar" sin cambios → drawer cierra
- [ ] Cambiar y click X → confirm "¿Descartar?"
- [ ] Cambiar, guardar → "✓ Apps actualizadas" → cierra a 1.2s → chips de la columna actualizados
- [ ] ESC → cierra (con confirm si dirty)
- [ ] Click en chips de la columna también abre drawer
- [ ] Click en otro link "Volver al listado" lleva a edit page completo

Cerrar dev server.

- [ ] **Step 5.8: Commit**

```bash
git add src/app/(admin)/admin/users/page.tsx
git commit -m "$(cat <<'EOF'
feat(hub): wire UserAppsDrawer into users list with per-row trigger

Adds an Apps action button per row and makes the column chips clickable.
Saving updates the local users state optimistically so the table reflects
new chips without a full re-fetch.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Endpoint `POST /api/admin/users/bulk/apps/add`

**Files:**
- Create: `src/app/api/admin/users/bulk/apps/add/route.ts`

**Goal:** endpoint en dos fases. Auth `users:manage`. Para `admin`, filtra `user_ids` a su propia empresa. Categoriza cada par `(user, app)`. Si hay conflictos sin `on_conflict` → devuelve `conflicts_pending` sin escribir. Si hay `on_conflict` o no hay conflictos → escribe y devuelve `applied`. Sync con `pushUserToApps` por usuario afectado.

- [ ] **Step 6.1: Crear el handler**

```ts
// src/app/api/admin/users/bulk/apps/add/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { pushUserToApps } from '@/lib/sync'

interface AppRoleInput {
  app_id: string
  role: string
}

interface BulkAddBody {
  user_ids: string[]
  app_roles: AppRoleInput[]
  on_conflict?: 'skip' | 'overwrite'
}

interface Conflict {
  user_id: string
  user_name: string
  app_id: string
  app_name: string
  current_role: string
  new_role: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'users:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: BulkAddBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x) => typeof x === 'string') : []
  const appRoles = Array.isArray(body.app_roles)
    ? body.app_roles.filter((r): r is AppRoleInput => typeof r?.app_id === 'string' && typeof r?.role === 'string' && r.role.length > 0)
    : []
  if (userIds.length === 0 || appRoles.length === 0) {
    return NextResponse.json({ error: 'user_ids y app_roles son obligatorios y no pueden estar vacíos' }, { status: 400 })
  }

  // Load target users + their company company_app_access for cross-company filtering and CompanyAppAccess check
  const users = await prisma.hubUser.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, name: true, role: true, company_id: true,
      appRoles: { select: { app_id: true, role: true } },
    },
  })

  // Cross-company scoping for non-superadmin
  const skipped_cross_company: string[] = []
  const allowed = users.filter((u) => {
    if (session.role === 'superadmin') return true
    if (!session.companyId) { skipped_cross_company.push(u.id); return false }
    if (u.company_id !== session.companyId) { skipped_cross_company.push(u.id); return false }
    return true
  })

  // Load CompanyAppAccess once for all distinct companies in the allowed set
  const companyIds = Array.from(new Set(allowed.map((u) => u.company_id).filter((c): c is string => Boolean(c))))
  const companyAccessRows = await prisma.companyAppAccess.findMany({
    where: { company_id: { in: companyIds }, app_id: { in: appRoles.map((r) => r.app_id) } },
    select: { company_id: true, app_id: true },
  })
  const companyHasApp = new Set(companyAccessRows.map((r) => `${r.company_id}|${r.app_id}`))

  // App name lookup (for nicer conflict messages) — use a static import to avoid n+1
  const { APPS } = await import('@/lib/apps')
  const appNameById = new Map(APPS.map((a) => [a.id, a.name]))

  // Categorize each (user, app)
  const conflicts: Conflict[] = []
  const skipped_no_company_access: { user_id: string; app_id: string }[] = []
  type Action = { user_id: string; app_id: string; role: string; was_existing: boolean }
  const grants: Action[] = []
  const overwrites: Action[] = []  // only used if on_conflict === 'overwrite'
  let skipped_same_role = 0

  for (const u of allowed) {
    const existingByApp = new Map(u.appRoles.map((r) => [r.app_id, r.role]))
    for (const ar of appRoles) {
      // Superadmin user: skip — already implicit access
      if (u.role === 'superadmin') {
        skipped_same_role++
        continue
      }
      // CompanyAppAccess check (only if user has a company)
      if (u.company_id && !companyHasApp.has(`${u.company_id}|${ar.app_id}`)) {
        skipped_no_company_access.push({ user_id: u.id, app_id: ar.app_id })
        continue
      }
      // No company at all: also skip
      if (!u.company_id) {
        skipped_no_company_access.push({ user_id: u.id, app_id: ar.app_id })
        continue
      }
      const current = existingByApp.get(ar.app_id)
      if (!current) {
        grants.push({ user_id: u.id, app_id: ar.app_id, role: ar.role, was_existing: false })
      } else if (current === ar.role) {
        skipped_same_role++
      } else {
        // Conflict
        conflicts.push({
          user_id: u.id,
          user_name: u.name,
          app_id: ar.app_id,
          app_name: appNameById.get(ar.app_id) ?? ar.app_id,
          current_role: current,
          new_role: ar.role,
        })
        if (body.on_conflict === 'overwrite') {
          overwrites.push({ user_id: u.id, app_id: ar.app_id, role: ar.role, was_existing: true })
        }
      }
    }
  }

  // If conflicts and no on_conflict decision yet → return for client to ask
  if (conflicts.length > 0 && !body.on_conflict) {
    return NextResponse.json({
      status: 'conflicts_pending',
      conflicts,
      preview: {
        to_grant: grants.length,
        same_role: skipped_same_role,
        no_company_access: skipped_no_company_access.length,
        cross_company: skipped_cross_company.length,
      },
    })
  }

  // Apply: grants always; overwrites only if on_conflict === 'overwrite'
  const writes = [...grants, ...overwrites]
  if (writes.length > 0) {
    // Fan-out individual upserts; UserAppRole has composite PK (user_id, app_id)
    await Promise.all(writes.map((w) =>
      prisma.userAppRole.upsert({
        where: { user_id_app_id: { user_id: w.user_id, app_id: w.app_id } },
        create: { user_id: w.user_id, app_id: w.app_id, role: w.role },
        update: { role: w.role },
      })
    ))
  }

  // Sync affected users to sub-apps (fire-and-forget per user, but await all so the response reflects truth-ish state)
  const affectedUserIds = Array.from(new Set(writes.map((w) => w.user_id)))
  if (affectedUserIds.length > 0) {
    const affectedUsers = await prisma.hubUser.findMany({
      where: { id: { in: affectedUserIds } },
    })
    await Promise.allSettled(affectedUsers.map((u) =>
      pushUserToApps({
        id: u.id, email: u.email, name: u.name, role: u.role,
        companyId: u.company_id,
        subscription_plan: u.subscription_plan,
        subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
        max_clinics: u.max_clinics,
        active: u.active,
        password_hash: u.password_hash,
      })
    ))
  }

  return NextResponse.json({
    status: 'applied',
    granted: grants.length,
    skipped_same_role,
    conflicts_resolved: body.on_conflict === 'overwrite' ? conflicts.length : (body.on_conflict === 'skip' ? conflicts.length : 0),
    skipped_no_company_access,
    skipped_cross_company,
  })
}
```

- [ ] **Step 6.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 6.3: Verificación manual con curl**

```bash
npm run dev
```

Necesitas la cookie de sesión (DevTools → Application → Cookies → `session`) y al menos 2 user_ids reales (DevTools en `/admin/users` → request a `/api/admin/users` → copia 2 ids). Reemplaza `<COOKIE>` y `<UID1>`, `<UID2>`.

Caso 1: añadir ClinicVox con rol `admin` a 2 usuarios sin esa app.
```bash
curl -s -X POST http://localhost:3000/api/admin/users/bulk/apps/add \
  -H "Cookie: session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"user_ids":["<UID1>","<UID2>"],"app_roles":[{"app_id":"clinicvox","role":"admin"}]}'
```
Expected: `{"status":"applied","granted":2,...}` (o conflictos si ya tenían).

Caso 2: ahora intentar darles rol `user` (debería detectar conflicto):
```bash
curl -s -X POST http://localhost:3000/api/admin/users/bulk/apps/add \
  -H "Cookie: session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"user_ids":["<UID1>","<UID2>"],"app_roles":[{"app_id":"clinicvox","role":"user"}]}'
```
Expected: `{"status":"conflicts_pending","conflicts":[...]}`.

Caso 3: aplicar con `on_conflict: overwrite`:
```bash
curl -s -X POST http://localhost:3000/api/admin/users/bulk/apps/add \
  -H "Cookie: session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"user_ids":["<UID1>","<UID2>"],"app_roles":[{"app_id":"clinicvox","role":"user"}],"on_conflict":"overwrite"}'
```
Expected: `{"status":"applied","granted":0,"conflicts_resolved":2,...}`.

Cerrar dev server.

- [ ] **Step 6.4: Commit**

```bash
git add src/app/api/admin/users/bulk/apps/add/route.ts
git commit -m "$(cat <<'EOF'
feat(hub): bulk apps assignment endpoint with two-phase conflict handling

POST /api/admin/users/bulk/apps/add categorizes each (user, app) pair,
returns 'conflicts_pending' without writes when role conflicts exist
and no on_conflict decision was provided. Honors users:manage permission
and scopes admin role to their own company. Triggers pushUserToApps
sync for every affected user.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `<BulkAddAppsModal>` con sub-modal de conflicto

**Files:**
- Create: `src/components/admin/BulkAddAppsModal.tsx`

**Goal:** modal centrado para "Añadir apps a N usuarios". Lista de apps no internas con checkbox + dropdown rol. Vista previa optimista en cliente. Submit llama al endpoint; si responde `conflicts_pending`, abre sub-modal de confirmación inline.

- [ ] **Step 7.1: Crear el componente**

```tsx
// src/components/admin/BulkAddAppsModal.tsx
'use client'

import { useState, useMemo } from 'react'
import { X, ChevronDown, AlertTriangle } from 'lucide-react'
import { APPS } from '@/lib/apps'
import { APP_ROLES } from '@/lib/roles'

interface SelectedUser {
  id: string
  name: string
  role: string
  app_roles?: Array<{ app_id: string; role: string }>
}

interface ApplyResult {
  granted: number
  skipped_same_role: number
  conflicts_resolved: number
  skipped_no_company_access: { user_id: string; app_id: string }[]
  skipped_cross_company: string[]
}

interface BulkAddAppsModalProps {
  users: SelectedUser[]
  onClose: () => void
  onApplied: (result: ApplyResult) => void
}

interface Conflict {
  user_id: string
  user_name: string
  app_id: string
  app_name: string
  current_role: string
  new_role: string
}

const PUBLIC_APPS = APPS.filter((a) => !a.internal)

export function BulkAddAppsModal({ users, onClose, onApplied }: BulkAddAppsModalProps) {
  const [selection, setSelection] = useState<Record<string, string>>({}) // app_id -> role
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)

  function toggle(appId: string, role: string) {
    setSelection((prev) => {
      const next = { ...prev }
      if (!role) delete next[appId]
      else next[appId] = role
      return next
    })
  }

  // Client-side optimistic preview based on data we already loaded for the list
  const preview = useMemo(() => {
    const entries = Object.entries(selection).filter(([, role]) => role)
    let toGrant = 0, sameRole = 0, conflict = 0
    for (const u of users) {
      if (u.role === 'superadmin') { sameRole += entries.length; continue }
      const existing = new Map((u.app_roles ?? []).map((r) => [r.app_id, r.role]))
      for (const [appId, role] of entries) {
        const cur = existing.get(appId)
        if (!cur) toGrant++
        else if (cur === role) sameRole++
        else conflict++
      }
    }
    return { toGrant, sameRole, conflict, hasSelection: entries.length > 0 }
  }, [selection, users])

  async function submit(on_conflict?: 'skip' | 'overwrite') {
    setSubmitting(true); setError('')
    const app_roles = Object.entries(selection)
      .filter(([, role]) => role)
      .map(([app_id, role]) => ({ app_id, role }))
    const body: Record<string, unknown> = {
      user_ids: users.map((u) => u.id),
      app_roles,
    }
    if (on_conflict) body.on_conflict = on_conflict

    try {
      const res = await fetch('/api/admin/users/bulk/apps/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error en la operación')
        return
      }
      if (data.status === 'conflicts_pending') {
        setConflicts(data.conflicts)
        return
      }
      // applied
      onApplied(data as ApplyResult)
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Conflict sub-modal ─────────────────────────────────────────────────────
  if (conflicts) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-gray-900">Conflictos de rol</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {conflicts.length} {conflicts.length === 1 ? 'usuario tiene' : 'usuarios tienen'} acceso con un rol distinto.
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/40 p-3 mb-4 text-xs space-y-1.5">
            {conflicts.map((c) => (
              <div key={`${c.user_id}|${c.app_id}`} className="text-gray-700">
                <span className="font-medium">{c.user_name}</span>
                {' — '}
                <span className="font-medium">{c.app_name}</span>
                {': tiene '}
                <code className="px-1 py-0.5 bg-white rounded text-[11px]">{c.current_role}</code>
                {', le darías '}
                <code className="px-1 py-0.5 bg-white rounded text-[11px]">{c.new_role}</code>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 mb-3">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => submit('skip')}
              disabled={submitting}
              className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Mantener su rol actual
            </button>
            <button
              onClick={() => submit('overwrite')}
              disabled={submitting}
              className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              Sobrescribir con el rol nuevo
            </button>
            <button
              onClick={() => { setConflicts(null); }}
              disabled={submitting}
              className="w-full py-2 text-gray-500 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Añadir apps a {users.length} usuario{users.length !== 1 ? 's' : ''}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Selecciona las apps y el rol que tendrán todos los usuarios.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {PUBLIC_APPS.map((app) => {
            const role = selection[app.id]
            const enabled = !!role
            return (
              <div
                key={app.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${enabled ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100'}`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggle(app.id, e.target.checked ? (role || APP_ROLES[1].value /* admin */) : '')}
                  className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400 cursor-pointer"
                />
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: app.bgColor, color: app.color }}
                >
                  {app.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{app.name}</span>
                <div className="relative">
                  <select
                    value={role ?? ''}
                    onChange={(e) => toggle(app.id, e.target.value)}
                    disabled={!enabled}
                    className="appearance-none text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white min-w-[140px] disabled:opacity-50"
                  >
                    <option value="">— Sin acceso —</option>
                    {APP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Live preview */}
        {preview.hasSelection && (
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-0.5">
            <div className="font-semibold text-gray-700 mb-1">Vista previa</div>
            <div>• {preview.toGrant} {preview.toGrant === 1 ? 'asignación nueva' : 'asignaciones nuevas'}</div>
            <div>• {preview.sameRole} {preview.sameRole === 1 ? 'asignación' : 'asignaciones'} ya {preview.sameRole === 1 ? 'existente con el mismo rol (skip)' : 'existentes con el mismo rol (skip)'}</div>
            {preview.conflict > 0 && (
              <div className="text-amber-600">• {preview.conflict} {preview.conflict === 1 ? 'conflicto' : 'conflictos'} de rol (se preguntará)</div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => submit()}
            disabled={!preview.hasSelection || submitting}
            className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Procesando…' : `Añadir apps`}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/admin/BulkAddAppsModal.tsx
git commit -m "$(cat <<'EOF'
feat(hub): BulkAddAppsModal with conflict resolution sub-modal

App-by-app picker with role dropdown, optimistic client-side preview
based on local users state, and a conflict sub-modal that surfaces
exactly which user/app pairs collide before letting the admin pick
skip vs overwrite.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Endpoint `POST /api/admin/users/bulk/apps/remove`

**Files:**
- Create: `src/app/api/admin/users/bulk/apps/remove/route.ts`

**Goal:** una sola fase. Borrar las filas `UserAppRole` para los pares `(user_id, app_id)` indicados. Sync con sub-apps después.

- [ ] **Step 8.1: Crear el handler**

```ts
// src/app/api/admin/users/bulk/apps/remove/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { pushUserToApps } from '@/lib/sync'

interface BulkRemoveBody {
  user_ids: string[]
  app_ids: string[]
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, 'users:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: BulkRemoveBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x) => typeof x === 'string') : []
  const appIds = Array.isArray(body.app_ids) ? body.app_ids.filter((x) => typeof x === 'string') : []
  if (userIds.length === 0 || appIds.length === 0) {
    return NextResponse.json({ error: 'user_ids y app_ids son obligatorios y no pueden estar vacíos' }, { status: 400 })
  }

  // Cross-company scoping
  const users = await prisma.hubUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, company_id: true },
  })
  const skipped_cross_company: string[] = []
  const allowedUserIds = users
    .filter((u) => {
      if (session.role === 'superadmin') return true
      if (!session.companyId || u.company_id !== session.companyId) {
        skipped_cross_company.push(u.id)
        return false
      }
      return true
    })
    .map((u) => u.id)

  if (allowedUserIds.length === 0) {
    return NextResponse.json({
      revoked: 0,
      skipped_not_assigned: 0,
      skipped_cross_company,
    })
  }

  // Count what would be revoked (so we can also report skipped_not_assigned correctly)
  const existingPairs = await prisma.userAppRole.findMany({
    where: { user_id: { in: allowedUserIds }, app_id: { in: appIds } },
    select: { user_id: true, app_id: true },
  })
  const revoked = existingPairs.length
  const skipped_not_assigned = (allowedUserIds.length * appIds.length) - revoked

  if (revoked > 0) {
    await prisma.userAppRole.deleteMany({
      where: { user_id: { in: allowedUserIds }, app_id: { in: appIds } },
    })
  }

  // Sync affected users (only those that actually had any of the apps)
  const affectedUserIds = Array.from(new Set(existingPairs.map((p) => p.user_id)))
  if (affectedUserIds.length > 0) {
    const affectedUsers = await prisma.hubUser.findMany({
      where: { id: { in: affectedUserIds } },
    })
    await Promise.allSettled(affectedUsers.map((u) =>
      pushUserToApps({
        id: u.id, email: u.email, name: u.name, role: u.role,
        companyId: u.company_id,
        subscription_plan: u.subscription_plan,
        subscription_expires_at: u.subscription_expires_at?.toISOString() ?? null,
        max_clinics: u.max_clinics,
        active: u.active,
        password_hash: u.password_hash,
      })
    ))
  }

  return NextResponse.json({
    revoked,
    skipped_not_assigned,
    skipped_cross_company,
  })
}
```

- [ ] **Step 8.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 8.3: Verificación manual con curl**

```bash
npm run dev
```
Reemplazar `<COOKIE>`, `<UID1>`, `<UID2>`:
```bash
curl -s -X POST http://localhost:3000/api/admin/users/bulk/apps/remove \
  -H "Cookie: session=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"user_ids":["<UID1>","<UID2>"],"app_ids":["clinicvox"]}'
```
Expected: `{"revoked":N,"skipped_not_assigned":M,"skipped_cross_company":[]}`. Verificar que en la base de datos las filas `user_app_roles` ya no existen para esas combinaciones.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/api/admin/users/bulk/apps/remove/route.ts
git commit -m "$(cat <<'EOF'
feat(hub): bulk apps removal endpoint

POST /api/admin/users/bulk/apps/remove deletes UserAppRole rows for
the requested (user_id, app_id) cross-product. Honors users:manage
and scopes admin to their own company. Triggers pushUserToApps for
each user that actually lost an app.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `<BulkRemoveAppsModal>`

**Files:**
- Create: `src/components/admin/BulkRemoveAppsModal.tsx`

**Goal:** modal rojo destructivo. Lista solo apps que al menos un usuario seleccionado tiene asignadas, con count. Sin sub-modal de confirmación adicional (la vista previa lo es).

- [ ] **Step 9.1: Crear el componente**

```tsx
// src/components/admin/BulkRemoveAppsModal.tsx
'use client'

import { useState, useMemo } from 'react'
import { X, Trash2 } from 'lucide-react'
import { APPS } from '@/lib/apps'

interface SelectedUser {
  id: string
  name: string
  role: string
  app_roles?: Array<{ app_id: string; role: string }>
}

interface ApplyResult {
  revoked: number
  skipped_not_assigned: number
  skipped_cross_company: string[]
}

interface BulkRemoveAppsModalProps {
  users: SelectedUser[]
  onClose: () => void
  onApplied: (result: ApplyResult) => void
}

const APP_BY_ID = new Map(APPS.map((a) => [a.id, a]))

export function BulkRemoveAppsModal({ users, onClose, onApplied }: BulkRemoveAppsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Apps that at least one selected user has assigned (deduped, with usage count)
  const candidates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of users) {
      if (u.role === 'superadmin') continue // superadmin has no UserAppRole rows to remove
      for (const r of u.app_roles ?? []) {
        counts.set(r.app_id, (counts.get(r.app_id) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([appId, count]) => ({ app: APP_BY_ID.get(appId), count, app_id: appId }))
      .filter((c): c is { app: NonNullable<typeof c.app>; count: number; app_id: string } => Boolean(c.app))
      .sort((a, b) => a.app.name.localeCompare(b.app.name))
  }, [users])

  const willRevoke = useMemo(() => {
    let total = 0
    for (const c of candidates) if (selected.has(c.app_id)) total += c.count
    return total
  }, [selected, candidates])

  function toggle(appId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) next.delete(appId)
      else next.add(appId)
      return next
    })
  }

  async function submit() {
    if (selected.size === 0) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/admin/users/bulk/apps/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: users.map((u) => u.id),
          app_ids: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error en la operación')
        return
      }
      onApplied(data as ApplyResult)
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Quitar apps a {users.length} usuario{users.length !== 1 ? 's' : ''}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Solo se muestran apps que al menos uno de los usuarios tiene asignadas.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Ningún usuario tiene apps asignadas.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {candidates.map((c) => (
                <label
                  key={c.app_id}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors cursor-pointer ${selected.has(c.app_id) ? 'border-red-200 bg-red-50/40' : 'border-gray-100 hover:bg-gray-50/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.app_id)}
                    onChange={() => toggle(c.app_id)}
                    className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                  />
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: c.app.bgColor, color: c.app.color }}
                  >
                    {c.app.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.app.name}</span>
                  <span className="text-[11px] text-gray-500">
                    {c.count} {c.count === 1 ? 'usuario la tiene' : 'usuarios la tienen'}
                  </span>
                </label>
              ))}
            </div>

            {selected.size > 0 && (
              <div className="mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                <div className="font-semibold mb-0.5">Vista previa</div>
                <div>• {willRevoke} {willRevoke === 1 ? 'asignación será revocada' : 'asignaciones serán revocadas'}</div>
                <div className="opacity-80">• Esta acción no se puede deshacer</div>
              </div>
            )}

            {error && <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={submit}
                disabled={selected.size === 0 || submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {submitting ? 'Procesando…' : 'Quitar apps'}
              </button>
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/admin/BulkRemoveAppsModal.tsx
git commit -m "$(cat <<'EOF'
feat(hub): BulkRemoveAppsModal — destructive bulk removal modal

Lists only apps that at least one selected user actually has
assigned, with the count per app. The live preview ('N asignaciones
serán revocadas') doubles as the confirmation — no extra modal.
Empty state when nothing to remove.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Integrar bulk buttons + summary panel

**Files:**
- Modify: `src/app/(admin)/admin/users/page.tsx`

**Goal:** dos botones nuevos en la fila de tabs/acciones (donde hoy está "Eliminar seleccionados"): "+ Añadir apps", "− Quitar apps". State para los modales. Tras `applied`, panel de resumen inline (estilo `pullSummary`) y refetch del listado para sincronizar `app_roles`.

- [ ] **Step 10.1: Importar los modales y nuevos iconos**

```ts
import { Plus, Power, KeyRound, ChevronRight, Users, X, Eye, EyeOff, RefreshCw, Trash2, LayoutGrid, AppWindow, Minus } from 'lucide-react'
// ...
import { BulkAddAppsModal } from '@/components/admin/BulkAddAppsModal'
import { BulkRemoveAppsModal } from '@/components/admin/BulkRemoveAppsModal'
```

- [ ] **Step 10.2: Añadir state**

Junto al resto:
```ts
const [bulkAddOpen, setBulkAddOpen] = useState(false)
const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)
const [bulkSummary, setBulkSummary] = useState<
  | { kind: 'add'; granted: number; skipped_same_role: number; conflicts_resolved: number; warnings: number }
  | { kind: 'remove'; revoked: number; skipped_not_assigned: number }
  | null
>(null)
```

- [ ] **Step 10.3: Añadir botones en la barra de tabs**

Localizar la fila `flex gap-2 mb-5 flex-wrap items-center` (línea ~264). Donde hoy se renderiza el botón "Eliminar seleccionados" (línea ~279-289), reemplazar por:

```tsx
{selected.size > 0 && (
  <div className="ml-auto flex items-center gap-2">
    <button
      onClick={() => setBulkAddOpen(true)}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
    >
      <Plus className="w-4 h-4" />
      Añadir apps ({selected.size})
    </button>
    <button
      onClick={() => setBulkRemoveOpen(true)}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <Minus className="w-4 h-4" />
      Quitar apps ({selected.size})
    </button>
    <button
      onClick={handleBulkDelete}
      disabled={deleting}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60"
    >
      <Trash2 className="w-4 h-4" />
      {deleting ? 'Eliminando…' : `Eliminar (${selected.size})`}
    </button>
  </div>
)}
```

- [ ] **Step 10.4: Renderizar los modales y el summary panel**

Junto al `<UserAppsDrawer>` (recién añadido en Task 5):

```tsx
{bulkAddOpen && (
  <BulkAddAppsModal
    users={[...selected].map((id) => users.find((u) => u.id === id)!).filter(Boolean)}
    onClose={() => setBulkAddOpen(false)}
    onApplied={(r) => {
      setBulkSummary({
        kind: 'add',
        granted: r.granted,
        skipped_same_role: r.skipped_same_role,
        conflicts_resolved: r.conflicts_resolved,
        warnings: r.skipped_no_company_access.length + r.skipped_cross_company.length,
      })
      setSelected(new Set())
      loadUsers()
      setTimeout(() => setBulkSummary(null), 6000)
    }}
  />
)}
{bulkRemoveOpen && (
  <BulkRemoveAppsModal
    users={[...selected].map((id) => users.find((u) => u.id === id)!).filter(Boolean)}
    onClose={() => setBulkRemoveOpen(false)}
    onApplied={(r) => {
      setBulkSummary({
        kind: 'remove',
        revoked: r.revoked,
        skipped_not_assigned: r.skipped_not_assigned,
      })
      setSelected(new Set())
      loadUsers()
      setTimeout(() => setBulkSummary(null), 6000)
    }}
  />
)}
```

Y debajo del bloque `{pullSummary && ...}` (línea ~243-261), añadir el panel del resumen bulk:

```tsx
{bulkSummary && (
  <div className="mb-5 rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-600">
    <div className="font-semibold text-gray-700 mb-1.5">
      {bulkSummary.kind === 'add' ? 'Apps añadidas' : 'Apps quitadas'}
    </div>
    <div className="flex flex-wrap gap-2">
      {bulkSummary.kind === 'add' ? (
        <>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
            + {bulkSummary.granted} {bulkSummary.granted === 1 ? 'asignación nueva' : 'asignaciones nuevas'}
          </span>
          {bulkSummary.skipped_same_role > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-600">
              {bulkSummary.skipped_same_role} ya {bulkSummary.skipped_same_role === 1 ? 'existía' : 'existían'}
            </span>
          )}
          {bulkSummary.conflicts_resolved > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
              {bulkSummary.conflicts_resolved} {bulkSummary.conflicts_resolved === 1 ? 'conflicto resuelto' : 'conflictos resueltos'}
            </span>
          )}
          {bulkSummary.warnings > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700">
              ⚠ {bulkSummary.warnings} {bulkSummary.warnings === 1 ? 'omitido' : 'omitidos'} (sin acceso de empresa o cross-company)
            </span>
          )}
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700">
            − {bulkSummary.revoked} {bulkSummary.revoked === 1 ? 'asignación revocada' : 'asignaciones revocadas'}
          </span>
          {bulkSummary.skipped_not_assigned > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-100 bg-gray-50 text-gray-500">
              {bulkSummary.skipped_not_assigned} {bulkSummary.skipped_not_assigned === 1 ? 'no asignada' : 'no asignadas'} (skip)
            </span>
          )}
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 10.5: Lint + build**

```bash
npm run lint && npm run build
```
Expected: ambos OK.

- [ ] **Step 10.6: Verificación manual end-to-end**

```bash
npm run dev
```
- Abrir `http://localhost:3000/admin/users` logueado como superadmin
- [ ] Marcar checkbox de 2-3 usuarios → aparecen botones "+ Añadir apps", "− Quitar apps", "🗑 Eliminar"
- [ ] Click "Añadir apps" → modal abre con título "Añadir apps a N usuarios"
- [ ] Marcar app, elegir rol → vista previa actualiza counts en vivo
- [ ] Si elegiste app+rol que ya tienen con ese rol → preview dice `N ya existentes`
- [ ] Si elegiste app que tienen con OTRO rol → preview dice `N conflictos de rol (se preguntará)`
- [ ] Click "Añadir apps" → en caso de conflictos, sub-modal con la lista
- [ ] Click "Sobrescribir" → modal cierra, summary panel arriba muestra `+ N nuevas · M conflictos resueltos`
- [ ] Verificar que los chips de la columna se actualizan tras el `loadUsers()` automático
- [ ] Click "Quitar apps" con varios marcados → modal solo muestra apps que al menos uno tiene
- [ ] Marcar una app, ver "X asignaciones serán revocadas" en la vista previa
- [ ] Confirmar → summary panel `− X asignaciones revocadas`
- [ ] Probar también con 1 solo usuario seleccionado, con 0 selección (botones desaparecen), con app que ningún seleccionado tiene (modal Quitar dice "Ningún usuario tiene apps")

Cerrar dev server.

- [ ] **Step 10.7: Commit**

```bash
git add src/app/(admin)/admin/users/page.tsx
git commit -m "$(cat <<'EOF'
feat(hub): wire bulk add/remove apps actions into users list

Adds two new bulk action buttons next to the existing Eliminar one
when checkboxes are selected. Wires the bulk modals, refreshes the
users list after applied operations, and surfaces a result summary
panel above the table mirroring the existing pullSummary pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Smoke pass final + edge cases

**Files:** ninguno necesariamente — esta tarea es verificación final. Si surge bug, edit + commit.

**Goal:** validar que todos los flujos del spec se comportan como esperamos antes de declarar feature done.

- [ ] **Step 11.1: Caso superadmin como objetivo de bulk-add**

Logueado como superadmin, seleccionar otro superadmin (si lo hubiera) o uno mismo, click "Añadir apps", elegir cualquier app+rol → ver que en `skipped_same_role` cuenta esos usuarios sin error (porque superadmin tiene "Todas" implícito).

- [ ] **Step 11.2: Caso usuario sin empresa**

En la BD (vía `npx prisma studio` o consola), localizar/crear un usuario con `company_id: null`. Marcarlo en el listado y hacer "Añadir apps" → ver que aparece en `skipped_no_company_access`. Summary panel muestra el badge ámbar.

- [ ] **Step 11.3: Caso admin (no superadmin) intentando cross-company**

(Opcional si no tienes un usuario admin de prueba.) Logueado como `admin` de empresa A, intentar llamar al endpoint via curl con un `user_id` de empresa B → ver que aparece en `skipped_cross_company`.

- [ ] **Step 11.4: Caso bulk-remove cuando ningún seleccionado tiene apps**

Crear (o seleccionar) usuarios sin app_roles. Click "Quitar apps" → modal dice "Ningún usuario tiene apps asignadas" + cerrar.

- [ ] **Step 11.5: Caso drawer + cambios sin guardar + cambio de fila**

Abrir drawer en usuario A, cambiar un rol, sin guardar click en otro chip de usuario B → confirm "¿Descartar?" aparece. Si "Aceptar" → drawer cambia a B. Si "Cancelar" → se queda en A.

- [ ] **Step 11.6: Responsive — drawer full-width en móvil**

DevTools → device toolbar → 375px ancho → abrir drawer → ocupa toda la pantalla.

- [ ] **Step 11.7: Verificar que las sub-apps reciben el sync**

Tras un bulk-add, revisar en la BD la tabla `sync_logs` o, si tienes una sub-app de prueba con su tabla `users`, verificar que el usuario aparece tras la sync. (Si las sub-apps no están corriendo en local, los logs de la consola `npm run dev` mostrarán los `[sync]` con su éxito/fallo).

- [ ] **Step 11.8: Si todo OK, no commitear nada nuevo**

Si surgieron bugs en 11.1-11.7, hacer fix + commit con mensaje descriptivo.

---

## Self-review (después de escribir el plan, antes de ejecutarlo)

Después de terminar las 11 tareas, revisar contra el spec (sección por sección):

- [ ] **5.1 Columna**: Task 1 (datos) + Task 2 (componente) + Task 3 (integración) ✓
- [ ] **5.2 Drawer**: Task 4 (componente) + Task 5 (integración) ✓
- [ ] **5.3 Bulk modals**: Task 7 (add) + Task 9 (remove); modales centrados, listas filtradas, vista previa, conflicto sub-modal ✓
- [ ] **5.4 Endpoints**: Task 6 (add) + Task 8 (remove); contrato de respuesta exacto ✓
- [ ] **5.5 Feedback summary panel**: Task 10 ✓
- [ ] **5.6 Sync sub-apps**: Tasks 6 y 8 invocan `pushUserToApps` ✓
- [ ] **6 Edge cases**: Task 11 cubre 4 de los 8 casos manualmente; los 4 restantes (drawer last-write-wins, AppRegistration faltante, 0 apps en modal, drawer dirty + click otra fila) están cubiertos en código por las Tasks 4/5/7/8
- [ ] **7 Permisos**: Tasks 6 y 8 usan `getSession` + `hasPermission('users:manage')` + scoping cross-company ✓
- [ ] **10 Estructura de ficheros**: 6 nuevos + 2 modificados, todos enumerados ✓
