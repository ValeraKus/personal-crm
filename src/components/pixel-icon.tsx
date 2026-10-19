import { cn } from "@/lib/utils";

// Pixel icons drawn with squares on a tiny grid, as on the landing (personal-crm-landing/src/icons).
// The color follows the text color.
const ICONS = {
  "arrow-right": {
    viewBox: "0 0 7 7",
    path: "M0 3h5v1H0zM3 1h1v1H3zM4 2h1v1H4zM5 3h1v1H5zM4 4h1v1H4zM3 5h1v1H3z",
  },
  check: {
    viewBox: "0 0 7 7",
    path: "M0 3h1v1H0zM1 4h1v1H1zM2 5h1v1H2zM3 4h1v1H3zM4 3h1v1H4zM5 2h1v1H5zM6 1h1v1H6z",
  },
  heart: {
    viewBox: "0 0 7 6",
    path: "M1 0h2v1H1zM4 0h2v1H4zM0 1h7v2H0zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z",
  },
  // Not on the landing: drawn in the same 7x7 grid
  pencil: {
    viewBox: "0 0 7 7",
    path: "M5 0h1v1H5zM4 1h3v1H4zM3 2h3v1H3zM2 3h3v1H2zM1 4h3v1H1zM1 5h2v1H1zM0 6h1v1H0z",
  },
  plus: {
    viewBox: "0 0 7 7",
    path: "M3 0h1v7H3zM0 3h7v1H0z",
  },
  search: {
    viewBox: "0 0 8 8",
    path: "M1 0h3v1H1zM0 1h1v3H0zM4 1h1v3H4zM1 4h3v1H1zM5 5h1v1H5zM6 6h1v1H6zM7 7h1v1H7z",
  },
} as const;

export type PixelIconName = keyof typeof ICONS;

export function PixelIcon({
  name,
  className,
  ...props
}: { name: PixelIconName } & React.ComponentProps<"svg">) {
  const { viewBox, path } = ICONS[name];
  return (
    <svg
      viewBox={viewBox}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d={path} />
    </svg>
  );
}
