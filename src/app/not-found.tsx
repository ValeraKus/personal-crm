import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <h1 className="text-lg font-semibold">Такой страницы нет</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Button asChild className="mt-4">
        <Link href="/">К списку контактов</Link>
      </Button>
    </div>
  );
}
