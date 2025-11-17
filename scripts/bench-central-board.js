#!/usr/bin/env node
const { performance } = require("perf_hooks");

function easeOutBack(t, overshoot = 1.70158) {
  const t1 = t - 1;
  return t1 * t1 * ((overshoot + 1) * t1 + overshoot) + 1;
}

function defaultEase(t) {
  return easeOutBack(t, 1.7);
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutWithExponent(t, exponent) {
  return 1 - Math.pow(1 - t, exponent);
}

function computeMagnetTransform(overRect, activeRect, config = {}) {
  const isTouch = config.isTouch ?? false;
  const radius = Math.max(config.snapRadius ?? 120, 1);
  const ease = config.ease ?? defaultEase;
  const threshold = config.snapThreshold ?? (isTouch ? 30 : 24);

  if (!overRect || !activeRect) {
    return {
      dx: 0,
      dy: 0,
      strength: 0,
      distance: Number.POSITIVE_INFINITY,
      shouldSnap: false,
    };
  }

  const overCenterX = overRect.left + overRect.width / 2;
  const overCenterY = overRect.top + overRect.height / 2;
  const activeCenterX = activeRect.left + activeRect.width / 2;
  const activeCenterY = activeRect.top + activeRect.height / 2;
  const projectedOffsetX = config.projectedOffset?.dx ?? 0;
  const projectedOffsetY = config.projectedOffset?.dy ?? 0;
  const visualCenterX = activeCenterX + projectedOffsetX;
  const visualCenterY = activeCenterY + projectedOffsetY;

  const diffX = overCenterX - activeCenterX;
  const diffY = overCenterY - activeCenterY;
  const distance = Math.hypot(diffX, diffY);

  if (!Number.isFinite(distance) || distance >= radius) {
    return {
      dx: 0,
      dy: 0,
      strength: 0,
      distance,
      shouldSnap: false,
    };
  }

  const normalized = clamp01(1 - distance / radius);
  const strength = ease(normalized);
  const clampedStrength = clamp01(strength);
  const safeDistance = Math.max(distance, 1);

  const overRight = overRect.left + overRect.width;
  const overBottom = overRect.top + overRect.height;
  const visualInsideSlotBounds =
    visualCenterX >= overRect.left &&
    visualCenterX <= overRight &&
    visualCenterY >= overRect.top &&
    visualCenterY <= overBottom;
  const visualDiffX = overCenterX - visualCenterX;
  const visualDiffY = overCenterY - visualCenterY;
  const visualDistance = Math.hypot(visualDiffX, visualDiffY);
  const visualSnapThreshold = threshold * 0.82;

  const pullExponent = config.pullExponent ?? (isTouch ? 2.2 : 1.8);
  const basePullRatio = easeOutWithExponent(normalized, pullExponent);
  const settleProgress = clamp01(config.settleProgress ?? (isTouch ? 0.88 : 0.8));
  let pullRatio = normalized >= settleProgress ? 1 : clamp01(basePullRatio);
  if (visualInsideSlotBounds || visualDistance <= visualSnapThreshold) {
    pullRatio = 1;
  }

  const overshootStart = clamp01(config.overshootStart ?? (isTouch ? 0.94 : 0.9));
  const overshootRatio = config.overshootRatio ?? (isTouch ? 0.06 : 0.1);
  const overshootRange = Math.max(1 - overshootStart, 0.0001);
  let overshootProgress = 0;
  if (normalized > overshootStart) {
    overshootProgress = (normalized - overshootStart) / overshootRange;
  }
  let overshootMultiplier = clamp01(overshootProgress) * Math.max(overshootRatio, 0);
  if (visualInsideSlotBounds || visualDistance <= visualSnapThreshold) {
    overshootMultiplier = 0;
  }
  const slotSpan = Math.max(overRect?.height ?? 0, overRect?.width ?? 0);
  const maxOvershootPx = Math.max(
    0,
    config.maxOvershootPx ?? (slotSpan > 0 ? Math.min(slotSpan * 0.18, 14) : 10)
  );

  const desiredOffset = Math.min(
    distance * (pullRatio + overshootMultiplier),
    distance + maxOvershootPx
  );

  const maxOffset = config.maxOffset;
  const clampedOffset =
    typeof maxOffset === "number" && Number.isFinite(maxOffset)
      ? Math.min(desiredOffset, Math.max(maxOffset, 0))
      : desiredOffset;
  const offsetFactor = clampedOffset / safeDistance;

  const shouldSnap =
    visualInsideSlotBounds || visualDistance <= threshold || distance <= threshold;

  return {
    dx: diffX * offsetFactor,
    dy: diffY * offsetFactor,
    strength: clampedStrength,
    distance,
    shouldSnap,
  };
}

function buildBoardSlots(params) {
  const {
    slotCountDragging,
    slotCountStatic,
    activeProposal,
    pending,
    playerReadyMap,
    optimisticReturningIds,
    isGameActive,
    roomStatus,
    orderList,
    canDropAtPosition,
    eligibleIds,
    eligibleIdSet,
    playerMap,
    activeId,
  } = params;

  const optimisticSet = new Set(optimisticReturningIds);

  const dragSlots = Array.from({ length: Math.max(0, slotCountDragging) }).map((_, idx) => {
    const proposalCardId = activeProposal[idx] ?? null;
    const pendingRaw = pending[idx] ?? null;
    const pendingCardId = typeof pendingRaw === "string" && pendingRaw.length > 0 ? pendingRaw : null;
    const cardId = proposalCardId ?? pendingCardId ?? null;
    const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
    const isOptimistic = cardId !== null && cardId !== undefined && optimisticSet.has(cardId);
    const showCard = !!cardId && ready && !isOptimistic;
    return {
      idx,
      totalSlots: slotCountDragging,
      droppableId: `slot-${idx}`,
      cardId,
      showCard,
      ready,
      isOptimisticReturning: isOptimistic,
      proposalCardId,
      pendingCardId,
    };
  });

  const staticSlots = Array.from({ length: Math.max(0, slotCountStatic) }).map((_, idx) => {
    const proposalCardId = activeProposal[idx] ?? null;
    const orderCardId = orderList?.[idx] ?? null;
    const pendingRaw = pending[idx] ?? null;
    const pendingCardId = typeof pendingRaw === "string" && pendingRaw.length > 0 ? pendingRaw : null;
    const cardId = proposalCardId ?? orderCardId ?? pendingCardId ?? null;
    const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
    const isOptimistic = cardId !== null && cardId !== undefined && optimisticSet.has(cardId);
    const forceVisible = roomStatus === "reveal" || roomStatus === "finished";
    const showCard = !!cardId && !isOptimistic && isGameActive && (ready || forceVisible);
    return {
      idx,
      totalSlots: slotCountStatic,
      droppableId: `slot-${idx}`,
      cardId,
      showCard,
      ready,
      isOptimisticReturning: isOptimistic,
      allowDrop: canDropAtPosition(idx),
    };
  });

  const pendingLookup = (() => {
    const filtered = pending.filter((id) => typeof id === "string" && id.length > 0);
    return filtered.length === 0 ? null : new Set(filtered);
  })();

  const placedLookup = (() => {
    const result = new Set();
    activeProposal.forEach((id) => {
      if (typeof id === "string" && id.length > 0 && eligibleIdSet.has(id)) {
        result.add(id);
      }
    });
    return result.size === 0 ? null : result;
  })();

  const waitingPlayers = (() => {
    if (!Array.isArray(eligibleIds) || eligibleIds.length === 0) {
      return [];
    }
    const result = [];
    for (const id of eligibleIds) {
      const player = playerMap.get(id);
      if (!player) continue;
      if (pendingLookup && pendingLookup.has(player.id)) {
        continue;
      }
      if (optimisticSet.has(player.id)) {
        result.push(player);
        continue;
      }
      if (placedLookup && placedLookup.has(player.id)) {
        continue;
      }
      if (player.id === activeId) {
        continue;
      }
      result.push(player);
    }
    return result;
  })();

  return { dragSlots, staticSlots, waitingPlayers };
}

function createSlots(count, startX = 0, startY = 0, gap = 20) {
  const slots = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    slots.push({
      left: startX + col * (120 + gap),
      top: startY + row * (160 + gap),
      width: 120,
      height: 160,
    });
  }
  return slots;
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function collisionScore(droppableRects, pointer) {
  const { x, y } = pointer;
  let best = null;
  for (const [id, rect] of droppableRects.entries()) {
    const dropCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const dx = x - dropCenter.x;
    const dy = y - dropCenter.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const axisAllowanceX = Math.max(rect.width * 0.45, 36);
    const axisAllowanceY = Math.max(rect.height * 0.4, 42);
    if (absDx > axisAllowanceX || absDy > axisAllowanceY) {
      continue;
    }
    const radialAllowance = Math.max(Math.min(rect.width, rect.height) * 0.55, 52);
    const distance = Math.hypot(dx, dy);
    if (distance > radialAllowance) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { id, distance };
    }
  }
  return best;
}

