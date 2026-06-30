import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, 'ok' | 'fail' | 'warn'>;
  timestamp: string;
}

export async function runHealthCheck(supabase: SupabaseClient): Promise<HealthResult> {
  const checks: Record<string, 'ok' | 'fail' | 'warn'> = {};
  let status: HealthResult['status'] = 'healthy';

  // DB connectivity
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    checks.database = error ? 'fail' : 'ok';
  } catch {
    checks.database = 'fail';
  }

  // Auth service reachability
  try {
    const { error } = await supabase.auth.getSession();
    checks.auth = error && error.message !== 'No active session' ? 'fail' : 'ok';
  } catch {
    checks.auth = 'fail';
  }

  const failed = Object.values(checks).filter((c) => c === 'fail').length;
  const warnings = Object.values(checks).filter((c) => c === 'warn').length;
  if (failed > 0) status = 'unhealthy';
  else if (warnings > 0) status = 'degraded';

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}
