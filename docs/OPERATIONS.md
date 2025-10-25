# 驕狗畑繧ｬ繧､繝・(OPERATIONS)

繧ｲ繝ｼ繝縲悟ｺ上・邏狗ｫ III・医が繝ｳ繝ｩ繧､繝ｳ迚茨ｼ峨阪ｒ邯咏ｶ夐°逕ｨ縺吶ｋ髫帙・繝上Φ繝峨ヶ繝・け縺ｧ縺吶６I 螻､縺九ｉ Firebase 縺ｾ縺ｧ縺ｮ雋ｬ蜍吶ｒ譏守､ｺ縺励∵律蟶ｸ驕狗畑繝ｻ繝医Λ繝悶Ν蟇ｾ蠢懊・繝医Ξ繝ｼ繧ｹ縺ｮ隕区婿繧剃ｽ募ｺｦ縺ｧ繧ょ盾辣ｧ縺ｧ縺阪ｋ蠖｢縺ｧ縺ｾ縺ｨ繧√※縺・∪縺吶・
---

## 1. 繝ｬ繧､繝､繝ｼ讒矩縺ｨ雋ｬ蜍・
```
UI (components/ui, app/rooms/...)        竊・陦ｨ遉ｺ縺ｨ蜈･蜉帙・縺ｿ縲ゅΟ繧ｸ繝・け縺ｯ Hook/Service 縺ｫ蟋碑ｭｲ縲・      竊・Hooks (lib/hooks, components/hooks)       竊・迥ｶ諷矩寔邏・・繧､繝吶Φ繝亥宛蠕｡縲ゅ荊raceAction縲阪〒荳ｻ隕∵桃菴懊ｒ險倬鹸縲・      竊・Service (lib/game/service.ts 縺ｻ縺・        竊・Firestore/RTDB 譖ｸ縺崎ｾｼ縺ｿ蜿｣繧堤ｵｱ荳縲６I 縺九ｉ逶ｴ謗･隗ｦ繧峨↑縺・・      竊・Firebase (lib/firebase/..., Cloud Functions) 竊・豌ｸ邯壼ｱ､縲りｪ崎ｨｼ繝ｻ讓ｩ髯舌・繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝牙・逅・・```

- **UI**: 繝ｬ繧､繧｢繧ｦ繝医→繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧呈球蠖薙・ameCard 縺ｪ縺ｩ縺ｯ props 縺縺代〒謖ｯ繧玖・縺・ｒ豎ｺ螳壹・- **Hooks**: 逕ｻ髱｢蝗ｺ譛峨・迥ｶ諷九ｒ髮・ｴ・(`useRoomState`, `useHostActions`, `useCardSubmission`, etc)縲ゅ％縺薙〒 trace 繧堤匱轣ｫ縺輔○縲∝､ｱ謨玲凾縺ｯ `traceError` 縺ｧ隧ｳ邏ｰ繧呈ｮ九☆縲・- **Service**: `lib/game/service.ts` 縺ｫ蠢・★邨檎罰縲・irestore / RTDB 縺ｸ逶ｴ謗･譖ｸ縺崎ｾｼ縺ｿ縺溘＞蝣ｴ蜷医ｂ縲√％縺薙∈蜃ｦ逅・ｒ霑ｽ蜉縺吶ｋ縲・- **Firebase**: 繝ｫ繝ｼ繝ｫ繝ｻFunctions繝ｻRTDB Presence縲１resence 縺ｯ RTDB 縺悟髪荳縺ｮ繧ｽ繝ｼ繧ｹ縲・
---

## 2. 繝医Ξ繝ｼ繧ｹ縺ｨ繝｡繝医Μ繧ｯ繧ｹ縺ｮ隕区婿

- 荳ｻ隕∵桃菴懊↓ `traceAction("蜷榊燕", detail)` 繧剃ｻ戊ｾｼ繧薙〒縺・∪縺吶ゆｾ・
  - `host.start`, `numbers.deal`, `order.submit`, `room.reset`, `reveal.finalize`
  - UI 逕ｱ譚･: `ui.card.submit`, `ui.host.quickStart`, `ui.host.nextGame`, `ui.host.transfer`
