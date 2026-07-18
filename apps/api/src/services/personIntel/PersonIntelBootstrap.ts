/**
 * PersonIntelBootstrap
 *
 * Starts all Person Intelligence Platform services in the correct order:
 * 1. PersonProfileStore  — sync profiles from IdentityFusionEngine
 * 2. PersonTimelineEngine — subscribe to VMS event bus + Analytics platform
 * 3. PersonSearchEngine  — build in-memory indices
 * 4. PersonRelationshipEngine — start nightly computation scheduler
 *
 * Call initPersonIntelPlatform() from server.ts after initAnalyticsPlatform().
 */

import { personProfileStore }       from './PersonProfileStore';
import { personTimelineEngine }     from './PersonTimelineEngine';
import { personSearchEngine }       from './PersonSearchEngine';
import { personRelationshipEngine } from './PersonRelationshipEngine';

let bootstrapped = false;

export async function initPersonIntelPlatform(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  console.log('[PersonIntelPlatform] Bootstrapping...');

  // 1. Sync profiles from IdentityFusionEngine (includes initial Firestore load)
  await personProfileStore.start();

  // 2. Subscribe to event buses (non-blocking, listeners only)
  personTimelineEngine.start();

  // 3. Build search indices from loaded profiles
  await personSearchEngine.start();

  // 4. Start nightly relationship computation
  personRelationshipEngine.startNightlyScheduler();

  console.log('[PersonIntelPlatform] Bootstrap complete.');
}
