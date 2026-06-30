/**
 * Shared HTML escaping helpers for email templates.
 *
 * All user-controlled values interpolated into HTML email bodies MUST be
 * escaped through `escapeHtml` to prevent injection of tags / event handlers.
 * Use `escapeHtmlAttribute` for values placed inside HTML attributes.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char] ?? char)
}

export function escapeHtmlAttribute(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
