import { z } from 'zod'

export const contactSchema = z.object({
  type: z.enum(['SUPPLIER', 'CUSTOMER']),
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide').or(z.literal('')).nullable(),
  phone: z.string().max(30).or(z.literal('')).nullable(),
  address: z.string().max(500).or(z.literal('')).nullable(),
  taxId: z.string().max(50).or(z.literal('')).nullable(),
  notes: z.string().max(1000).or(z.literal('')).nullable(),
  isActive: z.boolean().default(true),
})

export type ContactFormData = z.infer<typeof contactSchema>
