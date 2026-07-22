/**
 * Enterprise AI Copilot — Task Orchestration Engine
 * Volume 4 · Section 31
 *
 * Coordinates all agents: Task Queue, Priority Queue, Parallel Scheduling,
 * Dependency Graph, Failure Recovery, Retry Logic, Cancellation, Timeout Management.
 * Agents may execute: Sequential, Parallel, Conditional, Loop, Event-Driven.
 * No duplicated work. No conflicting actions. No deadlocks.
 */

import type { ExecutionPlan } from "./PlanningEngine.js";

export type OrchestratorTaskStatus =
  | "QUEUED" | "READY" | "RUNNING" | "COMPLETED" | "FAILED"
  | "CANCELLED" | "TIMED_OUT" | "RETRYING";

export interface OrchestratorTask {
  taskId: string;
  planId: string;
  action: string;
  params: Record<string, unknown>;
  priority: number;
  dependsOn: string[];
  maxRetries: number;
  timeoutMs: number;
  status: OrchestratorTaskStatus;
  result?: unknown;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  retryCount: number;
  cancelRequested: boolean;
}

export interface OrchestrationResult {
  planId: string;
  completedTasks: string[];
  failedTasks: string[];
  skippedTasks: string[];
  taskResults: Record<string, unknown>;
  totalMs: number;
  success: boolean;
  retryCount: number;
}

export type TaskExecutor = (
  action: string,
  params: Record<string, unknown>
) => Promise<unknown>;

// ─────────────────────────────────────────────────────────────────────────────

class TaskOrchestrationEngine {
  private static instance: TaskOrchestrationEngine;
  private queue = new Map<string, OrchestratorTask>();
  private runningPlans = new Set<string>();
  private executionLocks = new Set<string>(); // prevent duplicate runs

  static getInstance(): TaskOrchestrationEngine {
    if (!TaskOrchestrationEngine.instance)
      TaskOrchestrationEngine.instance = new TaskOrchestrationEngine();
    return TaskOrchestrationEngine.instance;
  }

  // ── Queue management ────────────────────────────────────────────────────────

  private enqueue(plan: ExecutionPlan): void {
    for (const step of plan.steps) {
      // Prevent duplicates
      if (this.queue.has(step.taskId)) continue;
      this.queue.set(step.taskId, {
        taskId: step.taskId,
        planId: plan.planId,
        action: step.action,
        params: step.params,
        priority: step.priority,
        dependsOn: step.dependsOn,
        maxRetries: step.maxRetries,
        timeoutMs: step.timeoutMs,
        status: "QUEUED",
        retryCount: 0,
        cancelRequested: false,
      });
    }
  }

  cancelTask(taskId: string): void {
    const t = this.queue.get(taskId);
    if (t) t.cancelRequested = true;
  }

  cancelPlan(planId: string): void {
    for (const t of this.queue.values())
      if (t.planId === planId) t.cancelRequested = true;
  }

  getTask(taskId: string): OrchestratorTask | undefined {
    return this.queue.get(taskId);
  }

  getQueueSnapshot(): OrchestratorTask[] {
    return Array.from(this.queue.values());
  }

  isPlanRunning(planId: string): boolean {
    return this.runningPlans.has(planId);
  }

  // ── Core execution ──────────────────────────────────────────────────────────

