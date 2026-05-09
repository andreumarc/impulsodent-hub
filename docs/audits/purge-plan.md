# Plan de purga de huérfanos · ImpulsoDent suite

Generado tras la auditoría de `2026-05-09`. La regla one-way Hub → sub-apps prohíbe propagar huérfanos al Hub; la única acción válida es **eliminarlos del sub-app**.

## Cómo ejecutar

### Usuarios huérfanos (automatizable)

`scripts/purge-orphan-users.ts` desactiva en cada sub-app cualquier usuario que no exista en el Hub, usando el contrato canónico `POST /api/sync/user` con `{ email, active: false }`.

```
cd impulsodent-hub
npx tsx --env-file=.env.local scripts/purge-orphan-users.ts            # dry-run (recomendado primero)
npx tsx --env-file=.env.local scripts/purge-orphan-users.ts --apply    # destructivo
```

**Pre-requisito**: las nuevas implementaciones de `/api/sync/user` y `/api/sync/users` en sub-apps (impulsodent-crm, impulsodent-talent, clinicnps, clinicleads, ddc-duediligence, impulsodent-historiales, impulsodent-duediligence) y los fixes de zod (casos-clinicos, sync-adapter) tienen que estar **deployados** en Vercel. De lo contrario los POST `active=false` rebotarán con 400/404 y no surtirán efecto.

### Clínicas huérfanas (manual por sub-app)

No hay endpoint canónico de DELETE de clínicas — cada sub-app las gestiona en su propia admin UI. Listado por app en el audit MD generado:

- `clinicpnl`: 31 clínicas (incluye duplicados como "Badalona", "Bilbao", "Hospitalet" repetidos x2-3, y test-data como "Hub Audit Clinic", "Test", "ClinicStock Bilbao").
- `clinicvox`: 86 clínicas.
- `spendflow`: 97 clínicas.
- `fichaje`: 98 clínicas.
- `zentrix`: 90 clínicas.
- `dentalhr`: 36 clínicas.
- `dentalreports`: 18 clínicas.
- `clinicrefunds`: 110 clínicas.
- `nexora`: 97 clínicas.
- `clinicstock`: 105 clínicas.
- `impulsodent-crm`: 37 clínicas.
- `talent`/`impulsodent-talent` (alias): 99 clínicas.
- `clinicleads`: 2 clínicas.
- `sync-adapter`: 2 clínicas.
- `duediligence`: 112 clínicas.

Total: ~1.000 clínicas a revisar/borrar manualmente.

**Estrategia recomendada** dado que el Hub está vacío:

1. **Crear primero las empresas reales en Hub** desde `/admin/companies/new` (slugs `vidental`, `viadental`, `impulsodent`, etc. — los que tengas en producción).
2. **Crear las clínicas reales en Hub** desde `/admin/companies/[id]` (sección Clínicas → Nueva clínica). El Hub propaga al sub-app vía `POST /api/sync/clinics` con un `external_id` `hub_<hex>`. Las clínicas creadas así NO serán huérfanas.
3. **Después**, en cada sub-app, borra (UI o script ad-hoc) las clínicas cuyo `id` no empieza por `hub_` y no aparecen en `GET /api/sync/clinics` del Hub. Son las antiguas no canónicas.

Si la cantidad es excesiva, una opción más radical: drop+recreate de la tabla `Clinic` en cada sub-app desde Prisma Studio, y tras eso re-push desde Hub `/admin/companies/[id]` → "Crear clínica" para cada una.

## Datos canónicos a meter en Hub (decisión tuya)

El Hub tiene 0 empresas y 0 clínicas. Para que los pushes propaguen algo útil, hay que crear:

### Empresas
Inferidas de los emails huérfanos (probablemente reales, hay que verificar):

- `vidental` (de `*@vidental.com`: direccion, marketing, rrhh, direccion.igualada, direccion.hospitalet, operaciones)
- `viadental` (de `direccion@viadental.com`)
- `impulsodent` (de `impulsodent.direccion@impulsodent.com`)
- `impladent` (de `lorena.impladent@gmail.com`, `operaciones.impladent@gmail.com`)

