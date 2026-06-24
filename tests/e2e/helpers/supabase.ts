/**
 * Helpers Supabase pour nettoyer les données de test E2E.
 * Nécessite les variables d'environnement :
 *   - E2E_SUPABASE_URL
 *   - E2E_SUPABASE_SERVICE_ROLE_KEY
 *
 * En l'absence de ces variables, le teardown est silencieusement ignoré.
 */

const supabaseUrl = process.env.E2E_SUPABASE_URL
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY

export async function supabaseAdminQuery(sql: string) {
  if (!supabaseUrl || !serviceRoleKey) {
    // Variables manquantes : le teardown est silencieusement ignoré.
    return
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase SQL failed: ${String(res.status)} ${text}`)
  }
}

export async function cleanupE2EData(orgId: string) {
  if (!supabaseUrl || !serviceRoleKey) return

  await supabaseAdminQuery(`
    DELETE FROM public.movements WHERE org_id = '${orgId}';
    DELETE FROM public.inventory_counts WHERE session_id IN (
      SELECT id FROM public.inventory_sessions WHERE org_id = '${orgId}'
    );
    DELETE FROM public.inventory_sessions WHERE org_id = '${orgId}';
    DELETE FROM public.stock_levels WHERE org_id = '${orgId}';
    DELETE FROM public.contacts WHERE org_id = '${orgId}';
    DELETE FROM public.products WHERE org_id = '${orgId}';
    DELETE FROM public.locations WHERE org_id = '${orgId}';
  `)
}
