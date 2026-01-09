import { notify } from "@/components/ui/notify";
import { sendMessage, sendSystemMessage } from "@/lib/firebase/chat";

export async function postCustomTopicToChat(roomId: string, topic: string) {
  try {
    const { getAuth, signInAnonymously } = await import("firebase/auth");
    const auth = getAuth();
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => void 0);
    }
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    const name = currentUser?.displayName?.trim() || "プレイヤー";
    const chatText = `📝 お題: ${topic}`;
    if (uid) {
      await sendMessage(roomId, uid, name, chatText);
    } else {
      await sendSystemMessage(roomId, chatText);
    }
  } catch (err) {
    notify({
      title: "チャット投稿に失敗しました",
      description:
        err instanceof Error ? err.message : "お題変更のメッセージを書き込めませんでした",
      type: "error",
    });
  }
}