- 螟ｱ謨玲凾縺ｯ `traceError("蜷榊燕", err, detail)` 繧貞ｿ・★菴ｵ襍ｰ縲４entry Metrics 縺梧怏蜉ｹ縺ｪ繧・`trace.error.*` 縺ｨ縺励※髮・ｨ医＆繧後・幕逋ｺ荳ｭ縺ｯ console 縺ｫ `[trace:error]` 縺悟・蜉帙＆繧後∪縺吶・- 繝ｭ繝ｼ繧ｫ繝ｫ/讀懆ｨｼ迺ｰ蠅・〒謖吝虚繧定ｦ九ｋ髫帙・ **繝悶Λ繧ｦ繧ｶ DevTools 縺ｮ Console** 繧帝幕縺阪～[trace:action] ...` / `[trace:error] ...` 繧堤｢ｺ隱阪・- 繝｡繝医Μ繧ｯ繧ｹ繧ｵ繝槭Μ縺ｯ `window.__ITO_METRICS__` 縺ｧ蜿門ｾ怜庄:
  - `ui.dragonQuestPartyRenderMs`, `ui.dragonQuestPartyRenderCount`
  - `participants.presenceReady`, `firestoreQueue.*`
  - Safe Update 邉ｻ (`safeUpdate.*`) 繧ょ酔讒倥↓逶｣隕悶〒縺阪ｋ縲・
---

## 3. 繧医￥縺ゅｋ繝医Λ繝悶Ν縺ｨ蟇ｾ蜃ｦ

| 逞・憾 | 遒ｺ隱阪・繧､繝ｳ繝・| 蟇ｾ蜃ｦ |
| ---- | ------------ | ---- |
| 繧ｫ繝ｼ繝峨′蜃ｺ縺帙↑縺・/ 縲梧署蜃ｺ縲阪・繧ｿ繝ｳ縺檎┌蜉ｹ | `traceAction("ui.card.submit")` 縺悟・縺ｦ縺・ｋ縺九～computeAllSubmitted` 縺ｮ譚｡莉ｶ縺梧純縺｣縺ｦ縺・ｋ縺・| Presence Ready 縺・false 縺ｮ蝣ｴ蜷医・繧ｪ繝ｳ繝ｩ繧､繝ｳ莠ｺ謨ｰ縺瑚ｨ育ｮ励↓荵励ｉ縺ｪ縺・Ａwindow.__ITO_METRICS__.participants` 繧堤｢ｺ隱阪＠縲√け繝ｩ繧､繧｢繝ｳ繝医′ presence 繧貞ｼｵ繧後※縺・ｋ縺九メ繧ｧ繝・け |
| 荳ｦ縺ｳ遒ｺ螳壹′謚ｼ縺帙↑縺・| `tests/submit-offline-continue.spec.ts` 縺ｮ繝ｭ繧ｸ繝・け縺ｩ縺翫ｊ縲∝ｴ縺ｫ蜃ｺ縺ｦ縺・ｋ莠ｺ謨ｰ縺ｨ `effectiveActive` 縺御ｸ閾ｴ縺励※縺・ｋ縺・| 髮｢閼ｱ閠・′ proposal 縺ｫ谿九▲縺ｦ縺・↑縺・°遒ｺ隱阪ゅ・繧ｹ繝医・縲御ｸｭ譁ｭ縲阪〒繝ｪ繧ｻ繝・ヨ縺ｾ縺溘・ `/trace` 繧貞盾辣ｧ |
| 繝帙せ繝亥ｧ碑ｭｲ縺梧綾縺｣縺ｦ縺励∪縺・| `[trace:error] ui.host.transfer` 縺ｮ detail 繧堤｢ｺ隱・| RTDB presence 縺悟商縺・庄閭ｽ諤ｧ縲ょｯｾ雎｡繝励Ξ繧､繝､繝ｼ縺ｫ蜀阪Ο繧ｰ繧､繝ｳ縺励※繧ゅｉ縺・∝・蠎ｦ蟋碑ｭｲ |
| 蛻晏屓繧ｫ繝ｼ繝峨〒蝗櫁ｻ｢縺励↑縺・| `GameCard` 縺ｮ `lastRotationRef` 縺梧悴譖ｴ譁ｰ縺ｮ蝣ｴ蜷医・ 3D 辟｡蜉ｹ蛹悶′蜒阪＞縺ｦ縺・↑縺・°遒ｺ隱・| 繧ｿ繝悶ｒ蜀崎ｪｭ縺ｿ霎ｼ縺ｿ縲・SAP 縺ｮ from-to 縺悟ｮ溯｡後＆繧後※縺・ｋ縺・console 縺ｧ遒ｺ隱・|

---

## 4. FSM 繝輔Λ繧ｰ縺ｮ蛻・ｊ譖ｿ縺域焔鬆・
譁ｰ縺励＞迥ｶ諷区ｩ滓｢ｰ (`lib/state/roomMachine.ts`) 縺ｯ feature flag 縺ｧ邂｡逅・＠縺ｦ縺・∪縺吶・
1. `.env.local` 縺ｫ `NEXT_PUBLIC_FSM_ENABLE=1` 繧定ｨｭ螳夲ｼ・ 縺ｮ縺ｾ縺ｾ縺ｪ繧牙ｾ捺擂繝ｭ繧ｸ繝・け・峨・2. `npm run dev` 縺ｾ縺溘・ `npm run build && npm run start` 繧貞・襍ｷ蜍輔・3. 荳ｻ縺ｪ蜍慕ｷ夲ｼ亥ｾ・ｩ・竊・騾｣諠ｳ 竊・謠仙・ 竊・蜈ｬ髢・竊・邨ゆｺ・ｼ峨・謖吝虚縺悟､峨ｏ繧峨↑縺・％縺ｨ繧堤｢ｺ隱阪・4. 繝医Λ繝悶Ν譎ゅ・ flag 繧・0 縺ｫ謌ｻ縺励～lib/hooks/useRoomState.ts` 縺ｮ `fsmEnabled` 蛻・ｲ舌ｒ霎ｿ縺｣縺ｦ蟾ｮ蛻・ｒ隱ｿ譟ｻ縲・
窶ｻ 迥ｶ諷矩・遘ｻ繝・せ繝医・ `tests/roomMachine.spec.ts` 縺ｧ邯ｲ鄒・ｸ医∩縲・lag ON/OFF 蜿梧婿縺ｧ謇句虚遒ｺ隱阪＠縺ｦ縺九ｉ譛ｬ逡ｪ縺ｸ縲・
---

