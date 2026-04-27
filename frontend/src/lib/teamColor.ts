/**
 * teamColor — deterministic color utilities for team avatars.
 *
 * Used by LeftNav, MainPanel, and RightChatPanel to ensure consistent
 * avatar gradients and accent colors across the dashboard layout.
 */

/** Gradient palette for team avatars (24–40px squares). */
const GRADIENTS = [
  'linear-gradient(135deg,#bc8cff,#9f73e2)',
  'linear-gradient(135deg,#58a6ff,#388bfd)',
  'linear-gradient(135deg,#3fb950,#2ea043)',
  'linear-gradient(135deg,#d29922,#b08800)',
  'linear-gradient(135deg,#f85149,#da3633)',
  'linear-gradient(135deg,#58a6ff,#79c0ff)',
]

/** Flat accent colors used for the chat panel top-border and context dot. */
const ACCENTS = ['#bc8cff', '#58a6ff', '#3fb950', '#d29922', '#f85149', '#79c0ff']

/** Deterministic hash so the same team id always maps to the same slot. */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h
}

/**
 * Returns a CSS gradient string for a team avatar background.
 * Result is deterministic for a given `teamId`.
 */
export function teamGradient(teamId: string): string {
  return GRADIENTS[hashId(teamId) % GRADIENTS.length]
}

/**
 * Returns a flat accent hex color for a team (used for top-border,
 * context dots, etc.).
 * Result is deterministic for a given `teamId`.
 */
export function teamAccent(teamId: string): string {
  return ACCENTS[hashId(teamId) % ACCENTS.length]
}
