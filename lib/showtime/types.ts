export type ShowtimeContext = Record<string, unknown>;

export interface ScenarioStep<
  C extends ShowtimeContext = ShowtimeContext,
  P extends Record<string, unknown> = Record<string, unknown>
> {
  action: string;
  params?: P | ((context: C) => P | void) | void;
  /**
   * Optional delay (ms) before executing the step.
   */
  delayMs?: number;
  /**
   * Skip this step when the predicate returns false.
   */
  when?: (context: C) => boolean;
  /**
   * Do not await the resulting promise (fire and forget).
   */
  fireAndForget?: boolean;
}

export type Scenario<C extends ShowtimeContext = ShowtimeContext> = ScenarioStep<C>[];

export type ActionExecutor<C extends ShowtimeContext = ShowtimeContext, P = any> =
  (params: P, context: C) => void | Promise<void>;