### Demo user
**Ya creado** por `scripts/seed-demo-user.ts`. Credenciales canónicas:
- Email: `demo@impulsodent.com`
- Password: `Demo2026!`
- Rol: `demo` (read-only)

Push parcial: 4 sub-apps ok (clinicleads, duediligence + algunos más), 3 con errores que se han fixeado en código pero requieren re-deploy:
- `casos-clinicos`: zod schema rechazaba `company_slug: null` → fixeado.
- `sync-adapter`: zod schema rechazaba `company_slug: null` → fixeado.
- `historiales`: 401 Unauthorized → causa probable: env var `HUB_JWT_SECRET` mal configurada en Vercel del deploy de historiales. Verificar `vercel env pull` en el repo de historiales.

### Superadmin
Ya está. Pero **el cron de resync EXCLUYE explícitamente al superadmin** (`where: { role: { not: 'superadmin' } }` en `app/api/cron/resync-users/route.ts`), por lo que cualquier role drift no se autocorrige nunca. Para forzar resync:

```
npx tsx --env-file=.env.local scripts/force-push-superadmin.ts
```

Este script empuja a marcandreuguerao@gmail.com a todos los sub-apps. **Nota**: dental-hr rechaza explícitamente `role=superadmin` desde sync (se asigna sólo desde su admin UI por decisión del audit `[C-4]`). El drift ahí es by design.

## Endpoints rotos pendientes

| App | Endpoint | Status | Causa | Estado del fix |
|---|---|---|---|---|
| zentrix | `/api/sync/users` | 500 (body vacío) | Probable: prisma client desactualizado o env var faltante. Sin acceso a Vercel logs no se puede diagnosticar más. | **Pendiente** — necesita inspección del log de Vercel. |
| dental-hr | `/api/sync/users` | 200 con role drift | GET hardcodeaba `role: 'AUXILIAR'`. | **Fixed** local: ahora lee de tabla `UserRole`. Pendiente deploy. |
| historiales | POST `/api/sync/user` | 401 | Env var `HUB_JWT_SECRET` mal configurada en Vercel del deploy. | **Pendiente** — sólo es config Vercel. |

## Sub-apps con `/api/sync/users` recién creado (pendiente deploy)

Los siguientes endpoints fueron añadidos localmente pero requieren commit + push + deploy en Vercel para que el audit los vea responder 200:

- `impulsodent-crm`
- `impulsodent-talent` (también alias `talent`)
- `clinicnps` (users + GET clinics)
- `clinicleads`
- `impulsodent-duediligence`
- `ddc-duediligence` (users + clinics)
- `impulsodent-historiales` (users + fix auth en clinics GET)

Cada uno está como cambio local en su carpeta dentro de `C:/Users/IAPC/Desktop/.claude/`. Compilan limpio (`tsc --noEmit`).

## Orden de ejecución recomendado

1. **Hoy**: `git add` + commit + push de cada sub-app modificado (15 commits ~ 11 repos).
2. **Esperar deploys de Vercel** (~5 min por app).
3. **Re-ejecutar audit** desde Hub: `npx tsx --env-file=.env.local scripts/audit-sync.ts`. Verificar que todos los endpoints responden 200.
4. **Resolver el 500 de zentrix** mirando Vercel logs.
5. **Resolver el 401 de historiales POST** verificando `HUB_JWT_SECRET` en Vercel.
6. **Forzar push del superadmin** con `scripts/force-push-superadmin.ts`. Re-auditar.
7. **Crear las empresas reales** en Hub admin (`/admin/companies/new`). Crear las clínicas en cada empresa (`/admin/companies/[id]` → Nueva clínica).
8. **Dry-run de purge**: `scripts/purge-orphan-users.ts` → revisar lista.
9. **Apply purge**: `scripts/purge-orphan-users.ts --apply`.
10. **Purga manual de clínicas** en cada sub-app (UI admin o Prisma Studio).
11. **Re-auditar final**: cero huérfanos esperado.
