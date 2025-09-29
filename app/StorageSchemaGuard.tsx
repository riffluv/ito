"use client";

import { useEffect } from "react";
import { ensureStorageSchema } from "@/lib/utils/storageVersion";

export default function StorageSchemaGuard() {
  useEffect(() => {
    ensureStorageSchema();
  }, []);

  return null;
}