function percentile(sortedArray, p) {
  if (sortedArray.length === 0) return 0;
  const idx = Math.min(sortedArray.length - 1, Math.floor(p * (sortedArray.length - 1)));
  return sortedArray[idx];
}

function summarize(label, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((sum, v) => sum + v, 0) / (samples.length || 1);
  return {
    label,
    samples: samples.length,
    avg,
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function formatStats(stats) {
  const round = (value) => value.toFixed(3).padStart(7, " ");
  return `${stats.label.padEnd(32)} avg ${round(stats.avg)} ms | p50 ${round(stats.p50)} | p75 ${round(stats.p75)} | p95 ${round(stats.p95)} | max ${round(stats.max)}`;
}

function main() {
  const slotRects = createSlots(12, 100, 80, 32);
  const droppableRects = new Map();
  slotRects.forEach((rect, idx) => {
    droppableRects.set(`slot-${idx}`, rect);
  });

  const activeRect = { left: 60, top: 320, width: 120, height: 160 };
  const magnetSamples = [];
  const collisionSamples = [];
  const boardSamples = [];

  const players = new Map();
  const playerReadyMap = new Map();
  const eligibleIds = [];
  const orderList = [];
  const activeProposal = [];
  const pending = [];
  for (let i = 0; i < 12; i += 1) {
    const id = `player-${i}`;
    players.set(id, { id, name: `Player ${i}` });
    const ready = Math.random() > 0.35;
    playerReadyMap.set(id, ready);
    eligibleIds.push(id);
    orderList[i] = Math.random() > 0.5 ? id : null;
    activeProposal[i] = Math.random() > 0.6 ? id : null;
    pending[i] = Math.random() > 0.7 ? id : null;
  }

  const eligibleIdSet = new Set(eligibleIds);
  const optimisticReturningIds = eligibleIds.filter(() => Math.random() > 0.85);

  const baseBoardParams = {
    slotCountDragging: 12,
    slotCountStatic: 12,
    activeProposal,
    pending,
    playerReadyMap,
    optimisticReturningIds,
    isGameActive: true,
    roomStatus: "clue",
    orderList,
    canDropAtPosition: () => true,
    eligibleIds,
    eligibleIdSet,
    playerMap: players,
    activeId: eligibleIds[0],
  };

  const ITERATIONS = 5000;

  for (let i = 0; i < ITERATIONS; i += 1) {
    const pointer = {
      x: 100 + Math.random() * 480,
      y: 80 + Math.random() * 360,
    };
    const now = performance.now();
    computeMagnetTransform(pickRandom(slotRects), activeRect, {
      snapRadius: 140,
      isTouch: i % 3 === 0,
      projectedOffset: { dx: Math.sin(i) * 4, dy: Math.cos(i) * 6 },
    });
    magnetSamples.push(performance.now() - now);

    const collisionStart = performance.now();
    collisionScore(droppableRects, pointer);
    collisionSamples.push(performance.now() - collisionStart);

    const boardStart = performance.now();
    const mutated = { ...baseBoardParams };
    if (i % 7 === 0) {
      mutated.roomStatus = "reveal";
    } else if (i % 11 === 0) {
      mutated.roomStatus = "finished";
    } else {
      mutated.roomStatus = "clue";
    }
    mutated.pending = mutated.pending.map((value, idx) => {
      if (Math.random() > 0.92) return `player-${(idx + i) % 12}`;
      return value;
    });
    buildBoardSlots(mutated);
    boardSamples.push(performance.now() - boardStart);
  }

  const results = [
    summarize("computeMagnetTransform", magnetSamples),
    summarize("collisionScore", collisionSamples),
    summarize("buildBoardSlots", boardSamples),
  ];

  console.log("CentralCardBoard micro-benchmark (" + ITERATIONS + " iterations)");
  results.forEach((stats) => {
    console.log(formatStats(stats));
  });
}

if (require.main === module) {
  main();
}
