import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

// Colors of the tags on the landing
const COLORS = ["bg-accent", "bg-lilac", "bg-butter", "bg-paper"];

// The same person always gets the same color
function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ContactAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center border-2 border-ink font-pixel text-10 text-ink",
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
