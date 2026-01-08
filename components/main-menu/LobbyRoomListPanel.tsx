"use client";

import type { LobbyRoom } from "@/components/main-menu/types";
import { RoomCard } from "@/components/RoomCard";
import { AppButton } from "@/components/ui/AppButton";
import { Pagination } from "@/components/ui/Pagination";
import { SearchBar } from "@/components/ui/SearchBar";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { stripMinimalTag } from "@/lib/game/displayMode";
import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Plus, RefreshCw, Users } from "lucide-react";

type LobbyRoomListPanelProps = {
  firebaseEnabled: boolean;
  roomsLoading: boolean;
  showSkeletons: boolean;
  roomCount: number;
  searchInput: string;
  hideLockedRooms: boolean;
  showJoinableOnly: boolean;
  paginatedRooms: LobbyRoom[];
  lobbyCounts: Record<string, number | undefined>;
  pageIndex: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  activeSearch: boolean;
  displaySearchKeyword: string;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onToggleHideLockedRooms: () => void;
  onToggleShowJoinableOnly: () => void;
  onJoinRoom: (roomId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onCreateRoom: () => void;
};

export function LobbyRoomListPanel(props: LobbyRoomListPanelProps) {
  const {
    firebaseEnabled,
    roomsLoading,
    showSkeletons,
    roomCount,
    searchInput,
    hideLockedRooms,
    showJoinableOnly,
    paginatedRooms,
    lobbyCounts,
    pageIndex,
    totalPages,
    hasPrevPage,
    hasNextPage,
    activeSearch,
    displaySearchKeyword,
    onRefresh,
    onSearchChange,
    onSearchClear,
    onToggleHideLockedRooms,
    onToggleShowJoinableOnly,
    onJoinRoom,
    onPrevPage,
    onNextPage,
    onCreateRoom,
  } = props;

  return (
    <GridItem>
      <Box
        mb={scaleForDpi("1.7rem")}
        bg="bgPanel"
        border="borders.retrogame"
        borderColor="whiteAlpha.90"
        borderRadius={0}
        p={5}
        boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
        position="relative"
      >
        <HStack justify="space-between" mb={4}>
          <HStack gap={3}>
            <Box
              w={10}
              h={10}
              borderRadius={0}
              bg="bgSubtle"
              border="borders.retrogameThin"
              borderColor="whiteAlpha.60"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
            >
              <Users size={20} />
            </Box>
            <HStack align="baseline" gap={3}>
              <Heading
                size="xl"
                fontWeight={700}
                color="white"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
                letterSpacing="0.5px"
              >
                アクティブな部屋
              </Heading>
              <Text
                fontSize="sm"
                fontWeight={600}
                color="rgba(255,255,255,0.6)"
                fontFamily="monospace"
              >
                {roomCount}件
              </Text>
            </HStack>
          </HStack>

          {/* リフレッシュボタン */}
          <AppButton
            size="sm"
            visual="outline"
            palette="gray"
            onClick={onRefresh}
            loading={roomsLoading}
            disabled={!firebaseEnabled}
          >
            <RefreshCw size={16} />
          </AppButton>
        </HStack>
      </Box>

      <Box mt={6} mb={6}>
        <SearchBar
          value={searchInput}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder="部屋を さがす..."
        />
        <HStack
          gap={3}
          mt={4}
          flexWrap="wrap"
          data-testid="lobby-filter-controls"
        >
          <AppButton
            size="sm"
            visual={hideLockedRooms ? "solid" : "outline"}
            palette={hideLockedRooms ? "success" : "gray"}
            aria-pressed={hideLockedRooms}
            onClick={onToggleHideLockedRooms}
            css={{
              minWidth: "180px",
              textAlign: "center",
              position: "relative",
              ...(hideLockedRooms && {
                boxShadow: `
                        inset 0 3px 6px rgba(0,0,0,0.4),
                        inset 0 -1px 0 rgba(255,255,255,0.1),
                        0 1px 2px rgba(0,0,0,0.2)
                      `,
                transform: "translateY(1px)",
              }),
            }}
          >
            🔒 ロック部屋を除外
            {hideLockedRooms && (
              <Box
                as="span"
                position="absolute"
                top="-4px"
                right="-4px"
                w="12px"
                h="12px"
                bg="success.500"
                borderRadius="50%"
                border="2px solid white"
                boxShadow="0 0 8px rgba(34, 197, 94, 0.6)"
              />
            )}
          </AppButton>
          <AppButton
            size="sm"
            visual={showJoinableOnly ? "solid" : "outline"}
            palette={showJoinableOnly ? "success" : "gray"}
            aria-pressed={showJoinableOnly}
            onClick={onToggleShowJoinableOnly}
            css={{
              minWidth: "180px",
              textAlign: "center",
              position: "relative",
              ...(showJoinableOnly && {
                boxShadow: `
                        inset 0 3px 6px rgba(0,0,0,0.4),
                        inset 0 -1px 0 rgba(255,255,255,0.1),
                        0 1px 2px rgba(0,0,0,0.2)
                      `,
                transform: "translateY(1px)",
              }),
            }}
          >
            🎮 待機中のみ表示
            {showJoinableOnly && (
              <Box
                as="span"
                position="absolute"
                top="-4px"
                right="-4px"
                w="12px"
                h="12px"
                bg="success.500"
                borderRadius="50%"
                border="2px solid white"
                boxShadow="0 0 8px rgba(34, 197, 94, 0.6)"
              />
            )}
          </AppButton>
        </HStack>
      </Box>

      {!firebaseEnabled ? (
        <Box
          p={12}
          textAlign="center"
          borderRadius={0}
          border="borders.retrogame"
          borderColor="dangerBorder"
          bg="dangerSubtle"
          boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
        >
          <Text fontSize="xl" color="dangerSolid" fontWeight={600} mb={3}>
            Firebase未設定です
          </Text>
          <Text color="fgMuted">.env.local を設定するとルーム一覧が表示されます</Text>
        </Box>
      ) : roomsLoading && showSkeletons ? (
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          }}
          gap={6}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Box
              key={i}
              h="200px"
              borderRadius={0}
              bg="bgSubtle"
              border="borders.retrogameThin"
              borderColor="whiteAlpha.40"
              opacity={0.6}
              boxShadow="1px 1px 0 rgba(0,0,0,0.4)"
            />
          ))}
        </Grid>
      ) : roomCount > 0 ? (
        <VStack align="stretch" gap={6}>
          <Grid
            templateColumns={{
              base: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
              xl: "repeat(3, 1fr)",
            }}
            gap={{ base: 4, md: 5 }}
            alignItems="stretch"
          >
            {paginatedRooms.map((room) => (
              <RoomCard
                key={room.id}
                id={room.id}
                name={stripMinimalTag(room.name) || ""}
                status={room.status}
                count={lobbyCounts[room.id] ?? 0}
                creatorName={room.creatorName || room.hostName || "匿名"}
                hostName={room.hostName || null}
                requiresPassword={room.requiresPassword}
                onJoin={onJoinRoom}
              />
            ))}
          </Grid>
          {totalPages > 1 && (
            <Pagination
              currentPage={pageIndex}
              totalPages={totalPages}
              onPrev={onPrevPage}
              onNext={onNextPage}
              disablePrev={!hasPrevPage}
              disableNext={!hasNextPage}
            />
          )}
        </VStack>
      ) : (
        <Box
          textAlign="center"
          py={16}
          px={8}
          borderRadius={0}
          border="borders.retrogame"
          borderColor="whiteAlpha.60"
          bg="bgSubtle"
          boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
        >
          <Heading size="md" color="text" mb={3} fontWeight={600}>
            {activeSearch
              ? `「${displaySearchKeyword}」に一致する部屋はありません`
              : "アクティブな部屋がまだありません"}
          </Heading>
          <Text color="fgMuted" mb={6} maxW="400px" mx="auto">
            {activeSearch
              ? "別のキーワードで検索するか、新しい部屋を作成してみましょう"
              : "新しい部屋を作成して、友だちを招待してみましょう"}
          </Text>
          {activeSearch ? (
            <AppButton onClick={onSearchClear} visual="solid" palette="gray">
              <Plus size={18} style={{ marginRight: "8px" }} />
              検索をクリア
            </AppButton>
          ) : (
            <AppButton onClick={onCreateRoom} visual="solid" palette="brand">
              <Plus size={18} style={{ marginRight: "8px" }} />
              新しい部屋を作成
            </AppButton>
          )}
        </Box>
      )}
    </GridItem>
  );
}

