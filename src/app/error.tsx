"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Window } from "@/components/window";

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
    <Window title="ошибка.exe" bar="accent" controls={2} className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
        <h1 className="font-display text-18 leading-heading uppercase sm:text-22">
          Не получилось загрузить данные
        </h1>
        <p className="max-w-md text-15 leading-body text-ink-soft">
          Скорее всего, не запущена база данных. Запустите её командой{" "}
          <code className="border border-ink bg-paper px-1 py-0.5 text-14">docker compose up -d</code>{" "}
          и попробуйте снова.
        </p>
        <Button className="mt-2" onClick={() => retry()}>
          Попробовать снова
        </Button>
      </div>
    </Window>
  );
}
