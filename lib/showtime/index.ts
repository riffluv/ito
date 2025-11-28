import { showtime } from "./ShowtimeManager";
import { roundRevealScenario } from "./scenarios/roundReveal";
import { roundStartScenario } from "./scenarios/roundStart";
import type { Scenario, ShowtimeContext } from "./types";

/**
 * SHOWTIME (Phase 0)
 *
 * シナリオ登録は現状この 2 種類のみ。RoomPage のステータス監視と
 * Firestore `room.status` の変化だけを手掛かりに `showtime.play("round:start")` /
 * `"round:reveal"` が呼ばれる構成で、intent ベースの publish とはまだ連動していない。
 */

// ShowtimeManager は型パラメータを受け付けないため、共通の ShowtimeContext に揃えて登録
showtime.register("round:start", roundStartScenario as Scenario<ShowtimeContext>);
showtime.register("round:reveal", roundRevealScenario as Scenario<ShowtimeContext>);

export { showtime };
export type { Scenario, ScenarioStep, ShowtimeContext } from "./types";
