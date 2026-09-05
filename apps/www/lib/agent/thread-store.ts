import type { Message } from "@ai-sdk/react"

/**
 * Minimal client-side thread memory backed by localStorage (no database).
 * Lets an agent conversation persist and resume across reloads.
 */

const KEY_PREFIX = "agent-thread:"

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

export function newThreadId(): string {
  // Avoid Math.random/Date collisions being an issue here — crypto is fine
  // client-side and this is only a local id.
  if (isBrowser() && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function loadThread(id: string): Message[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + id)
    return raw ? (JSON.parse(raw) as Message[]) : []
  } catch {
    return []
  }
}

export function saveThread(id: string, messages: Message[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(messages))
  } catch {
    // Ignore quota / serialization errors — memory is best-effort.
  }
}
