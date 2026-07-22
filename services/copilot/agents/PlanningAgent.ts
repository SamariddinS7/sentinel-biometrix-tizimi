/**
 * PlanningAgent
 *
 * Single responsibility: Given an intent and permission profile, produce an
 * ordered execution plan specifying which agents are needed and which can run
 * in parallel. Never calls the LLM.
 */

import type {
  IAgent, AgentMessage,
  PlanInput, PlanOutput, PlanStep, CopilotIntent,
} from "./types.js";
import { completeMessage, markRunning, failMessage } from "./types.js";

// ─── Plan templates per intent ────────────────────────────────────────────────

type PlanTemplate = Array<{
  agentName: string;
  dependsOn: string[];
  required: boolean;
  reason: string;
}>;

const PLAN_TEMPLATES: Record<CopilotIntent, PlanTemplate> = {
  VISUAL_ANALYSIS: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Live context enriches visual findings." },
    { agentName: "PerceptionAgent",    dependsOn: [], required: true,  reason: "Primary visual analysis." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent", "PerceptionAgent"], required: true, reason: "Aggregate evidence from vision + system." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Interpret and narrate findings." },
  ],
  ALARM_MANAGEMENT: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Must fetch current alarm list." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Bundle alarm data as evidence." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Prioritise and advise on alarms." },
  ],
  INVESTIGATION: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Background system state." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Gather person/event records." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Correlate evidence and guide investigation." },
  ],
  SYSTEM_HEALTH: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Retrieve metrics and status." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Package health data." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Diagnose and advise." },
  ],
  PERSON_SEARCH: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "System context for search." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Retrieve identity records." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Interpret and rank results." },
  ],
  REPORT_GENERATION: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Data source for report." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Compile report data." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Narrate report." },
  ],
  NAVIGATION: [
    { agentName: "ReasoningAgent",     dependsOn: [], required: true,  reason: "Map query to navigation target." },
  ],
  ACTION_REQUEST: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Current state needed to execute action safely." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Confirm preconditions." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "Plan and validate action." },
  ],
  GENERAL_INTELLIGENCE: [
    { agentName: "SystemContextAgent", dependsOn: [], required: true,  reason: "Contextual grounding." },
    { agentName: "EvidenceCollectionAgent", dependsOn: ["SystemContextAgent"], required: true, reason: "Relevant data aggregation." },
    { agentName: "ReasoningAgent",     dependsOn: ["EvidenceCollectionAgent"], required: true, reason: "General response." },
  ],
};

// ─── Agent Implementation ──────────────────────────────────────────────────────

export class PlanningAgent implements IAgent<PlanInput, PlanOutput> {
  readonly name = "PlanningAgent";
  readonly description =
    "Produces an ordered, dependency-aware execution plan for the intent and permission profile.";

  async execute(
    message: AgentMessage<PlanInput>
  ): Promise<AgentMessage<PlanInput, PlanOutput>> {
    const startMs = Date.now();
    const msg = markRunning(message);

    try {
      const { intent, hasImage } = msg.input;

      // Start from the template
      let template = PLAN_TEMPLATES[intent] ?? PLAN_TEMPLATES["GENERAL_INTELLIGENCE"];

      // Add PerceptionAgent if the query has image data and template doesn't include it
      if (hasImage && !template.some(s => s.agentName === "PerceptionAgent")) {
        template = [
          { agentName: "PerceptionAgent", dependsOn: [], required: true, reason: "Image attached — visual analysis needed." },
          ...template.map(s =>
            s.agentName === "EvidenceCollectionAgent"
              ? { ...s, dependsOn: [...s.dependsOn, "PerceptionAgent"] }
              : s
          ),
        ];
      }

      // Assign step IDs
      const steps: PlanStep[] = template.map((t, i) => ({
        stepId: `step-${i + 1}-${t.agentName}`,
        agentName: t.agentName,
        dependsOn: t.dependsOn,
        required: t.required,
        reason: t.reason,
      }));

      // Compute parallel groups (agents with no unresolved dependencies run together)
      const parallelGroups: string[][] = [];
      const resolved = new Set<string>();
      let remaining = [...steps];

      while (remaining.length > 0) {
        const runnable = remaining.filter(s =>
          s.dependsOn.every(dep => resolved.has(dep))
        );
        if (runnable.length === 0) break; // cycle guard
        parallelGroups.push(runnable.map(s => s.agentName));
        runnable.forEach(s => resolved.add(s.agentName));
        remaining = remaining.filter(s => !resolved.has(s.agentName));
      }

      const output: PlanOutput = {
        steps,
        estimatedAgents: steps.map(s => s.agentName),
        parallelGroups,
      };

      return completeMessage(msg, output, 1.0, ["intent_classifier", "rbac_policy"], startMs);
    } catch (err: any) {
      return failMessage(msg, err.message, startMs) as any;
    }
  }
}
