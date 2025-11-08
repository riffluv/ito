import { showtime } from "./ShowtimeManager";
import { roundRevealScenario } from "./scenarios/roundReveal";
import { roundStartScenario } from "./scenarios/roundStart";

/**
 * SHOWTIME (Phase 0)
 *
 * シナリオ登録は現状この 2 種類のみ。RoomPage のステータス監視と
 * Firestore `room.status` の変化だけを手掛かりに `showtime.play("round:start")` /
 * `"round:reveal"` が呼ばれる構成で、intent ベースの publish とはまだ連動していない。
 */

showtime.register("round:start", roundStartScenario);
showtime.register("round:reveal", roundRevealScenario);

export { showtime };
export type { Scenario, ScenarioStep, ShowtimeContext } from "./types";
