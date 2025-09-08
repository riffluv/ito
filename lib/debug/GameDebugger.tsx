"use client";
import { Box, Button, Flex, Text, VStack, HStack, Badge, useDisclosure } from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import type { RoomDoc, PlayerDoc } from "@/lib/types";

interface DebugSnapshot {
  timestamp: number;
  roomStatus: string;
  playersCount: number;
  orderList: string[];
  proposal?: string[];
  failed?: boolean;
  resolveMode?: string;
  action?: string;
}

interface GameDebuggerProps {
  room: (RoomDoc & { id?: string }) | null;
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  lastAction?: string;
}

export function GameDebugger({ room, players, onlineCount, lastAction }: GameDebuggerProps) {
  const { open: isOpen, onToggle } = useDisclosure();
  const [snapshots, setSnapshots] = useState<DebugSnapshot[]>([]);
  const [isRecording, setIsRecording] = useState(true);
  const lastSnapshotRef = useRef<string>("");

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Capture snapshots when room state changes
  useEffect(() => {
    if (!isRecording || !room) return;

    const snapshot: DebugSnapshot = {
      timestamp: Date.now(),
      roomStatus: room.status,
      playersCount: players.length,
      orderList: room.order?.list || [],
      proposal: room.order?.proposal || undefined,
      failed: room.order?.failed || false,
      resolveMode: room.options?.resolveMode || 'sequential',
      action: lastAction,
    };

    const snapshotKey = `${snapshot.roomStatus}-${snapshot.orderList.join(',')}-${snapshot.proposal?.join(',') || ''}-${snapshot.failed}`;
    
    // Only add if state actually changed
    if (snapshotKey !== lastSnapshotRef.current) {
      setSnapshots(prev => [...prev.slice(-19), snapshot]); // Keep last 20 snapshots
      lastSnapshotRef.current = snapshotKey;
    }
  }, [room?.status, room?.order, players.length, lastAction, isRecording]);

  const clearSnapshots = () => {
    setSnapshots([]);
    lastSnapshotRef.current = "";
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  // Export debug info
  const exportDebugInfo = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      currentState: {
        room,
        players,
        onlineCount,
      },
      snapshots,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    };

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box
      position="fixed"
      bottom="1rem"
      right="1rem"
      bg="rgba(0, 0, 0, 0.9)"
      color="white"
      borderRadius="md"
      p={2}
      fontSize="xs"
      fontFamily="monospace"
      maxWidth="400px"
      zIndex="max"
      border="1px solid rgba(255, 255, 255, 0.2)"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Badge colorScheme="blue" variant="solid" size="sm">
          DEBUG
        </Badge>
        <HStack gap={1}>
          <Button size="xs" onClick={toggleRecording} colorScheme={isRecording ? "red" : "green"}>
            {isRecording ? "⏸️" : "▶️"}
          </Button>
          <Button size="xs" onClick={onToggle}>
            {isOpen ? "➖" : "➕"}
          </Button>
        </HStack>
      </Flex>

      {/* Current State (Always Visible) */}
      <VStack align="stretch" gap={1}>
        <HStack justify="space-between">
          <Text fontWeight="bold">Status:</Text>
          <Badge colorScheme={getStatusColor(room?.status)}>{room?.status || 'N/A'}</Badge>
        </HStack>
        <HStack justify="space-between">
          <Text>Players:</Text>
          <Text>{players.length} ({onlineCount || 'N/A'} online)</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Mode:</Text>
          <Text>{room?.options?.resolveMode || 'sequential'}</Text>
        </HStack>
        {room?.order?.list && room.order.list.length > 0 && (
          <HStack justify="space-between">
            <Text>Order:</Text>
            <Text>{room.order.list.length} cards</Text>
          </HStack>
        )}
        {room?.order?.failed && (
          <HStack justify="space-between">
            <Text color="red.300">Failed at:</Text>
            <Text color="red.300">{room.order.failedAt}</Text>
          </HStack>
        )}
        {lastAction && (
          <HStack justify="space-between">
            <Text color="yellow.300">Last Action:</Text>
            <Text color="yellow.300" fontSize="10px">{lastAction}</Text>
          </HStack>
        )}
      </VStack>

      {/* Expanded Debug Panel */}
      {isOpen && (
        <VStack align="stretch" gap={2} mt={3} pt={3} borderTop="1px solid rgba(255, 255, 255, 0.2)">
          
          {/* Controls */}
          <HStack justify="space-between">
            <Button size="xs" onClick={clearSnapshots} colorScheme="orange">
              Clear History
            </Button>
            <Button size="xs" onClick={exportDebugInfo} colorScheme="purple">
              Export Debug
            </Button>
          </HStack>

          {/* Room Details */}
          <Box>
            <Text fontWeight="bold" mb={1}>Room Details:</Text>
            <VStack align="stretch" fontSize="10px" gap={1}>
              <Text>ID: {room?.id || 'N/A'}</Text>
              <Text>Host: {room?.hostId || 'N/A'}</Text>
              <Text>Topic: {room?.topic || 'None'}</Text>
              {room?.order && (
                <Text>
                  Order: [{room.order.list?.join(', ') || ''}]
                  {room.order.proposal && ` | Proposal: [${room.order.proposal.join(', ')}]`}
                </Text>
              )}
              {room?.result && (
                <Text color={room.result.success ? "green.300" : "red.300"}>
                  Result: {room.result.success ? 'Success' : 'Failed'}
                </Text>
              )}
            </VStack>
          </Box>

          {/* Players List */}
          <Box>
            <Text fontWeight="bold" mb={1}>Players ({players.length}):</Text>
            <VStack align="stretch" fontSize="10px" gap={1}>
              {players.map((player, idx) => (
                <HStack key={player.id} justify="space-between">
                  <Text>{player.name}</Text>
                  <Text>{player.number !== null ? `#${player.number}` : 'No number'}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>

          {/* State History */}
          <Box>
            <Text fontWeight="bold" mb={1}>History ({snapshots.length}/20):</Text>
            <VStack align="stretch" fontSize="10px" gap={1} maxHeight="150px" overflowY="auto">
              {snapshots.slice(-10).reverse().map((snapshot, idx) => (
                <HStack key={snapshot.timestamp} justify="space-between" 
                       bg={idx === 0 ? "rgba(255, 255, 0, 0.1)" : "transparent"}
                       p={1} borderRadius="2px">
                  <Text>{new Date(snapshot.timestamp).toLocaleTimeString()}</Text>
                  <HStack gap={1}>
                    <Badge size="xs" colorScheme={getStatusColor(snapshot.roomStatus)}>
                      {snapshot.roomStatus}
                    </Badge>
                    <Text>{snapshot.orderList.length}c</Text>
                    {snapshot.failed && <Text color="red.300">❌</Text>}
                    {snapshot.action && <Text color="yellow.300" fontSize="8px">{snapshot.action}</Text>}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          </Box>

        </VStack>
      )}
    </Box>
  );
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'waiting': return 'gray';
    case 'clue': return 'blue';
    case 'reveal': return 'purple';
    case 'finished': return 'green';
    default: return 'gray';
  }
}

// Debug helper to inject global debug information
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__GAME_DEBUG = {
    getSnapshot: () => {
      const roomElement = document.querySelector('[data-room-id]');
      const roomId = roomElement?.getAttribute('data-room-id');
      return {
        roomId,
        timestamp: new Date().toISOString(),
        location: window.location.href,
        // Add more debug info as needed
      };
    },
    exportLogs: () => {
      const logs = {
        console: (console as any)._logs || [],
        errors: (window as any)._errors || [],
        timestamp: new Date().toISOString(),
      };
      console.log('Debug logs:', logs);
      return logs;
    },
  };
}