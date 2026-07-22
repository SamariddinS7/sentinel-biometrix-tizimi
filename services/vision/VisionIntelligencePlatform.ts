/**
 * VisionIntelligencePlatform — Unified Facade
 *
 * Single entry point for all vision capabilities. Routes requests to the
 * appropriate specialist service and auto-registers all results with the
 * VisualEvidenceEngine.
 */

export { analyzeLiveFrame }           from "./LiveVideoUnderstandingService.js";
export { runInvestigation }           from "./VideoInvestigationEngine.js";
export { analyzePersonAttributes }    from "./PersonAttributeAnalyzer.js";
export { analyzeVehicles }            from "./VehicleIntelligenceService.js";
export { extractOCR }                 from "./OCRIntelligenceService.js";
export { analyzeBehavior }            from "./SceneBehaviorAnalyzer.js";
export { reconstructTimeline, ingestObservation } from "./TimelineReconstructionService.js";
export {
  registerEvidence,
  getEvidence,
  queryEvidence,
  attachEvidence,
  exportEvidence,
  getEvidenceStats,
} from "./VisualEvidenceEngine.js";

export type { LiveAnalysisRequest, LiveAnalysisResult }         from "./LiveVideoUnderstandingService.js";
export type { InvestigationRequest, InvestigationResult }       from "./VideoInvestigationEngine.js";
export type { PersonAttributeRequest, PersonAttributeResult }   from "./PersonAttributeAnalyzer.js";
export type { VehicleIntelRequest, VehicleIntelResult }         from "./VehicleIntelligenceService.js";
export type { OCRRequest, OCRResult2 }                          from "./OCRIntelligenceService.js";
export type { BehaviorAnalysisRequest, BehaviorAnalysisResult } from "./SceneBehaviorAnalyzer.js";
export type { TimelineReconstructRequest, ReconstructedTimeline, TimelineType } from "./TimelineReconstructionService.js";
export type { EvidenceQuery }                                   from "./VisualEvidenceEngine.js";
export type {
  VisualObservation, DetectedObject, PersonAttributes, VehicleAttributes,
  OCRResult, BehaviorObservation, TimelineEntry, EvidenceAttachment, BoundingBox,
} from "./VisionObservation.js";
