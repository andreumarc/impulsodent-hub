# Hub — Asignación de apps a usuarios desde el panel de administración

**Fecha:** 2026-05-09
**Proyecto:** `impulsodent-hub`
**Ámbito:** `/admin/users` (listado y acciones)

## 1. Contexto y problema

El Hub (`app.impulsodent.com`) es la app central que gestiona usuarios, empresas y clínicas para todos los aplicativos de la suite ImpulsoDent (ClinicVox, DentalHR, ZENTRIX, Casos Clínicos, etc.).

El modelo `UserAppRole` (`prisma/schema.prisma:154-166`) ya soporta asignar a cada usuario un conjunto de apps con un rol por app y un scope de clínicas. Hoy esta asignación solo es editable desde la página de detalle de usuario (`/admin/users/[id]`), a través del componente `<AppsSection>` (`src/app/(admin)/admin/users/new/page.tsx:373-432`).

El listado de usuarios (`/admin/users`) **no muestra** las apps asignadas ni permite gestionarlas. Para asignar acceso a una nueva app a varios usuarios hay que entrar en cada uno por separado, editar y guardar — fricción alta cuando se trata de operaciones recurrentes (p. ej. "dar acceso a Casos Clínicos a todos los odontólogos").

## 2. Objetivo

Hacer que la asignación de apps a usuarios sea visible y gestionable desde el listado:

1. **Visibilidad**: una nueva columna "Apps" en la tabla muestra qué apps tiene cada usuario
2. **Acción rápida por fila**: un drawer lateral permite cambiar las apps de un usuario sin salir del listado
3. **Acción masiva**: dos operaciones — "Añadir apps a seleccionados" y "Quitar apps a seleccionados" — sobre los usuarios marcados con checkbox

## 3. Decisiones de producto (resumen de brainstorming)

| Decisión | Elegido | Razón |
|---|---|---|
| Funcionalidad | Columna + drawer + bulk (todo) | Cubre los tres casos de uso: ver, editar uno, editar muchos |
| Semántica del bulk | Operaciones puras separadas: bulk-add y bulk-remove | Evita destrucción accidental; consistente con admin panels modernos |
| Conflicto de rol en bulk-add | Sub-modal de confirmación: mantener o sobrescribir | Mínima sorpresa; el admin decide explícitamente |
| Display de la columna | Chips icono+abrev de 2 letras, hasta 4 + `+N` con tooltip | Reconocimiento visual + escalabilidad a usuarios con muchas apps |
| UI del drawer | Drawer lateral (no modal) que reusa `<AppsSection>` | Mantiene contexto del listado; permite navegación entre filas |
| Cómputo de conflictos | Híbrido: pre-vista optimista en cliente + verdad en servidor al aplicar | Feedback inmediato sin sacrificar correctitud |

## 4. Arquitectura — qué cambia y qué no

### Cambia
- 1 nueva columna en la tabla de `/admin/users`
- 1 botón nuevo "Apps" por fila (junto a Contraseña / Desactivar)
- 2 botones nuevos en la barra de selección masiva (junto a "Eliminar seleccionados")
- 1 drawer lateral (`<UserAppsDrawer>`)
- 2 modales (`<BulkAddAppsModal>`, `<BulkRemoveAppsModal>`) + 1 sub-modal de conflicto inline en el primero
- 2 endpoints API nuevos
- 1 ajuste a la respuesta de `GET /api/admin/users` para incluir `app_roles`

### No cambia
- `prisma/schema.prisma` — `UserAppRole` ya tiene los campos necesarios
- `<AppsSection>` (se reusa tal cual desde el drawer)
- `PUT /api/admin/users/[id]` — sigue siendo el endpoint usado por el drawer (acepta updates parciales)
- `lib/sync.ts:pushUserToApps` — se invoca desde los nuevos endpoints como hoy
- Modelo de roles ni permisos (`users:manage`, `requireAdmin`, scoping por empresa para `admin`)
- Páginas `/admin/users/[id]` ni `/admin/users/new`

## 5. Diseño detallado

### 5.1 Columna "Apps" en el listado

**Ubicación:** entre `Empresa` y `Estado`, breakpoint `hidden lg:table-cell` (mismo que `Empresa`).

**Componente:** `<UserAppsCell user={u} />` en `src/components/admin/UserAppsCell.tsx`.

