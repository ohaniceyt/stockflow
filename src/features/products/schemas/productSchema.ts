import { z } from 'zod'

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Le nom est requis').max(200),
  category: z.string().max(100).nullable().optional(),
  unit: z.string().max(50).default('unité'),
  threshold: z.coerce.number().int().min(0).default(0),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  supplier: z.string().max(200).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
})

export type ProductFormData = z.infer<typeof productSchema>
