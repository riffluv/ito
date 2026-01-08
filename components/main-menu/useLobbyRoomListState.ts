import type { LobbyRoom } from "@/components/main-menu/types";
import {
  filterLobbyRooms,
  filterLobbyRoomsByOptions,
  filterLobbyRoomsBySearch,
  sortLobbyRooms,
} from "@/components/main-menu/roomListDerivations";
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
import {
  ROOMS_PER_PAGE,
  useOptimizedRooms,
} from "@/lib/hooks/useOptimizedRooms";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseLobbyRoomListStateParams = {
  enabled: boolean;
  excludeUid?: string;
};

export function useLobbyRoomListState(params: UseLobbyRoomListStateParams) {
  const { enabled, excludeUid } = params;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hideLockedRooms, setHideLockedRooms] = useState(false);
  const [showJoinableOnly, setShowJoinableOnly] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(handler);
    };
  }, [searchInput]);

  // onSnapshotは重いから定期取得に変更
  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
    refresh: refreshRooms,
    pageSize: roomsPerPage,
  } = useOptimizedRooms({
    enabled,
    page: pageIndex,
    searchQuery: debouncedSearch,
  });

  useEffect(() => {
    if (!roomsLoading) {
      setShowSkeletons(false);
    }
  }, [roomsLoading]);

  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);

  const roomMap = useMemo(() => {
    const map = new Map<string, LobbyRoom>();
    rooms.forEach((room) => {
      map.set(room.id, room);
    });
    return map;
  }, [rooms]);

  // 人数カウント（RTDB優先、ない時はFirestore使う）
  const { counts: lobbyCounts, refresh: refreshLobbyCounts } = useLobbyCounts(
    roomIds,
    !!(enabled && roomIds.length > 0),
    { excludeUid }
  );

  const filteredRooms = useMemo(() => {
    const nowMs = Date.now();
    const recentWindowMs =
      Number(process.env.NEXT_PUBLIC_LOBBY_RECENT_MS) || 5 * 60 * 1000;
    return filterLobbyRooms({
      rooms,
      lobbyCounts,
      nowMs,
      recentWindowMs,
      inProgressDisplayMs: 15 * 60 * 1000,
      createdWindowMs: 10 * 60 * 1000,
    });
  }, [rooms, lobbyCounts]);

  const optionFilteredRooms = useMemo(() => {
    return filterLobbyRoomsByOptions({
      rooms: filteredRooms,
      hideLockedRooms,
      showJoinableOnly,
    });
  }, [filteredRooms, hideLockedRooms, showJoinableOnly]);

  const searchFilteredRooms = useMemo(() => {
    return filterLobbyRoomsBySearch({
      rooms: optionFilteredRooms,
      debouncedSearch,
    });
  }, [optionFilteredRooms, debouncedSearch]);

  // ソート順: 人数多い → 新規作成 → 最終アクティブ
  const sortedRooms = useMemo(() => {
    return sortLobbyRooms({ rooms: searchFilteredRooms, lobbyCounts });
  }, [searchFilteredRooms, lobbyCounts]);

  const pageSize =
    roomsPerPage && roomsPerPage > 0 ? roomsPerPage : ROOMS_PER_PAGE;

  const totalPages = useMemo(() => {
    if (!pageSize || pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(sortedRooms.length / pageSize));
  }, [sortedRooms.length, pageSize]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= totalPages) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  const paginatedRooms = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRooms.slice(start, start + pageSize);
  }, [sortedRooms, pageIndex, pageSize]);

  const hasPrevPage = pageIndex > 0;
  const hasNextPage = pageIndex < totalPages - 1;
  const activeSearch = debouncedSearch.length > 0;
  const displaySearchKeyword = activeSearch ? debouncedSearch.slice(0, 40) : "";

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPageIndex(0);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchInput("");
    setPageIndex(0);
  }, []);

  const handleToggleHideLockedRooms = useCallback(() => {
    setHideLockedRooms((prev) => !prev);
    setPageIndex(0);
  }, []);

  const handleToggleShowJoinableOnly = useCallback(() => {
    setShowJoinableOnly((prev) => !prev);
    setPageIndex(0);
  }, []);

  const handleRefreshLobby = useCallback(() => {
    refreshRooms();
    refreshLobbyCounts();
  }, [refreshRooms, refreshLobbyCounts]);

  const handlePrevPage = useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextPage = useCallback(() => {
    setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  return {
    roomsLoading,
    roomsError,
    showSkeletons,
    roomCount: searchFilteredRooms.length,
    searchInput,
    hideLockedRooms,
    showJoinableOnly,
    paginatedRooms,
    lobbyCounts,
    roomMap,
    pageIndex,
    totalPages,
    hasPrevPage,
    hasNextPage,
    activeSearch,
    displaySearchKeyword,
    onSearchChange: handleSearchChange,
    onSearchClear: handleSearchClear,
    onToggleHideLockedRooms: handleToggleHideLockedRooms,
    onToggleShowJoinableOnly: handleToggleShowJoinableOnly,
    onRefresh: handleRefreshLobby,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
  };
}

