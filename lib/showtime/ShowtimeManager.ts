import { ACTION_EXECUTORS } from "./actions";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import type { Scenario, ScenarioStep, ShowtimeContext } from "./types";

/**
 * SHOWTIME (Phase 0)
 *
 * Manager 自体は完全にクライアントサイドのキュー制御のみを担い、FSM intent や
 * Firestore のイベント系列とは無関係。RoomPage の `room.status` / `room.round`
 * ウォッチャーから直接 `showtime.play()` が呼ばれ、ここでは順番保証とメトリクス計測だけを行う。
 * リファクタ前の責務を明確にするために残している。
 */

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    if (!ms || ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

type QueueEntry<C extends ShowtimeContext> = {
  name: string;
  context: C;
  resolve: () => void;
};

export class ShowtimeManager<C extends ShowtimeContext = ShowtimeContext> {
  private scenarios = new Map<string, Scenario<C>>();
  private playing = false;
  private queue: Array<QueueEntry<C>> = [];
  private currentPromise: Promise<void> | null = null;

  register(name: string, scenario: Scenario<C>) {
    this.scenarios.set(name, scenario);
  }

  has(name: string) {
    return this.scenarios.has(name);
  }

  async play(name: string, context: C = {} as C) {
    if (!this.scenarios.has(name)) {
      return Promise.resolve();
    }
    bumpMetric("showtime", "playQueued");
    return new Promise<void>((resolve) => {
      this.queue.push({ name, context, resolve });
      if (!this.playing) {
        void this.drainQueue();
      }
    });
  }

  clear() {
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      entry?.resolve();
    }
  }

  private async drainQueue() {
    this.playing = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        break;
      }
      const scenario = this.scenarios.get(next.name);
      if (!scenario) {
        next.resolve();
        continue;
      }
      this.currentPromise = this.runScenario(next.name, scenario, next.context);
      await this.currentPromise;
      bumpMetric("showtime", "playCompleted");
      next.resolve();
    }
    this.currentPromise = null;
    this.playing = false;
  }

  private async runScenario(name: string, scenario: Scenario<C>, context: C) {
    const start = typeof performance !== "undefined" ? performance.now() : null;
    let executedSteps = 0;
    for (const step of scenario) {
      await this.executeStep(step, context);
      executedSteps += 1;
    }
    if (executedSteps > 0) {
      bumpMetric("showtime", "stepsExecuted", executedSteps);
    }
    setMetric("showtime", "lastScenario", name);
    if (start !== null && typeof performance !== "undefined") {
      const duration = performance.now() - start;
      setMetric("showtime", "lastDurationMs", Math.round(duration));
    }
  }

  private async executeStep(step: ScenarioStep<C>, context: C) {
    if (typeof step.when === "function" && !step.when(context)) {
      return;
    }
    if (typeof step.delayMs === "number" && step.delayMs > 0) {
      await sleep(step.delayMs);
    }
    const executor = ACTION_EXECUTORS[step.action];
    if (!executor) {
      return;
    }
    const rawParams = typeof step.params === "function" ? step.params(context) : step.params;
    setMetric("showtime", "lastAction", step.action);
    bumpMetric("showtime", "actionsExecuted");
    const promise = executor(rawParams ?? {}, context);
    if (!step.fireAndForget) {
      await promise;
    }
  }
}

export const showtime = new ShowtimeManager();
