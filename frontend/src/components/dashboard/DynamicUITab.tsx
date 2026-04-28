'use client'
/**
 * DynamicUITab — renders the MD-driven interactive UI tab (issue #389).
 *
 * Parses raw MD content (with optional YAML frontmatter) into a mix of:
 *   - Static HTML sections (via marked + DOMPurify, already in bundle)
 *   - Interactive elements: {{input:id:label}}, {{textarea:id:label}},
 *     {{dropdown:id:label:opt1,opt2,...}}, {{button:id:label}},
 *     {{value:key}} (read-only live display from persisted field data)
 *   - API-driven elements: {{apitable:api_key:col1,col2,...}},
 *     {{apilist:api_key:field}}
 *
 * API definitions live in the frontmatter `apis:` block:
 *
 *   apis:
 *     milestones:
 *       url: https://api.github.com/repos/owner/repo/milestones
 *       refresh: 120          # optional, seconds (default 60)
 *       headers:              # optional
 *         Authorization: Bearer <token>
 *     issues:
 *       url: https://api.github.com/repos/owner/repo/issues
 *
 * Fetching is client-side (works for CORS-enabled APIs).  API data is
 * display-only and is NOT persisted to ui_data.json.
 *
 * When locked (frontmatter locked:true OR UI.md.lock sentinel), all
 * interactive elements are rendered as disabled/read-only.
 */
import React, { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// ── API definition types ───────────────────────────────────────────────────────

interface ApiDef {
  url: string
  refresh: number               // seconds between re-fetches
  headers: Record<string, string>
  auth?: string                 // ${VAR_NAME} reference — resolved server-side via proxy
}

interface ApiState {
  data: unknown[] | null        // null = not yet loaded
  error: string | null
  loading: boolean
  lastFetched: number           // epoch ms
}

// ── Frontmatter parser ────────────────────────────────────────────────────────
//
// Handles flat key:value pairs AND the two-level `apis:` block without
// requiring an external YAML library.
//
//   apis:
//     <api_id>:            ← 2-space indent
//       url: <value>       ← 4-space indent
//       refresh: <number>
//       headers:           ← starts a headers sub-block
//         <Key>: <value>   ← 8-space indent (header entries)

interface Frontmatter {
  title?: string
  icon?: string
  apis?: Record<string, ApiDef>
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const fmText = match[1]
  const body = match[2]
  const meta: Frontmatter = {}
  const apis: Record<string, ApiDef> = {}

  let inApis = false
  let currentApi = ''
  let inHeaders = false

  for (const line of fmText.split('\n')) {
    // Detect top-level `apis:` key
    if (/^apis:\s*$/.test(line)) {
      inApis = true
      inHeaders = false
      continue
    }

    if (!inApis) {
      // Flat key:value
      const colon = line.indexOf(':')
      if (colon === -1) continue
      const key = line.slice(0, colon).trim()
      const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
      if (key === 'title') meta.title = val
      else if (key === 'icon') meta.icon = val
      continue
    }

    // Inside `apis:` block — classify by indent level
    const indentLen = (line.match(/^( *)/)?.[1] ?? '').length
    const content = line.trim()
    if (!content) continue

    // Exit apis block if we hit a non-indented line
    if (indentLen === 0) {
      inApis = false
      inHeaders = false
      continue
    }

    if (indentLen === 2) {
      // `  <api_id>:`
      currentApi = content.replace(/:$/, '')
      apis[currentApi] = { url: '', refresh: 60, headers: {} }
      inHeaders = false
    } else if (indentLen === 4 && currentApi) {
      if (/^headers:\s*$/.test(content)) {
        inHeaders = true
      } else {
        inHeaders = false
        const colon = content.indexOf(':')
        if (colon === -1) continue
        const key = content.slice(0, colon).trim()
        const val = content.slice(colon + 1).trim()
        if (key === 'url') apis[currentApi].url = val
        else if (key === 'refresh') apis[currentApi].refresh = parseInt(val) || 60
        else if (key === 'auth') apis[currentApi].auth = val
      }
    } else if (indentLen === 6 && currentApi && inHeaders) {
      // `      <Header-Name>: <value>`
      const colon = content.indexOf(':')
      if (colon === -1) continue
      const hKey = content.slice(0, colon).trim()
      const hVal = content.slice(colon + 1).trim()
      apis[currentApi].headers[hKey] = hVal
    }
  }

  if (Object.keys(apis).length > 0) meta.apis = apis
  return { meta, body }
}

// ── Token parsing ─────────────────────────────────────────────────────────────

type Segment =
  | { kind: 'md'; content: string }
  | { kind: 'token'; type: string; id: string; label: string; options: string[] }

function parseSegments(body: string): Segment[] {
  // Strip HTML comments BEFORE token extraction. Without this, any {{token}}
  // inside a <!-- ... --> documentation block (e.g. format spec at the top
  // of ui-extensions.md) would be parsed as a real token and rendered as
  // an interactive input. Comments are documentation; they should never
  // produce visible UI.
  const stripped = body.replace(/<!--[\s\S]*?-->/g, '')
  const parts = stripped.split(/({{[^}]+}})/)
  return parts
    .map(p => {
      if (!p.startsWith('{{')) return { kind: 'md', content: p } as Segment
      const inner = p.slice(2, -2)
      const pieces = inner.split(':')
      const [type = '', id = '', label = '', ...rest] = pieces
      const options = rest.join(':').split(',').map(s => s.trim()).filter(Boolean)
      return { kind: 'token', type, id, label, options } as Segment
    })
    .filter(s => s.kind !== 'md' || (s as { kind: 'md'; content: string }).content.trim() !== '')
}

