"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export function useCategories() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    []
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api<typeof categories>("/categories", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setCategories(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  return {
    categories,
    categoriesError: error,
    retryCategories: () => setRevision((v) => v + 1),
  };
}
