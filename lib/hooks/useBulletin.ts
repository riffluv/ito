"use client";
import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { firebaseEnabled } from "@/lib/firebase/client";

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
      return;
    }

    try {
      const q = query(collection(db!, "bulletin"), orderBy("createdAt", "desc"), limit(20));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: BulletinPost[] = snap.docs.map((d) => {
            const data = d.data() as any;
            const ts = data.createdAt?.toDate?.() ?? (data.createdAt instanceof Date ? data.createdAt : null);
            return {
              id: d.id,
              title: data.title ?? "(無題)",
              body: data.body ?? "",
              createdAt: ts,
              author: data.author ?? null,
              pinned: !!data.pinned,
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
      return () => unsub();
    } catch (e) {
      setError(e);
      setLoading(false);
    }
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