**Render:**
- Hasta 4 chips visibles, cada uno de 24×24 px, `rounded-md`, `bg=app.bgColor`, `color=app.color`. Texto: `app.name.slice(0,2).toUpperCase()`, fontSize 10px bold. Mismo estilo que el icono usado en `<AppsSection>` (referencia: `users/new/page.tsx:404-407`) pero más pequeño (24px vs 28px)
- Si hay >4 apps: 4 chips + chip extra `+N` con `bg-gray-100 text-gray-500`
- Si hay 0 apps: guion `—` en gris claro
- Caso especial `user.role === 'superadmin'`: un único chip `Todas (N)` con estilo brand, donde `N = APPS.filter(a => !a.internal).length` calculado en cliente (paralelismo con `<CompaniesCell>` que muestra `Todas (count)` para empresas)

**Tooltip:** atributo `title` HTML nativo (sin popover JS).
- Por chip individual: `"ClinicVox · admin"`
- Por chip `+N`: lista multilínea de las apps no visibles con su rol
- Por chip `Todas`: `"Acceso a todas las apps (rol superadmin)"`

**Orden de los chips:** por `category` y luego alfabético dentro de categoría.

**Coste de fetch:** `GET /api/admin/users` añade `appRoles: { select: { app_id: true, role: true } }` al `include` de Prisma. Coste extra: una sola query con JOIN, despreciable para listas <500 usuarios.

### 5.2 Drawer lateral (acción rápida por fila)

**Componente:** `<UserAppsDrawer />` en `src/components/admin/UserAppsDrawer.tsx`.

**Trigger:** botón "Apps" en la columna `Acciones`, entre "Contraseña" y "Desactivar". Icono `LayoutGrid` (lucide).

**Dimensiones:** `w-[420px]`, full-height, `position: fixed; right: 0; top: 0;`. Backdrop `bg-black/20`.

**Estructura:**
- Header: avatar + nombre + email del usuario actual; botón `X`; link "Editar usuario completo →" → `/admin/users/[id]`
- Body: `<AppsSection>` reusado, con props `appRoles` y `setAppRoles` controladas desde el drawer
- Aviso bajo el body: "ⓘ Las clínicas globales se editan desde Editar usuario."
- Footer: `[Cancelar]` + `[Guardar cambios]` (loading state durante PUT)

**Comportamientos:**
- ESC cierra (con `window.confirm()` si hay cambios sin guardar — mismo patrón que `handleBulkDelete` en `users/page.tsx:207`)
- Click en backdrop cierra (mismo confirm nativo)
- Click en otra fila de la tabla con drawer abierto → cambia el usuario del drawer (con confirm si hay cambios sin guardar)
- Tras guardar: feedback inline en el footer del drawer (`✓ Apps actualizadas`) + cierre automático tras 1.2s — mismo patrón que `PasswordModal` (`users/page.tsx:109-110`). La tabla se actualiza optimistamente (chips reflejan el cambio sin re-fetch al cerrar el drawer)

**Persistencia:** `PUT /api/admin/users/[id]` con `body = { app_roles: [...] }`. Solo se envía ese campo — el endpoint actual ya soporta updates parciales.

**Responsive:** `<768px` el drawer ocupa `w-full` con botón "← Volver al listado" arriba.

### 5.3 Bulk add / remove

**Disparadores:** cuando hay ≥1 fila seleccionada, en la barra de filtros (donde hoy aparece "Eliminar seleccionados") aparecen además:
- `[+ Añadir apps]` (verde brand)
- `[− Quitar apps]` (gris/borde)

#### 5.3.1 `<BulkAddAppsModal>`

Modal centrado tipo `PasswordModal`, `max-w-lg`. Lista filtrada `APPS.filter(a => !a.internal)`. Para cada app: checkbox + nombre + dropdown de rol (de `APP_ROLES`). Marcar checkbox habilita el dropdown.

**Vista previa en vivo (cliente, optimista):** mientras el admin marca apps, abajo se calcula con la data ya cargada en el listado:
- Cuántos usuarios recibirán acceso nuevo
- Cuántos ya la tienen con el mismo rol (skip)
- Cuántos ya la tienen con distinto rol (conflicto → se preguntará)

Botón submit deshabilitado hasta que haya ≥1 app marcada con rol.

#### 5.3.2 Sub-modal de conflicto

