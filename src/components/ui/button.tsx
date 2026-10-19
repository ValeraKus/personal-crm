import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2.5 font-pixel whitespace-nowrap outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-violet disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        // Dark bevelled button from the landing, icons in accent pink
        default:
          "bg-ink text-white shadow-bevel hover:bg-ink-deep active:translate-y-px [&_svg]:text-accent",
        // White button with a hard shadow; pressing it sinks into the shadow
        outline:
          "border-2 border-ink bg-white text-ink shadow-px-sm hover:bg-paper active:translate-x-0.75 active:translate-y-0.75 active:shadow-none",
        secondary:
          "border-2 border-ink bg-lilac text-ink shadow-px-sm hover:bg-paper active:translate-x-0.75 active:translate-y-0.75 active:shadow-none",
        ghost: "text-ink hover:bg-paper",
        destructive:
          "border-2 border-danger bg-white text-danger shadow-px-sm hover:bg-paper active:translate-x-0.75 active:translate-y-0.75 active:shadow-none",
        link: "text-violet underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 text-10",
        sm: "h-9 gap-2 px-3 text-9",
        lg: "h-12 px-5 text-11",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
