/**
 * Person Intelligence & Investigation Platform — public exports
 */

export { personProfileStore }        from './PersonProfileStore';
export { personTimelineEngine }      from './PersonTimelineEngine';
export { personInvestigationEngine } from './PersonInvestigationEngine';
export { personRelationshipEngine }  from './PersonRelationshipEngine';
export { personSearchEngine }        from './PersonSearchEngine';
export { personReportEngine }        from './PersonReportEngine';
export { personIntelApiRouter }      from './PersonIntelApiRouter';
export { initPersonIntelPlatform }   from './PersonIntelBootstrap';

export type {
  PersonProfile,
  FaceEntry,
  AppearanceSnapshot,
  MovementRecord,
  CameraVisit,
  RegistrationEvent,
  TimelineEntry,
  TimelineEntryType,
  RelationshipObservation,
  PersonStatistics,
  MovementReplayStep,
  InvestigationResult,
  PersonReport,
  PersonSearchQuery,
  PersonSearchResult,
  PersonStatus,
  ReportType,
  ReportPeriod,
} from './types/PersonProfile';