Si la respuesta del servidor a la primera llamada es `status: 'conflicts_pending'`, se muestra:

```
⚠ Conflictos de rol
2 usuarios ya tienen acceso con un rol distinto:
  • Marc Andreu — ClinicVox: tiene 'user', le darías 'admin'
  • Marta Asencio — DentalHR: tiene 'viewer', le darías 'user'

¿Qué hacemos?
  [Mantener su rol actual]    ← skip estos casos
  [Sobrescribir con el rol nuevo]
  [Cancelar]
```

La decisión es global para todos los conflictos detectados (no por usuario).

#### 5.3.3 `<BulkRemoveAppsModal>`

Modal con base de color rojo destructivo. Lista filtrada en cliente: solo apps que al menos un usuario seleccionado tiene asignadas. Cada línea muestra cuántos de los seleccionados la tienen ("4 usuarios la tienen").

Vista previa: "X asignaciones serán revocadas. Esta acción no se puede deshacer." Sin sub-modal de confirmación adicional — la vista previa es la confirmación.

Si ningún seleccionado tiene apps: modal único con "Ningún usuario tiene apps asignadas" + botón cerrar.

### 5.4 Endpoints

#### `POST /api/admin/users/bulk/apps/add`

**Auth:** `users:manage`. Si rol `admin`, los `user_ids` que no pertenezcan a su empresa se ignoran (reportados como `skipped_cross_company`).

**Flujo en dos fases (híbrido):**

**Primera llamada** (sin `on_conflict`):
```ts
body: {
  user_ids: string[]
  app_roles: { app_id: string; role: string }[]
}
```

Server categoriza cada par `(user, app)`:
- `to_grant` — usuario no tiene la app
- `same_role` — usuario ya tiene la app con el mismo rol → skip
- `conflict` — usuario tiene la app con otro rol
- `no_company_access` — empresa del usuario no tiene `CompanyAppAccess` para la app

Si hay ≥1 conflicto, **no escribe nada** y devuelve:
```ts
{
  status: 'conflicts_pending',
  conflicts: [
    { user_id, user_name, app_id, app_name, current_role, new_role }
  ],
  preview: { to_grant, same_role, no_company_access }
}
```

Si no hay conflictos, escribe y devuelve `status: 'applied'` con counts.

**Segunda llamada** (cuando hubo conflictos):
```ts
body: {
  user_ids, app_roles,
  on_conflict: 'skip' | 'overwrite'
}
```

Server aplica con la decisión y devuelve:
```ts
{
  status: 'applied',
  granted: number,
  skipped_same_role: number,
  conflicts_resolved: number,
  skipped_no_company_access: { user_id: string; app_id: string }[],
  skipped_cross_company: string[]
}
```

#### `POST /api/admin/users/bulk/apps/remove`

Una sola fase.
```ts
body: { user_ids: string[], app_ids: string[] }
response: {
  revoked: number,
  skipped_not_assigned: number,
  skipped_cross_company: string[]
}
```

#### `GET /api/admin/users` (modificación)

Se añade `app_roles: { app_id, role }[]` al objeto de cada usuario. Implementación: `include: { appRoles: { select: { app_id: true, role: true } } }` en la query Prisma de `listUsers`.

### 5.5 Feedback al cerrar bulk modals

Tras respuesta `applied` del servidor, ambos modales bulk cierran y se muestra un **panel de resumen inline** sobre la tabla (mismo patrón visual y posición que `pullSummary` en `users/page.tsx:244-261`):
- Bulk add: `"+ N asignaciones nuevas · M ya existían · K conflictos resueltos"` con badge verde
- Bulk remove: `"− N asignaciones revocadas"` con badge gris/rojo
- Si hay `skipped_no_company_access` o `skipped_cross_company`: badge ámbar con detalle expandible

El panel se auto-oculta a los 6s o cuando el admin haga otra acción.

### 5.6 Sync con sub-apps tras escribir

Tras `applied` (add o remove), por cada `user_id` afectado se invoca `pushUserToApps(user_id)` (existente en `lib/sync.ts`). Errores de sync **no bloquean** la respuesta — quedan registrados en `SyncLog` como hoy.

**Coste de bulk:** las invocaciones a `pushUserToApps` son síncronas dentro del request (igual que en el endpoint single actual). Para escala realista (≤50 usuarios × ≤5 apps por operación = ≤250 push calls a sub-apps), aceptable. Si en el futuro se observan timeouts en bulk grandes, mover a una cola de background (out of scope ahora).

