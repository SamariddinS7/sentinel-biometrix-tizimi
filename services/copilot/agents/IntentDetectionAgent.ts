/**
 * IntentDetectionAgent
 *
 * Single responsibility: Classify the user's query into exactly one CopilotIntent.
 * Uses regex heuristics + keyword scoring. No LLM call — must be fast and deterministic.
 */

import type {
  IAgent, AgentMessage,
  IntentDetectionInput, IntentDetectionOutput, CopilotIntent,
} from "./types.js";
import { completeMessage, markRunning } from "./types.js";

// ─── Keyword maps ─────────────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ intent: CopilotIntent; patterns: RegExp[]; weight: number }> = [
  {
    intent: "VISUAL_ANALYSIS",
    weight: 10,
    patterns: [/kamera|camera|ko['']r|ko'rsat|analiz|snapshot|rasm|tasvir|image|video|visual|look at|suratga ol/i],
  },
  {
    intent: "ALARM_MANAGEMENT",
    weight: 10,
    patterns: [/alarm|ogohlantirish|signal|xavf|tahdid|incident|tasdiql|resolve|escalat|hodisa|alert/i],
  },
  {
    intent: "INVESTIGATION",
    weight: 9,
    patterns: [/tekshir|investigat|search|qidir|shaxs|person|kim|who|kuzat|track|aniqlash|identify/i],
  },
  {
    intent: "SYSTEM_HEALTH",
    weight: 9,
    patterns: [/tizim|system|health|sog'liq|cpu|ram|disk|server|metric|status|online|offline|ishlayapti/i],
  },
  {
    intent: "PERSON_SEARCH",
    weight: 10,
    patterns: [/shaxs qidir|person search|kim bu|find person|yuz|face|biometrik|biometric|identity/i],
  },
  {
    intent: "REPORT_GENERATION",
    weight: 8,
    patterns: [/hisobot|report|export|summary|statistik|analytics|jadval|chiqar/i],
  },
  {
    intent: "NAVIGATION",
    weight: 7,
    patterns: [/o['']tish|navigate|ko['']rsat|show|open|ochish|dashboard|panel|bo['']lim|sahifa/i],
  },
  {
    intent: "ACTION_REQUEST",
    weight: 9,
    patterns: [/bajar|execute|yoq|lock|dispatch|record|yuborish|send|bloklash|yopish|ochish/i],
  },
];

// ─── Agent Implementation ──────────────────────────────────────────────────────

export class IntentDetectionAgent
  implements IAgent<IntentDetectionInput, IntentDetectionOutput>
{
  readonly name = "IntentDetectionAgent";
  readonly description =
    "Classifies the operator query into exactly one CopilotIntent using pattern matching.";

  async execute(
    message: AgentMessage<IntentDetectionInput>
  ): Promise<AgentMessage<IntentDetectionInput, IntentDetectionOutput>> {
    const startMs = Date.now();
    const msg = markRunning(message);
    const { query, conversationHistory } = msg.input;

    try {
      const scores: Map<CopilotIntent, number> = new Map();
      const matchedKeywords: string[] = [];

      // Score each intent pattern against the query
      for (const { intent, patterns, weight } of INTENT_PATTERNS) {
        for (const pattern of patterns) {
          const m = query.match(pattern);
          if (m) {
            scores.set(intent, (scores.get(intent) ?? 0) + weight);
            matchedKeywords.push(...(m as string[]).filter(Boolean));
          }
        }
      }

      // Small boost from recent conversation context
      const lastUserMsg = [...conversationHistory].reverse().find(h => h.role === "user")?.text ?? "";
      if (lastUserMsg) {
        for (const { intent, patterns } of INTENT_PATTERNS) {
          for (const pattern of patterns) {
            if (pattern.test(lastUserMsg)) {
              scores.set(intent, (scores.get(intent) ?? 0) + 1);
            }
          }
        }
      }

      // Pick winner
      let bestIntent: CopilotIntent = "GENERAL_INTELLIGENCE";
      let bestScore = 0;
      for (const [intent, score] of scores) {
        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent;
        }
      }

      // Confidence: normalise best score against theoretical max (10)
      const confidence = Math.min(bestScore / 10, 1);

      const output: IntentDetectionOutput = {
        intent: bestIntent,
        confidence,
        keywords: [...new Set(matchedKeywords)].slice(0, 10),
      };

      return completeMessage(msg, output, confidence, ["operator_input"], startMs);
    } catch (err: any) {
      const { failMessage } = await import("./types.js");
      return failMessage(msg, err.message, startMs) as any;
    }
  }
}
