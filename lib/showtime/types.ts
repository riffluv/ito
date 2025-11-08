/**
 * SHOWTIME intent & scenario 型。
 * FSM intent ベースの publish / subscribe ルートと、
 * 既存のシナリオ実装（round:start / round:reveal）を緩く結び付ける。
 */

export type ShowtimeContext = Record<string, unknown>;

export type ShowtimeEventType = "round:start" | "round:reveal";

export type ShowtimeEventDoc = {
  type: ShowtimeEventType;
  round?: number | null;
  status?: string | null;
  success?: boolean | null;
  revealedMs?: number | null;
  intentId?: string | null;
  source?: "intent" | "fallback";
  createdAt?: any;
};

export type ShowtimeIntentMetadata = {
  action?: string;
  source?: string;
  note?: string;
};

export type ShowtimeIntentHandlers = {
  markStartIntent?: (meta?: ShowtimeIntentMetadata) => void;
  markRevealIntent?: (meta?: ShowtimeIntentMetadata) => void;
  clearIntent?: (kind: "start" | "reveal") => void;
};

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