// ── API data fetching hook ────────────────────────────────────────────────────
//
// Two-tier fetch model:
//   - No `auth` field  → fetch the external URL directly from the browser
//                        (works for CORS-enabled public APIs)
//   - Has `auth` field → route through /api/teams/{teamId}/ui/proxy/{key}
//                        so the backend resolves the credential server-side;
//                        the raw token never reaches the browser.

function useApiData(
  apis: Record<string, ApiDef> | undefined,
  teamId: string,
): Record<string, ApiState> {
  const [apiStates, setApiStates] = useState<Record<string, ApiState>>(() => {
    const init: Record<string, ApiState> = {}
    for (const key of Object.keys(apis ?? {})) {
      init[key] = { data: null, error: null, loading: false, lastFetched: 0 }
    }
    return init
  })

  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    if (!apis || Object.keys(apis).length === 0) return

    const fetchApi = async (key: string, def: ApiDef) => {
      setApiStates(prev => ({ ...prev, [key]: { ...prev[key], loading: true, error: null } }))
      try {
        let res: Response
        if (def.auth) {
          // Authenticated: backend proxy — credential resolved server-side
          res = await fetch(`/api/teams/${teamId}/ui/proxy/${encodeURIComponent(key)}`, {
            credentials: 'include',
          })
        } else {
          // Public: direct client-side fetch
          res = await fetch(def.url, {
            headers: Object.keys(def.headers).length > 0 ? def.headers : undefined,
          })
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const data = Array.isArray(json) ? json : [json]
        setApiStates(prev => ({
          ...prev,
          [key]: { data, error: null, loading: false, lastFetched: Date.now() },
        }))
      } catch (err) {
        setApiStates(prev => ({
          ...prev,
          [key]: { data: null, error: String(err), loading: false, lastFetched: Date.now() },
        }))
      }
    }

    // Initial fetch + set up refresh intervals
    for (const [key, def] of Object.entries(apis)) {
      if (!def.url) continue
      fetchApi(key, def)
      const interval = setInterval(() => fetchApi(key, def), def.refresh * 1000)
      timersRef.current[key] = interval
    }

    return () => {
      for (const t of Object.values(timersRef.current)) clearInterval(t)
      timersRef.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(apis)])

  return apiStates
}

