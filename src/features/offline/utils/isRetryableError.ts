/**
 * Decide whether a failed Edge Function / RPC call should be retried (queued for
 * sync) or surfaced to the user as a non-retryable business/client error.
 *
 * Retryable: network/offline, timeouts, and 5xx server errors.
 * Non-retryable: 4xx client errors and known business-rule violations.
 */
export function isRetryableError(err: unknown): err is Error {
  if (!(err instanceof Error)) return false

  const status = (err as { status?: number }).status
  if (typeof status === 'number') {
    // 4xx client errors will not fix themselves by retrying.
    if (status >= 400 && status < 500) return false
    // 5xx, 429, and other server-side failures are retryable.
    return true
  }

  const msg = err.message.toLowerCase()

  // Corruption / conflict errors need manual intervention.
  if (msg.includes('checksum')) return false
  if (msg.includes('conflit de synchronisation')) return false

  // Business validation errors that will not be fixed by retrying.
  if (msg.includes('stock insuffisant')) return false
  if (msg.includes('rôle insuffisant')) return false
  if (msg.includes('produit ou emplacement non autorisé')) return false
  if (msg.includes('produit et emplacement requis')) return false
  if (msg.includes('emplacement cible non autorisé')) return false
  if (msg.includes("l'emplacement cible doit être différent")) return false
  if (msg.includes('un transfert nécessite un emplacement cible')) return false
  if (msg.includes('type de mouvement invalide')) return false
  if (msg.includes('la quantité doit être')) return false
  if (msg.includes('session de caisse invalide ou fermée')) return false
  if (msg.includes('caisse non activée')) return false
  if (msg.includes('contact invalide')) return false
  if (msg.includes('opérateur non trouvé') || msg.includes('operator not found')) return false
  if (msg.includes('opération client invalide')) return false
  if (msg.includes('prix unitaire invalide')) return false
  if (msg.includes('la raison est invalide')) return false
  if (msg.includes('monthly movement limit')) return false
  if (msg.includes('organization suspended')) return false
  if (msg.includes('ce mouvement a déjà été enregistré')) return false
  if (msg.includes('session invalide, veuillez vous reconnecter')) return false

  // Duplicate client_operation_id means the operation was already applied.
  if (msg.includes('duplicate key value') && msg.includes('client_operation_id')) return false

  // Network errors, timeouts, and unclassified server failures are retryable.
  return true
}
