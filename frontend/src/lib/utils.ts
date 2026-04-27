/** Format current time as HH:MM (24h). Used for chat message timestamps. */
export function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
