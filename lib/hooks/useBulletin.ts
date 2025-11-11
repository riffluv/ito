"use client";
import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, limit, type Unsubscribe } from "firebase/firestore";
import { db, firebaseEnabled } from "@/lib/firebase/client";

export type BulletinPost = {
  id: string;
  title: string;
  body: string;
  createdAt: Date | null;
  author?: { uid?: string; name?: string } | null;
  pinned?: boolean;
};

export function useBulletin(enabled: boolean) {
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let unsub: Unsubscribe | null = null;

    if (!enabled || !firebaseEnabled || !db) {
      // Fallback ダミーポスト（開発時）
      setPosts([
        {
          id: "local-1",
          title: "ようこそ！",
          body: "ここに開発者からのお知らせが表示されます。Firebase設定後に投稿できます。",
          createdAt: new Date(),
          author: { name: "Admin" },
          pinned: true,
        },
      ]);
      setLoading(false);
    } else {
      try {
        const q = query(collection(db, "bulletin"), orderBy("createdAt", "desc"), limit(20));
        unsub = onSnapshot(
          q,
          (snap) => {
            const list: BulletinPost[] = snap.docs.map((d) => {
              const raw = d.data() as Record<string, unknown>;
              const createdAtRaw = raw.createdAt;
              const ts =
                typeof createdAtRaw === "object" &&
                createdAtRaw !== null &&
                "toDate" in createdAtRaw &&
                typeof (createdAtRaw as { toDate?: () => Date }).toDate === "function"
                  ? (createdAtRaw as { toDate: () => Date }).toDate()
                  : createdAtRaw instanceof Date
                  ? createdAtRaw
                  : null;
              return {
                id: d.id,
                title: typeof raw.title === "string" ? raw.title : "(無題)",
                body: typeof raw.body === "string" ? raw.body : "",
                createdAt: ts,
                author:
                  raw.author && typeof raw.author === "object"
                    ? (raw.author as { uid?: string; name?: string })
                    : null,
                pinned: Boolean(raw.pinned),
              };
            });
            setPosts(list);
            setLoading(false);
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        );
      } catch (e) {
        setError(e);
        setLoading(false);
      }
    }

    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, [enabled]);

  const addPost = async (post: { title: string; body: string; author?: { uid?: string; name?: string } | null; pinned?: boolean }) => {
    if (!firebaseEnabled || !db) throw new Error("Firebase未設定のため投稿できません");
    await addDoc(collection(db!, "bulletin"), {
      ...post,
      createdAt: serverTimestamp(),
    });
  };

  return { posts, loading, error, addPost };
}
