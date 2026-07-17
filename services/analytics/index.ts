/**
 * Analytics Platform — public exports
 *
 * Import from this file to access the platform, plugins, and services.
 */

export { analyticsPlatform }        from './AnalyticsPlatform';
export { analyticsAlarmBroker }     from './AnalyticsAlarmBroker';
export { analyticsReportEngine }    from './AnalyticsReportEngine';
export { analyticsSearchIndex }     from './AnalyticsSearchIndex';
export { analyticsApiRouter, evidenceApiRouter } from './AnalyticsApiRouter';
export { heatmapPlugin }            from './plugins/HeatmapPlugin';

export { BehaviorPlugin }           from './plugins/BehaviorPlugin';
export { ObjectStatePlugin }        from './plugins/ObjectStatePlugin';
export { CrowdAnalyticsPlugin }     from './plugins/CrowdAnalyticsPlugin';
export { HeatmapPlugin }            from './plugins/HeatmapPlugin';
export { VehicleAnalyticsPlugin }   from './plugins/VehicleAnalyticsPlugin';
export { OcrPlugin }                from './plugins/OcrPlugin';
export { FireSafetyPlugin }         from './plugins/FireSafetyPlugin';
export { PpeCompliancePlugin }      from './plugins/PpeCompliancePlugin';

export type { AnalyticsEvent, AnalyticsEventType } from './types/AnalyticsEvent';
export type { IAnalyticsPlugin, AnalyticsContext }  from './types/AnalyticsPlugin';
export type { AnalyticsReportSummary, ReportPeriod } from './AnalyticsReportEngine';
export type { SearchQuery, SearchResult }             from './AnalyticsSearchIndex';