  async executePlan(
    plan: ExecutionPlan,
    executor: TaskExecutor
  ): Promise<OrchestrationResult> {
    // Prevent concurrent duplicate plan execution
    if (this.executionLocks.has(plan.planId)) {
      return {
        planId: plan.planId, completedTasks: [], failedTasks: [],
        skippedTasks: plan.steps.map(s => s.taskId), taskResults: {},
        totalMs: 0, success: false, retryCount: 0,
      };
    }
    this.executionLocks.add(plan.planId);
    this.runningPlans.add(plan.planId);
    this.enqueue(plan);

    const startMs = Date.now();
    const completed = new Set<string>();
    const failed = new Set<string>();
    const skipped = new Set<string>();
    const taskResults: Record<string, unknown> = {};
    let totalRetries = 0;

    const allIds = plan.steps.map(s => s.taskId);
    const maxIter = allIds.length * 5; // deadlock guard
    let iter = 0;

    while (completed.size + failed.size + skipped.size < allIds.length) {
      if (++iter > maxIter) {
        // Force-skip remaining — deadlock protection
        for (const id of allIds) {
          if (!completed.has(id) && !failed.has(id) && !skipped.has(id)) {
            skipped.add(id);
            const t = this.queue.get(id);
            if (t) { t.status = "CANCELLED"; t.error = "Deadlock guard triggered"; }
          }
        }
        break;
      }

      // Mark tasks that can never run (dependency failed/skipped)
      for (const id of allIds) {
        if (completed.has(id) || failed.has(id) || skipped.has(id)) continue;
        const t = this.queue.get(id)!;
        if (t.dependsOn.some(dep => failed.has(dep) || skipped.has(dep))) {
          skipped.add(id);
          t.status = "CANCELLED";
          t.error = "Upstream task failed";
        }
      }

      // Find ready tasks: all deps completed, not yet started
      const ready = allIds.filter(id => {
        if (completed.has(id) || failed.has(id) || skipped.has(id)) return false;
        const t = this.queue.get(id)!;
        if (t.status === "RUNNING") return false;
        if (t.cancelRequested) { skipped.add(id); t.status = "CANCELLED"; return false; }
        return t.dependsOn.every(dep => completed.has(dep));
      });

      if (ready.length === 0) {
        // Check if still something running
        const running = allIds.filter(id => this.queue.get(id)?.status === "RUNNING");
        if (running.length > 0) {
          await new Promise(r => setTimeout(r, 30));
          continue;
        }
        // Nothing running and nothing ready → stuck
        break;
      }

      // Separate parallel from sequential
      const parallelBatch = ready.filter(id => {
        const step = plan.steps.find(s => s.taskId === id);
        return step?.parallel ?? false;
      });
      const sequentialReady = ready.filter(id => !parallelBatch.includes(id));

      // Execute parallel batch
      if (parallelBatch.length > 0) {
        const results = await Promise.allSettled(
          parallelBatch.map(id => this.runOne(id, executor))
        );
        for (let i = 0; i < parallelBatch.length; i++) {
          const id = parallelBatch[i];
          const r = results[i];
          if (r.status === "fulfilled" && r.value.ok) {
            completed.add(id);
            taskResults[id] = r.value.result;
          } else {
            const t = this.queue.get(id)!;
            const err = r.status === "rejected" ? r.reason?.message : r.value.error;
            if (t.retryCount < t.maxRetries) {
              t.retryCount++; t.status = "RETRYING"; totalRetries++;
            } else {
              failed.add(id); t.status = "FAILED"; t.error = err;
            }
          }
        }
      }

      // Execute first sequential task only (to preserve ordering)
      if (sequentialReady.length > 0) {
        const id = sequentialReady[0];
        const r = await this.runOne(id, executor);
        if (r.ok) {
          completed.add(id);
          taskResults[id] = r.result;
        } else {
          const t = this.queue.get(id)!;
          if (t.retryCount < t.maxRetries) {
            t.retryCount++; t.status = "RETRYING"; totalRetries++;
          } else {
            failed.add(id); t.status = "FAILED"; t.error = r.error;
          }
        }
      }
    }

    this.runningPlans.delete(plan.planId);
    this.executionLocks.delete(plan.planId);

    return {
      planId: plan.planId,
      completedTasks: Array.from(completed),
      failedTasks: Array.from(failed),
      skippedTasks: Array.from(skipped),
      taskResults,
      totalMs: Date.now() - startMs,
      success: failed.size === 0 && skipped.size === 0,
      retryCount: totalRetries,
    };
  }

  private async runOne(
    taskId: string,
    executor: TaskExecutor
  ): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    const t = this.queue.get(taskId);
    if (!t) return { ok: false, error: "Task not found" };
    if (t.cancelRequested) { t.status = "CANCELLED"; return { ok: false, error: "Cancelled" }; }

    t.status = "RUNNING";
    t.startedAt = Date.now();

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${t.timeoutMs}ms`)), t.timeoutMs)
      );
      const result = await Promise.race([executor(t.action, t.params), timeout]);
      t.result = result;
      t.status = "COMPLETED";
      t.finishedAt = Date.now();
      return { ok: true, result };
    } catch (err: any) {
      t.finishedAt = Date.now();
      const msg = err?.message ?? String(err);
      t.error = msg;
      t.status = msg.startsWith("Timeout") ? "TIMED_OUT" : "FAILED";
      return { ok: false, error: msg };
    }
  }

  // ── Statistics ──────────────────────────────────────────────────────────────

  getStats(): {
    queued: number; running: number; completed: number;
    failed: number; activePlans: number; totalTasks: number;
  } {
    let queued = 0, running = 0, completed = 0, failed = 0;
    for (const t of this.queue.values()) {
      if (t.status === "QUEUED" || t.status === "RETRYING") queued++;
      else if (t.status === "RUNNING") running++;
      else if (t.status === "COMPLETED") completed++;
      else if (t.status === "FAILED" || t.status === "TIMED_OUT") failed++;
    }
    return { queued, running, completed, failed, activePlans: this.runningPlans.size, totalTasks: this.queue.size };
  }
}

export const taskOrchestrationEngine = TaskOrchestrationEngine.getInstance();
