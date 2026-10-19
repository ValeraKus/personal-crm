import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Pixel tag chip from the landing
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border-[1.5px] border-ink px-1.75 py-1.5 font-pixel text-8 whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet sm:px-2.25 sm:py-1.75 sm:text-9 [&>svg]:pointer-events-none [&>svg]:size-2.5!",
  {
    variants: {
      variant: {
        default: "bg-accent text-ink",
        secondary: "bg-lilac text-ink",
        destructive: "border-danger bg-white text-danger",
        outline: "bg-white text-ink",
        ghost: "border-transparent text-ink hover:bg-paper",
        link: "border-transparent text-violet underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