// ── Value resolver (supports dot-notation for nested fields) ──────────────────

function resolveField(obj: unknown, path: string): string {
  if (obj == null) return '—'
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return '—'
    cur = (cur as Record<string, unknown>)[p]
  }
  if (cur == null) return '—'
  // Format ISO dates to readable form
  if (typeof cur === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(cur)) {
    return new Date(cur).toLocaleDateString()
  }
  return String(cur)
}

function humanize(field: string): string {
  return field.split(/[._]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── API table renderer ────────────────────────────────────────────────────────

function ApiSectionHeading({ heading, count }: { heading: string; count: number | null }) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
      margin: '14px 0 8px', display: 'flex', alignItems: 'baseline', gap: 8,
    }}>
      <span>{heading}</span>
      {count !== null && (
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
          ({count})
        </span>
      )}
    </h3>
  )
}

function UIApiTable({ apiKey, columns, state, heading }: {
  apiKey: string
  columns: string[]
  state: ApiState | undefined
  heading?: string
}) {
  const cellStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 13, borderBottom: '1px solid var(--border-default)',
    color: 'var(--text-primary)', verticalAlign: 'top',
  }
  const headStyle: React.CSSProperties = {
    ...cellStyle, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--bg-card)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.4px',
  }

  if (!state || state.loading) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={null} />}
        <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          ⏳ Loading {apiKey}…
        </div>
      </>
    )
  }
  if (state.error) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={null} />}
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#F85149', background: 'rgba(248,81,73,.08)', borderRadius: 6, marginBottom: 12 }}>
          ⚠ Failed to load <strong>{apiKey}</strong>: {state.error}
        </div>
      </>
    )
  }
  if (!state.data || state.data.length === 0) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={0} />}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No data for {apiKey}.</div>
      </>
    )
  }

  const cols = columns.length > 0 ? columns : Object.keys(state.data[0] as object).slice(0, 5)

  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      {heading && <ApiSectionHeading heading={heading} count={state.data.length} />}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr>
            {cols.map(c => <th key={c} style={headStyle}>{humanize(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {(state.data as Record<string, unknown>[]).map((row, i) => {
            const openN = Number(resolveField(row, 'open_issues'))
            const closedN = Number(resolveField(row, 'closed_issues'))
            const hasProgress = Number.isFinite(openN) && Number.isFinite(closedN) && (openN + closedN) > 0
            const link = resolveField(row, 'html_url')
            const num = resolveField(row, 'number')
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-base)' }}>
                {cols.map(c => {
                  const val = resolveField(row, c)
                  const isUrl = val.startsWith('http')
                  const isTitleCol = c === 'title'
                  return (
                    <td key={c} style={cellStyle}>
                      {isTitleCol && num && <RefId num={num} />}
                      {isUrl
                        ? <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{val}</a>
                        : val}
                      {isTitleCol && link && <ExternalLinkIcon href={link} />}
                      {isTitleCol && hasProgress && (
                        <div style={{ marginTop: 4, height: 4, width: '100%', borderRadius: 2, background: 'var(--bg-card)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round((closedN / (openN + closedN)) * 100)}%`,
                            background: openN === 0 ? 'var(--success, #3FB950)' : 'var(--accent, #58A6FF)',
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── API list renderer ─────────────────────────────────────────────────────────

function UIApiList({ apiKey, field, state, heading }: {
  apiKey: string
  field: string
  state: ApiState | undefined
  heading?: string
}) {
  if (!state || state.loading) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={null} />}
        <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>⏳ Loading {apiKey}…</div>
      </>
    )
  }
  if (state.error) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={null} />}
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#F85149', background: 'rgba(248,81,73,.08)', borderRadius: 6, marginBottom: 12 }}>
          ⚠ Failed to load <strong>{apiKey}</strong>: {state.error}
        </div>
      </>
    )
  }
  if (!state.data || state.data.length === 0) {
    return (
      <>
        {heading && <ApiSectionHeading heading={heading} count={0} />}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No data for {apiKey}.</div>
      </>
    )
  }

  return (
    <>
      {heading && <ApiSectionHeading heading={heading} count={state.data.length} />}
      <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
        {(state.data as Record<string, unknown>[]).map((row, i) => {
          const val = resolveField(row, field)
          const link = resolveField(row, 'html_url') || (val.startsWith('http') ? val : '')
          const num = resolveField(row, 'number')
          return (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
              {num && <RefId num={num} />}
              {val.startsWith('http')
                ? <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{val}</a>
                : val}
              {link && <ExternalLinkIcon href={link} />}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** `#NNN` reference — rendered in muted monospace before titles in apitable
    rows and apilist items. Helps users reference issues/PRs/milestones by
    number when chatting with the agent. */
function RefId({ num }: { num: string }) {
  return (
    <span style={{
      fontFamily: 'SF Mono, Menlo, monospace', fontSize: 11,
      color: 'var(--text-muted)', marginRight: 6,
    }}>#{num}</span>
  )
}

/** Small "open in new tab" icon — uses the row's html_url. Muted by default,
    accent-colored on hover. Same component used by both UIApiList and the
    title cell of UIApiTable so the icon style stays consistent. */
function ExternalLinkIcon({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open on GitHub"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginLeft: 6, width: 14, height: 14, borderRadius: 3,
        color: 'var(--text-muted)', textDecoration: 'none',
        fontSize: 11, lineHeight: 1, verticalAlign: 'middle',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
    >↗</a>
  )
}

// ── Static MD renderer ────────────────────────────────────────────────────────

function MDSection({ content }: { content: string }) {
  const html = DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
  return (
    <div
      className="dynamic-ui-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── Progress bar (GitHub-milestone style) ─────────────────────────────────────
//
// Rendered from {{progress:open:closed[:label]}} where `open` and `closed`
// are integers. Computes percentage, draws a thin green bar, and emits a
// stats line: "X% complete · N open · N closed".
//
// The agent can stack these between paragraphs / headings to build a
// milestones list that mirrors GitHub's UI without the renderer baking in
// any opinions about the surrounding layout.

function UIProgressBar({ open, closed, label }: { open: number; closed: number; label?: string }) {
  const total = open + closed
  const pct = total === 0 ? 0 : Math.round((closed / total) * 100)
  const isComplete = pct === 100
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        height: 6, width: '100%', borderRadius: 3,
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: isComplete ? 'var(--success, #3FB950)' : 'var(--accent, #58A6FF)',
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{
        marginTop: 6, fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        <span><strong style={{ color: 'var(--text-primary)' }}>{pct}%</strong> {label || 'complete'}</span>
        <span><strong style={{ color: 'var(--text-primary)' }}>{open}</strong> open</span>
        <span><strong style={{ color: 'var(--text-primary)' }}>{closed}</strong> closed</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  teamId: string
  content: string
}

export default function DynamicUITab({ teamId, content }: Props) {
  const { meta, body } = parseFrontmatter(content)
  const segments = parseSegments(body)
  const apiStates = useApiData(meta.apis, teamId)

  const renderToken = (seg: Exclude<Segment, { kind: 'md' }>, key: string | number) => {
    const { type, id, label, options } = seg
    if (type === 'progress') {
      // {{progress:open:closed[:label]}} — id holds open count, label holds closed,
      // first option is an optional label override.
      const open = parseInt(id, 10) || 0
      const closed = parseInt(label, 10) || 0
      const customLabel = options[0] || undefined
      return <UIProgressBar key={key} open={open} closed={closed} label={customLabel} />
    }
    if (type === 'apitable') {
      // {{apitable:api_key:col1,col2,col3[:Heading]}} — columns are comma-separated
      // in `label`; if a 4th positional arg is present it's used as the section
      // heading and "({count})" gets appended once data loads.
      const colsFromLabel = label.split(',').map(c => c.trim()).filter(Boolean)
      const heading = options[0] || undefined
      return <UIApiTable key={key} apiKey={id} columns={colsFromLabel} state={apiStates[id]} heading={heading} />
    }
    if (type === 'apilist') {
      // {{apilist:api_key:field[:Heading]}} — same convention.
      const heading = options[0] || undefined
      return <UIApiList key={key} apiKey={id} field={label || 'title'} state={apiStates[id]} heading={heading} />
    }
    return <code key={key} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{`{{${type}:${id}:${label}}}`}</code>
  }

  return (
    <div style={{ maxWidth: 880 }}>
      {/* Skeleton renderer — pure flat output. ALL layout, sections, and
          visual chrome are owned by the agent's ui-extensions.md (headings,
          paragraphs, <hr>, tokens). The renderer adds no toolbar, header,
          or wrapping cards of its own. */}
      {segments.map((seg, i) => seg.kind === 'md'
        ? <MDSection key={i} content={seg.content} />
        : renderToken(seg, i))}

      {/* Inline styles for the markdown body — overrides browser defaults so
          headings/lists/links match the rest of the dashboard. Scoped by the
          wrapper class so it doesn't bleed into the agent chat. */}
      <style>{`
        .dynamic-ui-md > *:first-child { margin-top: 0; }
        .dynamic-ui-md > *:last-child  { margin-bottom: 0; }
        .dynamic-ui-md h1 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 12px; letter-spacing: -0.01em; }
        .dynamic-ui-md h2 {
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--text-muted); margin: 18px 0 10px; padding-bottom: 6px;
          border-bottom: 1px solid var(--border-default);
        }
        .dynamic-ui-md h2:first-child { margin-top: 0; }
        .dynamic-ui-md h3 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 14px 0 8px; }
        .dynamic-ui-md p  { font-size: 13px; line-height: 1.55; color: var(--text-primary); margin: 0 0 10px; }
        .dynamic-ui-md p em { color: var(--text-muted); font-style: italic; }
        .dynamic-ui-md ul, .dynamic-ui-md ol { margin: 0 0 10px; padding-left: 20px; }
        .dynamic-ui-md li { font-size: 13px; line-height: 1.55; color: var(--text-primary); margin-bottom: 4px; }
        .dynamic-ui-md li::marker { color: var(--accent); }
        .dynamic-ui-md a  { color: var(--accent); text-decoration: none; }
        .dynamic-ui-md a:hover { text-decoration: underline; }
        .dynamic-ui-md strong { font-weight: 600; color: var(--text-primary); }
        .dynamic-ui-md code {
          font-family: 'SF Mono', Menlo, monospace; font-size: 12px;
          padding: 1px 6px; border-radius: 4px;
          background: var(--bg-card); color: var(--text-code);
        }
        .dynamic-ui-md pre {
          background: var(--bg-base); border: 1px solid var(--border-default);
          border-radius: 6px; padding: 10px 12px; overflow-x: auto; margin: 0 0 12px;
        }
        .dynamic-ui-md pre code { padding: 0; background: none; font-size: 12px; }
        .dynamic-ui-md hr {
          border: 0; border-top: 1px solid var(--border-default);
          margin: 16px 0;
        }
        .dynamic-ui-md table {
          width: 100%; border-collapse: collapse; font-size: 12px; margin: 0 0 12px;
        }
        .dynamic-ui-md th, .dynamic-ui-md td {
          border-bottom: 1px solid var(--border-default);
          padding: 6px 8px; text-align: left;
        }
        .dynamic-ui-md th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
        .dynamic-ui-md blockquote {
          margin: 0 0 12px; padding: 8px 12px;
          border-left: 3px solid var(--accent);
          background: var(--bg-card); color: var(--text-secondary);
          border-radius: 0 6px 6px 0;
        }
      `}</style>
    </div>
  )
}
