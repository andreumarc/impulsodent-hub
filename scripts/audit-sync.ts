/**
 * CLI wrapper around `runAudit()` from `src/lib/audit-sync.ts`.
 *
 * Usage (from impulsodent-hub root):
 *   pnpm tsx --env-file .env.local scripts/audit-sync.ts
 *   npx  tsx --env-file .env.local scripts/audit-sync.ts
 *
 * Output:
 *   - Markdown report → docs/audits/audit-YYYY-MM-DD.md
 *   - Raw JSON       → docs/audits/audit-YYYY-MM-DD.json
 *   - stdout summary table
 *
 * Exit code: 0 if no error-severity findings, 1 otherwise.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runAudit, type AuditReport, type AppAuditResult } from '../src/lib/audit-sync'

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

function statusBadge(a: AppAuditResult): string {
  if (!a.app_url) return 'no-url'
  if (!a.reachable) return 'unreachable'
  const u = a.users_endpoint_status
  const c = a.clinics_endpoint_status
  if (u === 200 && c === 200) return 'ok'
  if (u !== 200 && c !== 200) return 'both-fail'
  if (u !== 200) return 'users-fail'
  return 'clinics-fail'
}

function renderStdoutSummary(report: AuditReport): string {
  const lines: string[] = []
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`  ImpulsoDent Sync Audit · ${report.generated_at}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(`Hub: ${report.hub.users.length} users · ${report.hub.companies.length} companies · ${report.hub.clinics.length} clinics (across all apps)`)
  lines.push(`Apps configured: ${report.summary.total_apps_configured} (${report.summary.apps_reachable} reachable, ${report.summary.apps_unreachable} unreachable)`)
  lines.push(`Findings: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.infos} info`)
  lines.push('')
  lines.push(pad('app_id', 22) + pad('status', 14) + pad('users (got/exp)', 18) + pad('clinics (got/exp)', 20) + 'issues')
  lines.push('─'.repeat(110))
  for (const a of report.apps) {
    const issues = [
      a.orphan_users.length     ? `O-u:${a.orphan_users.length}`     : '',
      a.missing_users.length    ? `M-u:${a.missing_users.length}`    : '',
      a.role_mismatches.length  ? `R-d:${a.role_mismatches.length}`  : '',
      a.orphan_clinics.length   ? `O-c:${a.orphan_clinics.length}`   : '',
      a.missing_clinics.length  ? `M-c:${a.missing_clinics.length}`  : '',
    ].filter(Boolean).join(' ') || '—'
    lines.push(
      pad(a.app_id, 22) +
      pad(statusBadge(a), 14) +
      pad(`${a.app_users_returned.length}/${a.hub_users_expected.length}`, 18) +
      pad(`${a.app_clinics_returned.length}/${a.hub_clinics_expected.length}`, 20) +
      issues
    )
  }
  lines.push('')
  lines.push('Legend: O-u=orphan users · M-u=missing users · R-d=role drift · O-c=orphan clinics · M-c=missing clinics')
  lines.push('')
  return lines.join('\n')
}

function renderMarkdown(report: AuditReport): string {
  const today = report.generated_at.slice(0, 10)
  const lines: string[] = []
  lines.push(`# ImpulsoDent Hub ↔ sub-apps sync audit · ${today}`)
  lines.push('')
  lines.push(`Generated: \`${report.generated_at}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Hub state**: ${report.hub.users.length} active users · ${report.hub.companies.length} companies · ${report.hub.clinics.length} clinic rows (one per app)`)
  lines.push(`- **Apps configured**: ${report.summary.total_apps_configured}`)
  lines.push(`- **Apps reachable**: ${report.summary.apps_reachable} / ${report.summary.total_apps_configured}`)
  lines.push(`- **Findings**: ${report.summary.errors} errors · ${report.summary.warnings} warnings · ${report.summary.infos} info`)
  lines.push('')

  lines.push('## Hub canonical state')
  lines.push('')
  lines.push('### Users')
  lines.push('')
  lines.push('| Email | Name | Role | Active | Companies | clinic_access_all |')
  lines.push('|---|---|---|---|---|---|')
  for (const u of report.hub.users) {
    lines.push(`| ${u.email} | ${u.name} | ${u.role} | ${u.active ? '✅' : '⚠️'} | ${u.company_slugs.join(', ') || '—'} | ${u.clinic_access_all ? '✅' : '❌'} |`)
  }
  lines.push('')
  lines.push('### Companies')
  lines.push('')
  lines.push('| Slug | Name | Active |')
  lines.push('|---|---|---|')
  for (const c of report.hub.companies) {
    lines.push(`| ${c.slug} | ${c.name} | ${c.active ? '✅' : '⚠️'} |`)
  }
  lines.push('')
  lines.push('### Clinics (per app)')
  lines.push('')
  if (report.hub.clinics.length === 0) {
    lines.push('_No clinics in Hub._')
  } else {
    lines.push('| App | External ID | Name | Company |')
    lines.push('|---|---|---|---|')
    for (const c of report.hub.clinics) {
      lines.push(`| ${c.app_id} | \`${c.external_id}\` | ${c.name} | ${c.company_slug} |`)
    }
  }
  lines.push('')

  lines.push('## Per-app results')
  lines.push('')
  lines.push('| App | Status | Users (got/exp) | Clinics (got/exp) | Orphan U | Missing U | Role drift | Orphan C | Missing C |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const a of report.apps) {
    lines.push(
      `| ${a.app_id} | ${statusBadge(a)} | ${a.app_users_returned.length}/${a.hub_users_expected.length} | ${a.app_clinics_returned.length}/${a.hub_clinics_expected.length} | ${a.orphan_users.length} | ${a.missing_users.length} | ${a.role_mismatches.length} | ${a.orphan_clinics.length} | ${a.missing_clinics.length} |`,
    )
  }
  lines.push('')

  lines.push('## Findings (action items)')
  lines.push('')
  if (report.findings.length === 0) {
    lines.push('No findings — all sub-apps in sync with Hub.')
  } else {
    const errors = report.findings.filter((f) => f.severity === 'error')
    const warnings = report.findings.filter((f) => f.severity === 'warning')
    if (errors.length > 0) {
      lines.push('### Errors')
      lines.push('')
      for (const f of errors) {
        lines.push(`- **[${f.app_id}] ${f.category}** — ${f.message}`)
      }
      lines.push('')
    }
    if (warnings.length > 0) {
      lines.push('### Warnings')
      lines.push('')
      for (const f of warnings) {
        lines.push(`- **[${f.app_id}] ${f.category}** — ${f.message}`)
      }
      lines.push('')
    }
  }

  lines.push('## Per-app detail')
  lines.push('')
  for (const a of report.apps) {
    lines.push(`### ${a.app_id}`)
    lines.push('')
    lines.push(`- URL: \`${a.app_url ?? '—'}\``)
    lines.push(`- Reachable: ${a.reachable ? '✅' : '❌'}`)
    lines.push(`- Users endpoint: ${a.users_endpoint_status ?? 'no-response'}`)
    lines.push(`- Clinics endpoint: ${a.clinics_endpoint_status ?? 'no-response'}`)
    if (a.errors.length > 0) {
      lines.push(`- Errors: ${a.errors.map((e) => `\`${e}\``).join(', ')}`)
    }
    if (a.orphan_users.length > 0) {
      lines.push('')
      lines.push(`**Orphan users (delete from sub-app):**`)
      for (const u of a.orphan_users) {
        lines.push(`- ${u.email} (role=${u.role ?? '?'}, company=${u.company_slug ?? '?'})`)
      }
    }
    if (a.missing_users.length > 0) {
      lines.push('')
      lines.push(`**Missing users (re-push from Hub):**`)
      for (const u of a.missing_users) {
        lines.push(`- ${u.email} (expected role=${u.role ?? '?'}, company=${u.company_slug ?? '?'})`)
      }
    }
    if (a.role_mismatches.length > 0) {
      lines.push('')
      lines.push(`**Role drift:**`)
      for (const m of a.role_mismatches) {
        lines.push(`- ${m.email}: Hub=\`${m.hub_role}\`, app=\`${m.app_role}\``)
      }
    }
    if (a.orphan_clinics.length > 0) {
      lines.push('')
      lines.push(`**Orphan clinics (delete from sub-app):**`)
      for (const c of a.orphan_clinics) {
        lines.push(`- ${c.name} (id=\`${c.id}\`)`)
      }
    }
    if (a.missing_clinics.length > 0) {
      lines.push('')
      lines.push(`**Missing clinics (re-push from Hub):**`)
      for (const c of a.missing_clinics) {
        lines.push(`- ${c.name} (external_id=\`${c.id}\`)`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function main() {
  const startedAt = Date.now()
  console.log('[audit-sync] running…')
  let report: AuditReport
  try {
    report = await runAudit()
  } catch (err) {
    console.error('[audit-sync] FATAL:', err)
    process.exit(2)
  }

  const today = report.generated_at.slice(0, 10)
  const outDir = join(process.cwd(), 'docs', 'audits')
  mkdirSync(outDir, { recursive: true })
  const mdPath = join(outDir, `audit-${today}.md`)
  const jsonPath = join(outDir, `audit-${today}.json`)

  writeFileSync(mdPath, renderMarkdown(report), 'utf8')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(renderStdoutSummary(report))
  console.log(`Markdown: ${mdPath}`)
  console.log(`JSON:     ${jsonPath}`)
  console.log(`Elapsed:  ${(Date.now() - startedAt) / 1000}s`)

  process.exit(report.summary.errors > 0 ? 1 : 0)
}

void main()
