import { test, expect } from '@playwright/test';
import { HostManager, type HostPlayerInput, selectHostCandidate } from '../lib/host/HostManager';

const ONLINE_NOW = 1_700_000_000_000;

function buildPlayers(): HostPlayerInput[] {
  return [
    { id: 'host-1', joinedAt: ONLINE_NOW - 1000, orderIndex: 0, lastSeenAt: ONLINE_NOW - 200, isOnline: true, name: 'ホスト' },
    { id: 'guest-1', joinedAt: ONLINE_NOW - 500, orderIndex: 1, lastSeenAt: ONLINE_NOW - 100, isOnline: true, name: 'ゲスト1' },
    { id: 'guest-2', joinedAt: ONLINE_NOW - 300, orderIndex: 2, lastSeenAt: ONLINE_NOW - 50, isOnline: true, name: 'ゲスト2' },
  ];
}

test.describe('ホスト移譲ガード', () => {
  test('非ホストが退出してもホストは維持される', () => {
    const manager = new HostManager({
      roomId: 'room-1',
      currentHostId: 'host-1',
      leavingUid: 'guest-1',
      players: buildPlayers(),
    });
    const decision = manager.evaluateAfterLeave();
    expect(decision.action).toBe('none');
    expect(decision.hostId).toBe('host-1');
  });

  test('ホストが退出した場合は最優先候補に移譲される', () => {
    const manager = new HostManager({
      roomId: 'room-1',
      currentHostId: 'host-1',
      leavingUid: 'host-1',
      players: buildPlayers(),
    });
    const decision = manager.evaluateAfterLeave();
    expect(decision.action).toBe('assign');
    expect(decision.hostId).toBe('guest-1');
    expect(decision.reason).toBe('host-left');
  });

  test('候補が残っていなければホストをクリアする', () => {
    const manager = new HostManager({
      roomId: 'room-1',
      currentHostId: 'host-1',
      leavingUid: 'host-1',
      players: [{ id: 'host-1', joinedAt: ONLINE_NOW - 1000, lastSeenAt: ONLINE_NOW - 100, orderIndex: 0, isOnline: true }],
    });
    const decision = manager.evaluateAfterLeave();
    expect(decision.action).toBe('clear');
    expect(decision.reason).toBe('no-players');
  });

  test('既存ホストが存在する場合はclaimでも移譲しない', () => {
    const manager = new HostManager({
      roomId: 'room-claim',
      currentHostId: 'host-1',
      players: buildPlayers(),
    });
    const decision = manager.evaluateClaim('guest-2');
    expect(decision.action).toBe('none');
    expect(decision.hostId).toBe('host-1');
  });

  test('selectHostCandidateはオンラインかつ最古参加者を返す', () => {
    const inputs: HostPlayerInput[] = [
      { id: 'host-1', joinedAt: ONLINE_NOW - 2000, orderIndex: 0, lastSeenAt: ONLINE_NOW - 500, isOnline: false },
      { id: 'guest-1', joinedAt: ONLINE_NOW - 1800, orderIndex: 1, lastSeenAt: ONLINE_NOW - 200, isOnline: true },
      { id: 'guest-2', joinedAt: ONLINE_NOW - 1500, orderIndex: 2, lastSeenAt: ONLINE_NOW - 100, isOnline: true },
    ];
    const candidate = selectHostCandidate(inputs, { leavingUid: 'host-1' });
    expect(candidate).toBe('guest-1');
  });
});
