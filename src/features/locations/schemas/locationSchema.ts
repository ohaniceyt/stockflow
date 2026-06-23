import { z } from 'zod'

export const locationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, '100 caractères maximum'),
  description: z.string().max(500, '500 caractères maximum').nullable().optional(),
  address: z.string().max(500, '500 caractères maximum').nullable().optional(),
})

export type LocationFormData = z.infer<typeof locationSchema>
