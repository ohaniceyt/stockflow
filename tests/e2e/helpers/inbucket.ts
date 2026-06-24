/**
 * Helpers to read emails captured by the local Inbucket instance.
 * Requires `npx supabase start` to be running (Inbucket is on port 54324).
 */

export interface InbucketMessage {
  id: string
  from: string
  to: string[]
  subject: string
  date: string
}

export interface InbucketMailbox {
  mailbox: string
  messages: InbucketMessage[]
}

export interface InbucketMessageDetail {
  id: string
  from: string
  to: string[]
  subject: string
  date: string
  text: string
  html: string
  size: number
}

const INBUCKET_URL = process.env.INBUCKET_URL ?? 'http://localhost:54324'

export async function listMessages(email: string): Promise<InbucketMessage[]> {
  const mailbox = email.replace(/@.*/, '')
  const res = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Inbucket list failed: ${String(res.status)} ${await res.text()}`)
  }
  const data = (await res.json()) as InbucketMailbox
  return data.messages
}

export async function getMessage(email: string, id: string): Promise<InbucketMessageDetail> {
  const mailbox = email.replace(/@.*/, '')
  const res = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${id}`)
  if (!res.ok) {
    throw new Error(`Inbucket get failed: ${String(res.status)} ${await res.text()}`)
  }
  return (await res.json()) as InbucketMessageDetail
}

export async function findLatestMessage(
  email: string,
  subjectIncludes: string
): Promise<InbucketMessageDetail | null> {
  const messages = await listMessages(email)
  const match = messages
    .slice()
    .reverse()
    .find((m) => m.subject.toLowerCase().includes(subjectIncludes.toLowerCase()))
  if (!match) return null
  return getMessage(email, match.id)
}

export function extractLink(text: string, pathPrefix: string): string | null {
  // Try plain text first, then strip basic HTML tags and try again.
  const candidates = [text, text.replace(/<[^>]+>/g, ' ')]
  const escaped = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`https?://[^\\s<>"{}|\\^\\[\\]]*${escaped}[^\\s<>"{}|\\^\\[\\]]*`)

  for (const candidate of candidates) {
    const match = candidate.match(regex)
    if (match?.[0]) return match[0]
  }
  return null
}

export async function waitForMessage(
  email: string,
  subjectIncludes?: string,
  options: { timeoutMs?: number; pollMs?: number } = {}
): Promise<InbucketMessageDetail> {
  const { timeoutMs = 15000, pollMs = 500 } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const messages = await listMessages(email)
    if (messages.length > 0) {
      const match = subjectIncludes
        ? messages
            .slice()
            .reverse()
            .find((m) => m.subject.toLowerCase().includes(subjectIncludes.toLowerCase()))
        : messages[messages.length - 1]
      if (match) return getMessage(email, match.id)
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  const criterion = subjectIncludes ? `matching "${subjectIncludes}"` : ''
  throw new Error(`Timed out waiting for email ${criterion} for ${email}`)
}
