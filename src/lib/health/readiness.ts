import type { LudwiseApi } from '../api/client.js';
import type { Environment } from '../config/index.js';

/** The backend methods that the staging probe must prove. */
export type BackendReadProbe = Pick<LudwiseApi, 'searchGames' | 'browseSales'>;

/**
 * True only for the staging backend probe.
 *
 * The probe stays on `/api/health`. Cloudflare Access protects that path with
 * the service token. A query does not change the Access application.
 *
 * Production ignores the query. This prevents a public liveness request from
 * starting backend work.
 */
export function wantsBackendReadiness(environment: Environment, url: URL): boolean {
  return environment === 'staging' && url.searchParams.get('check') === 'backend';
}

/** Runs the two backend reads that deployed pages depend on. */
export async function verifyBackendReadiness(backend: BackendReadProbe): Promise<void> {
  await backend.searchGames();
  await backend.browseSales();
}