## 6. Edge cases

| Caso | Comportamiento |
|---|---|
| Usuario sin empresa al hacer bulk-add | `skipped_no_company_access` (no puede tener app sin empresa con `CompanyAppAccess`) |
| Bulk-remove sobre apps que el usuario no tiene | `skipped_not_assigned` — silent, no error |
| Drawer abierto, otro admin edita el mismo usuario | Last-write-wins. Aceptable: probabilidad baja, no es transaccional crítico |
| Sub-app cuya `AppRegistration` no está configurada | `pushUserToApps` falla silenciosamente y queda en `SyncLog`. La asignación local en BD se mantiene |
| 0 apps marcadas en `<BulkAddAppsModal>` | Botón "Añadir" deshabilitado |
| `<BulkRemoveAppsModal>` cuando ningún seleccionado tiene apps | Modal con "Ningún usuario tiene apps asignadas" + cerrar |
| Superadmin como target de bulk-add | Funciona, vista previa lo refleja como "ya tiene acceso (superadmin)" |
| Drawer + cambios sin guardar + click otra fila | Confirm: "¿Descartar cambios?" |

## 7. Permisos

Mismos que `/admin/users` actual:
- `superadmin` → todos los usuarios, todas las empresas
- `admin` (con permiso `users:manage`) → solo usuarios de su `companyId`. En bulk, los `user_ids` fuera de su empresa se reportan en `skipped_cross_company` y no se tocan

Validación en server. El cliente no se basa en permisos para mostrar/ocultar — los botones de bulk se ven igual; el server filtra.

## 8. Out of scope (NO en este diseño)

- Editar `clinic_access_all` o `clinic_ids` por app desde el drawer (sigue solo en edit page completo)
- Acción "Cambiar rol en app a seleccionados" como tercer botón bulk (separable; añadir solo si surge demanda real)
- Auditoría dedicada de cambios bulk (registro de quién hizo qué, cuándo). El `SyncLog` actual ya da trazabilidad de las syncs hacia sub-apps; auditoría más rica sería un proyecto aparte
- Importar / exportar matrices de permisos (CSV)
- Filtro de listado por "usuarios sin acceso a X app" (potencialmente útil pero no necesario para el flujo de gestión actual)

## 9. Plan de testing

### Unit
- Categorización de pares `(user, app)` en el handler de `bulk/apps/add`: `to_grant` / `same_role` / `conflict` / `no_company_access`
- Selector de chips visibles en `<UserAppsCell>` (4 + `+N`, caso superadmin, caso 0 apps)

### Integration
- `POST /api/admin/users/bulk/apps/add` — flujo en dos fases con conflictos (`conflicts_pending` → `applied`)
- `POST /api/admin/users/bulk/apps/add` — flujo directo sin conflictos (`applied` en una llamada)
- `POST /api/admin/users/bulk/apps/remove` — caso normal y caso "ninguna asignación previa"
- Scoping de `admin`: bulk con `user_ids` de otra empresa → ignorados con `skipped_cross_company`
- Cobertura de `pushUserToApps` invocado por usuario afectado

### Manual / E2E
- Drawer: transición entre filas con cambios sin guardar
- Drawer: optimistic update de chips tras guardar
- Bulk add con preview en cliente vs respuesta real del servidor en presencia de conflictos
- Responsive: drawer en pantallas <768px ocupa full-width
- Tooltip de `+N` muestra lista correcta

## 10. Estructura de ficheros nuevos/modificados

### Nuevos
- `src/components/admin/UserAppsCell.tsx`
- `src/components/admin/UserAppsDrawer.tsx`
- `src/components/admin/BulkAddAppsModal.tsx`
- `src/components/admin/BulkRemoveAppsModal.tsx`
- `src/app/api/admin/users/bulk/apps/add/route.ts`
- `src/app/api/admin/users/bulk/apps/remove/route.ts`

### Modificados
- `src/app/(admin)/admin/users/page.tsx` — añadir columna, integrar drawer y modales bulk, exponer `app_roles` en el state local
- `src/lib/db.ts` — `listUsers` debe incluir `appRoles`
- `src/app/api/admin/users/route.ts` — sin cambio funcional, hereda lo de `db.ts`
