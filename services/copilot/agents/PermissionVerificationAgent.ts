/**
 * PermissionVerificationAgent
 *
 * Single responsibility: Verify which actions the authenticated operator
 * is permitted to execute, based on their role.
 * Never calls the LLM. Never accesses the database. Pure role-based logic.
 */

import type {
  IAgent, AgentMessage,
  PermissionVerificationInput, PermissionVerificationOutput, CopilotActionType,
} from "./types.js";
import { completeMessage, markRunning, failMessage } from "./types.js";

// ─── Role → allowed actions map ───────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, CopilotActionType[]> = {
  VIEWER: [
    "NAVIGATE_TO_VIEW",
    "SEARCH_PERSONS",
  ],
  OPERATOR: [
    "NAVIGATE_TO_VIEW",
    "SEARCH_PERSONS",
    "ACKNOWLEDGE_ALARM",
    "SNAPSHOT_CAMERA",
    "CREATE_INCIDENT",
    "GENERATE_REPORT",
    "EXPORT_EVIDENCE",
  ],
  SUPERVISOR: [
    "NAVIGATE_TO_VIEW",
    "SEARCH_PERSONS",
    "ACKNOWLEDGE_ALARM",
    "ESCALATE_ALARM",
    "RESOLVE_ALARM",
    "ASSIGN_ALARM",
    "SNAPSHOT_CAMERA",
    "START_RECORDING",
    "STOP_RECORDING",
    "CREATE_INCIDENT",
    "GENERATE_REPORT",
    "EXPORT_EVIDENCE",
    "DISPATCH_RESOURCE",
  ],
  ADMIN: [
    "NAVIGATE_TO_VIEW",
    "SEARCH_PERSONS",
    "ACKNOWLEDGE_ALARM",
    "ESCALATE_ALARM",
    "RESOLVE_ALARM",
    "ASSIGN_ALARM",
    "SNAPSHOT_CAMERA",
    "START_RECORDING",
    "STOP_RECORDING",
    "CREATE_INCIDENT",
    "GENERATE_REPORT",
    "EXPORT_EVIDENCE",
    "DISPATCH_RESOURCE",
    "LOCK_AREA",
    "PTZ_MOVE",
  ],
};

// ─── Agent Implementation ──────────────────────────────────────────────────────

export class PermissionVerificationAgent
  implements IAgent<PermissionVerificationInput, PermissionVerificationOutput>
{
  readonly name = "PermissionVerificationAgent";
  readonly description =
    "Verifies which CopilotActionTypes the operator's role authorises; never calls the LLM.";

  async execute(
    message: AgentMessage<PermissionVerificationInput>
  ): Promise<AgentMessage<PermissionVerificationInput, PermissionVerificationOutput>> {
    const startMs = Date.now();
    const msg = markRunning(message);

    try {
      const { operatorContext, requestedActions } = msg.input;
      const role = (operatorContext.userRole ?? "VIEWER").toUpperCase();
      const allowed = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["VIEWER"];

      const allowedActions = requestedActions.filter(a => allowed.includes(a));
      const deniedActions  = requestedActions.filter(a => !allowed.includes(a));

      // Determine access level
      let accessLevel: PermissionVerificationOutput["accessLevel"];
      if (role === "ADMIN" || role === "SUPERVISOR") {
        accessLevel = "full";
      } else if (role === "OPERATOR") {
        accessLevel = deniedActions.length > 0 ? "partial" : "full";
      } else {
        accessLevel = "read_only";
      }

      const output: PermissionVerificationOutput = {
        allowedActions,
        deniedActions,
        accessLevel,
      };

      return completeMessage(msg, output, 1.0, ["rbac_policy"], startMs);
    } catch (err: any) {
      return failMessage(msg, err.message, startMs) as any;
    }
  }
}
