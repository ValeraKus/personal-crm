"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <h1 className="text-lg font-semibold">Не получилось загрузить данные</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Скорее всего, не запущена база данных. Запустите её командой{" "}
        <code className="rounded bg-muted px-1 py-0.5">docker compose up -d</code> и попробуйте
        снова.
      </p>
      <Button className="mt-4" onClick={() => retry()}>
        Попробовать снова
      </Button>
    </div>
  );
}
