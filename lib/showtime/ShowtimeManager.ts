import { ACTION_EXECUTORS } from "./actions";
import type { Scenario, ScenarioStep, ShowtimeContext } from "./types";

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
      this.currentPromise = this.runScenario(scenario, next.context);
      await this.currentPromise;
      next.resolve();
    }
    this.currentPromise = null;
    this.playing = false;
  }

  private async runScenario(scenario: Scenario<C>, context: C) {
    for (const step of scenario) {
      await this.executeStep(step, context);
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
    const promise = executor(rawParams ?? {}, context);
    if (!step.fireAndForget) {
      await promise;
    }
  }
}

export const showtime = new ShowtimeManager();