## 5. 繧ｳ繝槭Φ繝峨→繝√ぉ繝・け繝ｪ繧ｹ繝・
- 髢狗匱繧ｵ繝ｼ繝舌・: `npm run dev`
- 蝙九メ繧ｧ繝・け: `npm run typecheck`
- 繝ｦ繝九ャ繝茨ｼ襲laywright・井ｸ驛ｨ・・ `npm run test` / `npx playwright test`
- 譛ｬ逡ｪ繝薙Ν繝・ `npm run build && npm run start`
- 荳ｻ隕√ユ繧ｹ繝・
  - `tests/roomMachine.spec.ts`
  - `tests/submit-offline-continue.spec.ts`
  - `tests/clue-input-shortcuts.spec.ts`
  - 譌｢蟄・`__tests__/presence.spec.ts`

**繝・・繝ｭ繧､蜑阪メ繧ｧ繝・け**
1. `npm run typecheck` 竊・OK
2. `npm run test` 竊・OK
3. `npx playwright test` 竊・譁ｰ隕上ユ繧ｹ繝亥性繧√※ OK
4. `NEXT_PUBLIC_FSM_ENABLE=0` 縺ｮ迥ｶ諷九〒謇句虚繝励Ξ繧､ 竊・OK
5. Flag 繧・1 縺ｫ縺励※蜷後§豬√ｌ繧堤｢ｺ隱搾ｼ医Μ繝ｪ繝ｼ繧ｹ蜑阪・讀懆ｨｼ迺ｰ蠅・〒螳滓命謗ｨ螂ｨ・・
---

## 6. 蜿り・Μ繝ｳ繧ｯ

- `Safe Update` telemetries: `lib/telemetry/safeUpdate.ts`
- Presence 繝ｭ繧ｸ繝・け蜀崎ｨｭ險医Γ繝｢: `AGENTS.md`
- Game 繝ｭ繧ｸ繝・け讎りｦ・ `docs/GAME_LOGIC_OVERVIEW.md`

蝗ｰ縺｣縺溘ｉ AGENTS.md 繧・Safe Update 繝｡繝｢縺ｸ霑ｽ險倥＠縲∵ｬ｡縺ｮ諡・ｽ楢・↓縺､縺ｪ縺偵※縺上□縺輔＞縲・## 7. Recall V2 監視ポイント

- Cloud Functions `rejoin.ts` が `rooms/{roomId}/rejoinRequests/{uid}` を監視し、自動受理を行う。状態が `pending` のまま 15 秒以上続く場合は Functions ログでエラー内容を確認。
- メトリクスは `recall.requested / recall.accepted / recall.rejected / recall.timeout` を `window.__ITO_METRICS__` で確認できる。観戦 UI では申請中にスピナーを表示し、タイムアウト時は再試行の文言を案内する。
- Trace は `spectator.requestSeat` / `spectator.recallAccepted` / `spectator.recallRejected` / `spectator.recallTimeout` を参照。
