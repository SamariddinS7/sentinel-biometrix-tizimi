/**
 * Multi-Agent System — Shared Types
 *
 * All agents communicate exclusively through AgentMessage<T>.
 * No agent may read or write state outside its own scope.
 */

import { GoogleGenAI } from "@google/genai";

// ─── Agent Message Protocol ────────────────────────────────────────────────────
// Every inter-agent message MUST carry all of these fields.

export type AgentStatus = "pending" | "running" | "success" | "failed" | "skipped";
export type AgentPriority = "low" | "medium" | "high" | "critical";

export interface AgentMessage<TInput = unknown, TOutput = unknown> {
  /** Unique ID for the top-level user request. Shared across all agents in one pipeline run. */
  taskId: string;
  /** Unique ID for this specific agent invocation. */
  requestId: string;
  /** ISO 8601 timestamp of when this message was created. */
  timestamp: string;
  /** Name of the agent that owns this message. */
  agentName: string;
  /** Execution priority hint. */
  priority: AgentPriority;
  /** Typed input payload. */
  input: TInput;
  /** Typed output payload — populated after successful execution. */
  output?: TOutput;
  /** Confidence score [0–1] in the output. */
  confidence: number;
  /** Identifiers of data sources / prior messages used as evidence. */
  evidenceRefs: string[];
  /** Execution status. */
  status: AgentStatus;
  /** Human-readable error description when status === "failed". */
  errorMessage?: string;
  /** Wall-clock execution time in milliseconds. */
  durationMs?: number;
}

// ─── Base Agent Interface ──────────────────────────────────────────────────────

export interface IAgent<TInput = unknown, TOutput = unknown> {
  /** Unique agent name used in messages and logs. */
  readonly name: string;
  /** One-sentence description of the agent's single responsibility. */
  readonly description: string;
  /** Execute the agent and return a completed AgentMessage. */
  execute(message: AgentMessage<TInput>): Promise<AgentMessage<TInput, TOutput>>;
}

// ─── Domain Types ──────────────────────────────────────────────────────────────

export type CopilotIntent =
  | "VISUAL_ANALYSIS"
  | "ALARM_MANAGEMENT"
  | "INVESTIGATION"
  | "SYSTEM_HEALTH"
  | "PERSON_SEARCH"
  | "REPORT_GENERATION"
  | "NAVIGATION"
  | "ACTION_REQUEST"
  | "GENERAL_INTELLIGENCE";

export type ActionRisk = "none" | "low" | "medium" | "high" | "critical";

export type CopilotActionType =
  | "ACKNOWLEDGE_ALARM"
  | "ESCALATE_ALARM"
  | "RESOLVE_ALARM"
  | "ASSIGN_ALARM"
  | "PTZ_MOVE"
  | "SNAPSHOT_CAMERA"
  | "START_RECORDING"
  | "STOP_RECORDING"
  | "LOCK_AREA"
  | "DISPATCH_RESOURCE"
  | "CREATE_INCIDENT"
  | "EXPORT_EVIDENCE"
  | "NAVIGATE_TO_VIEW"
  | "SEARCH_PERSONS"
  | "GENERATE_REPORT";

export type ReasoningStep =
  | "Observe"
  | "Understand"
  | "Reason"
  | "Plan"
  | "Verify"
  | "Execute"
  | "Explain"
  | "Learn";

export interface ReasoningTrace {
  step: ReasoningStep;
  summary: string;
  sources?: string[];
  durationMs?: number;
}

export interface ProposedAction {
  id: string;
  label: string;
  description: string;
  type: CopilotActionType;
  params: Record<string, unknown>;
  risk: ActionRisk;
  requiresConfirmation: boolean;
  permissionsRequired: string[];
}

// ─── Pipeline Context ──────────────────────────────────────────────────────────
// Passed through the entire pipeline. Read-only for all agents.

export interface OperatorContext {
  userRole: string;
  userName: string;
  currentView?: string;
  activeCameraId?: string;
  activeAlarmId?: string;
  timestamp: string;
}

// ─── Pipeline Input/Output shapes per agent ────────────────────────────────────

export interface IntentDetectionInput {
  query: string;
  conversationHistory: Array<{ role: "user" | "copilot"; text: string }>;
}
export interface IntentDetectionOutput {
  intent: CopilotIntent;
  confidence: number;
  keywords: string[];
}

export interface PermissionVerificationInput {
  operatorContext: OperatorContext;
  intent: CopilotIntent;
  requestedActions: CopilotActionType[];
}
export interface PermissionVerificationOutput {
  allowedActions: CopilotActionType[];
  deniedActions: CopilotActionType[];
  accessLevel: "full" | "partial" | "read_only";
}

export interface PlanInput {
  intent: CopilotIntent;
  permissionOutput: PermissionVerificationOutput;
  hasImage: boolean;
  query: string;
}
export interface PlanOutput {
  steps: PlanStep[];
  estimatedAgents: string[];
  parallelGroups: string[][];
}
export interface PlanStep {
  stepId: string;
  agentName: string;
  dependsOn: string[];
  required: boolean;
  reason: string;
}

