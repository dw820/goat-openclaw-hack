"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export function FilterBar({
  onFilter,
}: {
  onFilter: (model: string) => void;
}) {
  const [value, setValue] = useState("");
  const timeout = useRef<ReturnType<typeof setTimeout>>(null);

  const debounced = useCallback(
    (v: string) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => onFilter(v), 300);
    },
    [onFilter]
  );

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-4">
      <Input
        placeholder="Filter by model name…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          debounced(e.target.value);
        }}
        className="max-w-sm"
      />
    </div>
  );
}
