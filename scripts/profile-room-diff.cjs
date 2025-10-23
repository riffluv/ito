const { performance } = require("perf_hooks");
const deepEqual = require("fast-deep-equal/es6");

const buildRoomDoc = (extraPlayers = 32) => {
  const base = {
    name: "協力ルーム",
    hostId: "host-uid",
    hostName: "ホスト",
    creatorId: "host-uid",
    creatorName: "ホスト",
    requiresPassword: true,
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordVersion: 2,
    options: {
      allowContinueAfterFail: true,
      resolveMode: "sort-submit",
      displayMode: "full",
      defaultTopicType: "通常版",
    },
    status: "clue",
    createdAt: { seconds: 0, nanoseconds: 0, toMillis: () => 0 },
    lastActiveAt: { seconds: 0, nanoseconds: 0, toMillis: () => 0 },
    closedAt: null,
    expiresAt: null,
    topic: "テスト",
    topicOptions: ["通常版", "レインボー版"],
    topicBox: "通常版",
    order: {
      list: Array.from({ length: extraPlayers }, (_, i) => 'player-' + i),
      decidedAt: { seconds: 0, nanoseconds: 0, toMillis: () => 0 },
      lastNumber: 42,
      failed: false,
      total: extraPlayers,
      proposal: null,
      numbers: Object.fromEntries(
        Array.from({ length: extraPlayers }, (_, i) => ['player-' + i, i + 1])
      ),
      snapshots: Object.fromEntries(
        Array.from({ length: extraPlayers }, (_, i) => [
          'player-' + i,
          {
            name: 'Player ' + i,
            avatar: 'avatar-' + i,
            clue1: 'clue-' + i,
            number: i + 1,
          },
        ])
      ),
    },
    result: {
      success: false,
      revealedAt: { seconds: 0, nanoseconds: 0, toMillis: () => 0 },
    },
    deal: {
      seed: "seed",
      min: 1,
      max: 100,
      players: Array.from({ length: extraPlayers }, (_, i) => 'player-' + i),
    },
    round: 3,
    mvpVotes: Object.fromEntries(
      Array.from({ length: extraPlayers }, (_, i) => ['player-' + i, 'vote-' + i])
    ),
    updatePhase: "done",
    requiredSwVersion: "1.0.0",
  };
  return base;
};

const ITERATIONS = 5_000;

const sample = buildRoomDoc(64);
const identical = buildRoomDoc(64);
const changed = buildRoomDoc(64);
changed.status = "finished";

const benchmark = (label, run) => {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i += 1) {
    run();
  }
  const duration = performance.now() - start;
  return { label, duration };
};

const stringifyResults = [
  benchmark("JSON.stringify", () => JSON.stringify(sample)),
  benchmark("JSON.stringify mutate", () => JSON.stringify(changed)),
];

const deepEqualResults = [
  benchmark("deepEqual (identical)", () => deepEqual(sample, identical)),
  benchmark("deepEqual (changed)", () => deepEqual(sample, changed)),
];

const format = ({ label, duration }) =>
  label.padEnd(24) + ': ' + duration.toFixed(2) + ' ms total (' + ((duration / ITERATIONS) * 1000).toFixed(2) + ' µs/op)';

console.log('Room snapshot diff profiling (iterations:', ITERATIONS, ')\n');
for (const row of stringifyResults) {
  console.log(format(row));
}
console.log('');
for (const row of deepEqualResults) {
  console.log(format(row));
}
