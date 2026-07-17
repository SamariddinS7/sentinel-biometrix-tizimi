/**
 * AnalyticsPlatformBootstrap
 *
 * Initialises the full Enterprise Analytics Platform:
 * 1. Registers all 8 analytics plugins
 * 2. Hooks into InferencePipeline.onFrameProcessed()
 * 3. Starts AnalyticsAlarmBroker
 * 4. Starts AnalyticsSearchIndex
 * 5. Starts AnalyticsReportEngine scheduler
 *
 * Call initAnalyticsPlatform() from vmsSystemManager or server startup.
 */

import { analyticsPlatform }     from './AnalyticsPlatform';
import { analyticsAlarmBroker }  from './AnalyticsAlarmBroker';
import { analyticsSearchIndex }  from './AnalyticsSearchIndex';
import { analyticsReportEngine } from './AnalyticsReportEngine';
import { heatmapPlugin }         from './plugins/HeatmapPlugin';
import { BehaviorPlugin }        from './plugins/BehaviorPlugin';
import { ObjectStatePlugin }     from './plugins/ObjectStatePlugin';
import { CrowdAnalyticsPlugin }  from './plugins/CrowdAnalyticsPlugin';
import { VehicleAnalyticsPlugin }from './plugins/VehicleAnalyticsPlugin';
import { OcrPlugin }             from './plugins/OcrPlugin';
import { FireSafetyPlugin }      from './plugins/FireSafetyPlugin';
import { PpeCompliancePlugin }   from './plugins/PpeCompliancePlugin';
import { aiInferencePipeline }   from '../ai/InferencePipeline';
import type { VideoFrame }       from '../ai/interfaces';
import type { TrackedObject }    from '../ai/DetectionTrackingEngine';

let bootstrapped = false;

export async function initAnalyticsPlatform(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  console.log('[AnalyticsPlatform] Bootstrapping Enterprise Analytics Platform...');

  // ── Register all analytics plugins ───────────────────────────────────────

  await analyticsPlatform.registerPlugin(new FireSafetyPlugin(),        { enabled: true, confidenceThreshold: 0.55 });
  await analyticsPlatform.registerPlugin(new PpeCompliancePlugin(),      { enabled: true, confidenceThreshold: 0.55, params: { requiredItems: ['HELMET', 'VEST'] } });
  await analyticsPlatform.registerPlugin(new VehicleAnalyticsPlugin(),   { enabled: true, confidenceThreshold: 0.45 });
  await analyticsPlatform.registerPlugin(new OcrPlugin(),                { enabled: true, confidenceThreshold: 0.65 });
  await analyticsPlatform.registerPlugin(new BehaviorPlugin(),           { enabled: true, confidenceThreshold: 0.50, params: { loiteringThresholdSec: 30 } });
  await analyticsPlatform.registerPlugin(new ObjectStatePlugin(),        { enabled: true, confidenceThreshold: 0.50, params: { abandonedThresholdSec: 60 } });
  await analyticsPlatform.registerPlugin(new CrowdAnalyticsPlugin(),     { enabled: true, confidenceThreshold: 0.50, params: { crowdThreshold: 10 } });
  await analyticsPlatform.registerPlugin(heatmapPlugin,                  { enabled: true, confidenceThreshold: 0.00, params: { emitIntervalMs: 60_000 } });

  // ── Hook into the InferencePipeline ──────────────────────────────────────
  // The pipeline's onFrameProcessed callback fires after each 12-stage cycle
  // with the confirmed tracks for that frame.

  aiInferencePipeline.onFrameProcessed(async (cameraId: string, tracks: TrackedObject[]) => {
    // Reconstruct a minimal VideoFrame reference for the analytics platform.
    // The frame buffer is already recycled by the pipeline at this point,
    // so we pass an empty placeholder; plugins that need pixel data (FireSafety,
    // PPE, Vehicle) receive frames via their own pipeline hook (see below).
    const placeholderFrame: VideoFrame = {
      id:        `af-${Date.now()}-${cameraId}`,
      cameraId,
      timestamp: Date.now(),
      width:     0,
      height:    0,
      buffer:    Buffer.alloc(0),
      format:    'RGB',
    };

    await analyticsPlatform.submitFrame(placeholderFrame, tracks, []).catch(console.error);
  });

  // ── Register raw-frame hook for vision plugins ────────────────────────────
  // Vision plugins (fire, PPE, vehicle, OCR) need the actual pixel buffer.
  // We register a direct frame-level hook via the pipeline's processedFrame callback.
  // This hook fires with the fully decoded RGB frame before buffer recycling.

  (aiInferencePipeline as any)._analyticsRawHook = async (
    frame: VideoFrame,
    tracks: TrackedObject[],
    allDetections: Array<{ classLabel: string; classIndex: number; confidence: number; box: import('../ai/interfaces').BoundingBox; trackId?: string }>,
  ) => {
    await analyticsPlatform.submitFrame(frame, tracks, allDetections).catch(console.error);
  };

  // ── Start support services ────────────────────────────────────────────────
  analyticsAlarmBroker.start();
  analyticsSearchIndex.start();
  analyticsReportEngine.startScheduler();

  console.log('[AnalyticsPlatform] Bootstrap complete. 8 plugins registered.');
}
