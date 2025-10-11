import { showtime } from "./ShowtimeManager";
import { roundRevealScenario } from "./scenarios/roundReveal";
import { roundStartScenario } from "./scenarios/roundStart";

showtime.register("round:start", roundStartScenario);
showtime.register("round:reveal", roundRevealScenario);

export { showtime };
export type { Scenario, ScenarioStep, ShowtimeContext } from "./types";

