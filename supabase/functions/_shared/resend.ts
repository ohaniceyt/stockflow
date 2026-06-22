interface ResendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export async function sendEmail(options: ResendEmailOptions): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const from = options.from ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'StockFlow <team@updates.stockflow.grandigix.com>'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  })

  const data = (await response.json()) as { id?: string; message?: string; name?: string }

  if (!response.ok) {
    throw new Error(data?.message ?? `Resend API error: ${response.status}`)
  }

  if (!data.id) {
    throw new Error('Resend did not return an email id')
  }

  return { id: data.id }
}
