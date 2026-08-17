import { z } from 'zod'

// Édition des métadonnées d'un mouvement (admin-only). Seuls `reason` et
// `contact_id` sont éditables. Les champs sont optionnels : seul ce qui est
// présent dans le patch est envoyé (sémantique PATCH côté edge).
export const editMovementSchema = z.object({
  reason: z.string().max(500, 'Le motif ne peut pas dépasser 500 caractères').nullable().optional(),
  contactId: z.string().uuid('Contact invalide').nullable().optional(),
})

export type EditMovementInput = z.infer<typeof editMovementSchema>
