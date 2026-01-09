import { notify } from "@/components/ui/notify";
import { sendNotifyEvent } from "@/lib/firebase/events";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import {
  apiSelectTopicCategory,
  apiSetCustomTopic,
} from "@/lib/services/roomApiClient";
import { postCustomTopicToChat } from "@/lib/game/topicControls/chatPost";
import { topicControls } from "@/lib/game/topicControls";

jest.mock("@/components/ui/notify", () => ({
  notify: jest.fn(),
}));

jest.mock("@/lib/firebase/events", () => ({
  sendNotifyEvent: jest.fn(),
}));

jest.mock("@/lib/firebase/permissionGuard", () => ({
  withPermissionRetry: jest.fn((fn: () => unknown) => fn()),
}));

jest.mock("@/lib/services/roomApiClient", () => ({
  apiResetTopic: jest.fn(),
  apiSelectTopicCategory: jest.fn(),
  apiSetCustomTopic: jest.fn(),
  apiShuffleTopic: jest.fn(),
}));

jest.mock("@/lib/game/topicControls/chatPost", () => ({
  postCustomTopicToChat: jest.fn(),
}));

jest.mock("@/lib/topics", () => ({
  topicTypeLabels: { testType: "テストカテゴリ" },
}));

describe("topicControls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("selectCategory calls API via withPermissionRetry and broadcasts success notify", async () => {
    const roomId = "room-1";
    const type = "testType" as unknown as import("@/lib/topics").TopicType;

    await topicControls.selectCategory(roomId, type);

    expect(withPermissionRetry).toHaveBeenCalled();
    expect(apiSelectTopicCategory).toHaveBeenCalledWith(roomId, type);
    expect(sendNotifyEvent).toHaveBeenCalledWith(
      roomId,
      expect.objectContaining({
        type: "success",
        title: 'カテゴリ「テストカテゴリ」を選択しました',
        dedupeKey: "topic:select:testType",
      })
    );
    expect(notify).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" })
    );
  });

  test("setCustomTopic trims input, calls API, broadcasts, and posts to chat", async () => {
    const roomId = "room-2";
    (apiSetCustomTopic as unknown as jest.Mock).mockResolvedValue(undefined);

    await topicControls.setCustomTopic(roomId, "  ねこ  ");

    expect(apiSetCustomTopic).toHaveBeenCalledWith(roomId, "ねこ");
    expect(sendNotifyEvent).toHaveBeenCalledWith(
      roomId,
      expect.objectContaining({
        type: "success",
        title: "お題を設定しました",
        dedupeKey: "topic:custom:ねこ",
      })
    );
    expect(postCustomTopicToChat).toHaveBeenCalledWith(roomId, "ねこ");
  });

  test("setCustomTopic throws when empty after trim", async () => {
    await expect(topicControls.setCustomTopic("room-3", "   ")).rejects.toThrow(
      "お題を入力してください"
    );
  });
});

