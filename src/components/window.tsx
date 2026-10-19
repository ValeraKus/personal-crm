import { cn } from "@/lib/utils";

const BAR_COLORS = {
  accent: "bg-accent",
  lilac: "bg-lilac",
  butter: "bg-butter",
};

type WindowProps = {
  // Decorative caption in the title bar, hidden from screen readers unless `heading` is set
  title: string;
  heading?: boolean;
  bar: keyof typeof BAR_COLORS;
  controls?: 0 | 2 | 3;
  // Shown at the right edge of the title bar, before the controls
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

// Retro OS window from the landing: colored title bar with a pixel caption, white body
export function Window({
  title,
  heading = false,
  bar,
  controls = 0,
  aside,
  className,
  children,
}: WindowProps) {
  const Title = heading ? "h2" : "span";

  return (
    <div className={cn("border-2 border-ink bg-white shadow-px-md", className)}>
      <div
        className={cn(
          "flex h-9 items-center gap-3 border-b-2 border-ink px-2.5 sm:h-10.5 sm:px-3.5",
          BAR_COLORS[bar],
        )}
      >
        <Title
          aria-hidden={heading ? undefined : true}
          className="min-w-0 flex-1 truncate font-pixel text-9 sm:text-11"
        >
          {title}
        </Title>
        {aside}
        {controls > 0 ? (
          <span aria-hidden className="flex gap-1.5 sm:gap-2">
            {Array.from({ length: controls }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-3.5 border-2 border-ink sm:size-4",
                  i === controls - 1 ? "bg-ink" : "bg-white",
                )}
              />
            ))}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
