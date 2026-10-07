import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const COLORS = [
  "bg-rose-100 text-rose-800",
  "bg-amber-100 text-amber-800",
  "bg-lime-100 text-lime-800",
  "bg-emerald-100 text-emerald-800",
  "bg-cyan-100 text-cyan-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-fuchsia-100 text-fuchsia-800",
];

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
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
