// Simple simulation for ito game logic (node)

function defaultOrderState() {
  return { list: [], lastNumber: null, failed: false, failedAt: null };
}

function applyPlay({ order, playerId, myNum, allowContinue }) {
  const alreadyFailed = !!order.failed;
  if (order.list.includes(playerId)) {
    return { next: order, violation: false };
  }
  const next = { ...order, list: [...order.list, playerId], lastNumber: myNum };
  const violation =
    !alreadyFailed && order.lastNumber !== null && myNum < order.lastNumber;
  if (violation) {
    next.failed = true;
    next.failedAt = next.list.length;
  }
  return { next, violation };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateDeterministicNumbers(count, min, max, seed) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const rnd = mulberry32(hashString(seed));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function simulate(playersCount) {
  const players = Array.from({ length: playersCount }, (_, i) => `p${i + 1}`);
  const seed = "test-seed";
  const nums = generateDeterministicNumbers(playersCount, 1, 100, seed);
  const mapping = players.map((id, idx) => ({ id, num: nums[idx] }));
  console.log("\nplayers and numbers:", mapping);

  let order = defaultOrderState();
  let allowContinue = false;

  const asc = [...mapping].sort((a, b) => a.num - b.num).map((x) => x.id);
  const rand = [...mapping].map((x) => x.id).sort(() => Math.random() - 0.5);

  function runSequence(seq, label) {
    console.log("\nSequence:", label, seq.join(", "));
    order = defaultOrderState();
    for (let pid of seq) {
      const player = mapping.find((m) => m.id === pid);
      const { next, violation } = applyPlay({
        order,
        playerId: pid,
        myNum: player.num,
        allowContinue,
      });
      order = next;
      console.log(
        "Played",
        pid,
        "num",
        player.num,
        "violation",
        violation,
        "order list",
        order.list
      );
      if (order.failed) break;
    }
    console.log("Final order:", order);
  }

  runSequence(asc, "ascending (correct)");
  runSequence(rand, "random");
}

[3, 4, 5, 6].forEach(simulate);

// targeted scenario: 5 players, plays: p1 (1st), p2 (2nd), p3 (3rd causes failure), then check p4/p5
function targetedScenario() {
  const players = ["p1", "p2", "p3", "p4", "p5"];
  const numbers = { p1: 1, p2: 5, p3: 3, p4: 10, p5: 20 };
  console.log(
    "\nTargeted scenario (allowContinue=false): p1->p2->p3 fails at 3, should stop"
  );
  let order = defaultOrderState();
  let allowContinue = false;
  for (const pid of players) {
    const { next, violation } = applyPlay({
      order,
      playerId: pid,
      myNum: numbers[pid],
      allowContinue,
    });
    order = next;
    console.log(
      "Played",
      pid,
      "num",
      numbers[pid],
      "violation",
      violation,
      "order list",
      order.list
    );
    if (order.failed) break;
  }
  console.log("Final order:", order);

  console.log(
    "\nTargeted scenario (allowContinue=true): p1->p2->p3 fails at 3, but continue to p4/p5"
  );
  order = defaultOrderState();
  allowContinue = true;
  for (const pid of players) {
    const { next, violation } = applyPlay({
      order,
      playerId: pid,
      myNum: numbers[pid],
      allowContinue,
    });
    order = next;
    console.log(
      "Played",
      pid,
      "num",
      numbers[pid],
      "violation",
      violation,
      "order list",
      order.list
    );
    if (order.failed && !allowContinue) break;
  }
  console.log("Final order:", order);
}

targetedScenario();