export interface TaskDecompositionInput {
  query: string;
  intent: CopilotIntent;
  plan: PlanOutput;
}
export interface TaskDecompositionOutput {
  subTasks: SubTask[];
  isComplex: boolean;
}
export interface SubTask {
  id: string;
  description: string;
  assignedAgent: string;
  priority: AgentPriority;
  inputs: Record<string, unknown>;
}

export interface AgentSelectionInput {
  plan: PlanOutput;
  decomposition: TaskDecompositionOutput;
  availableAgents: string[];
}
export interface AgentSelectionOutput {
  selectedAgents: string[];
  executionOrder: Array<{ agents: string[]; parallel: boolean }>;
}

export interface SystemContextInput {
  operatorContext: OperatorContext;
}
export interface SystemContextOutput {
  activeAlarms: unknown[];
  alarmCount: number;
  systemHealth: Record<string, unknown>;
  cameraStatuses: unknown[];
  timestamp: string;
}

export interface PerceptionInput {
  query: string;
  imageData?: string;
  imageMimeType?: string;
}
export interface PerceptionOutput {
  observation: string;
  detections: string[];
  confidence: number;
  hasImage: boolean;
}

export interface EvidenceInput {
  intent: CopilotIntent;
  systemContext: SystemContextOutput;
  perceptionResult: PerceptionOutput;
  subTasks: SubTask[];
}
export interface EvidenceOutput {
  evidenceBundle: EvidenceItem[];
  sourcesUsed: string[];
}
export interface EvidenceItem {
  id: string;
  source: string;
  content: string;
  relevance: number;
}

export interface ReasoningInput {
  query: string;
  intent: CopilotIntent;
  operatorContext: OperatorContext;
  systemContext: SystemContextOutput;
  perceptionResult: PerceptionOutput;
  evidenceBundle: EvidenceItem[];
  permissionOutput: PermissionVerificationOutput;
  conversationHistory: Array<{ role: "user" | "copilot"; text: string }>;
  genai: GoogleGenAI | null;
}
export interface ReasoningOutput {
  answer: string;
  reasoning: ReasoningTrace[];
  proposedActions: ProposedAction[];
  confidence: number;
  uncertainty?: string;
  sourcesUsed: string[];
}

export interface ValidationInput {
  reasoningOutput: ReasoningOutput;
  operatorContext: OperatorContext;
  permissionOutput: PermissionVerificationOutput;
}
export interface ValidationOutput {
  passed: boolean;
  issues: string[];
  sanitizedOutput: ReasoningOutput;
}

export interface ResponseGenerationInput {
  validationOutput: ValidationOutput;
  agentsInvoked: string[];
  processingStartMs: number;
  allMessages: AgentMessage[];
}
export interface ResponseGenerationOutput {
  answer: string;
  reasoning: ReasoningTrace[];
  sourcesUsed: string[];
  proposedActions: ProposedAction[];
  confidence: number;
  uncertainty?: string;
  agentsInvoked: string[];
  processingMs: number;
}

export interface ActionExecutionInput {
  actionType: CopilotActionType;
  params: Record<string, unknown>;
  operatorContext: OperatorContext;
}
export interface ActionExecutionOutput {
  success: boolean;
  message: string;
  data?: unknown;
}

// ─── Helper: create a fresh AgentMessage ──────────────────────────────────────

export function createMessage<TInput>(
  taskId: string,
  agentName: string,
  input: TInput,
  priority: AgentPriority = "medium"
): AgentMessage<TInput> {
  return {
    taskId,
    requestId: `${agentName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    agentName,
    priority,
    input,
    confidence: 0,
    evidenceRefs: [],
    status: "pending",
  };
}

// ─── Helper: mark a message as running ───────────────────────────────────────

export function markRunning<T>(msg: AgentMessage<T>): AgentMessage<T> {
  return { ...msg, status: "running" };
}

// ─── Helper: complete a message with output ───────────────────────────────────

export function completeMessage<TIn, TOut>(
  msg: AgentMessage<TIn>,
  output: TOut,
  confidence: number,
  evidenceRefs: string[],
  startMs: number
): AgentMessage<TIn, TOut> {
  return {
    ...(msg as AgentMessage<TIn, TOut>),
    output,
    confidence,
    evidenceRefs,
    status: "success",
    durationMs: Date.now() - startMs,
  };
}

// ─── Helper: fail a message ───────────────────────────────────────────────────

export function failMessage<TIn>(
  msg: AgentMessage<TIn>,
  errorMessage: string,
  startMs: number
): AgentMessage<TIn> {
  return {
    ...msg,
    status: "failed",
    confidence: 0,
    errorMessage,
    durationMs: Date.now() - startMs,
  };
}
