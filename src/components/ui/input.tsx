import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 border-2 border-ink bg-white px-3 text-16 text-ink outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-14 file:font-medium placeholder:text-ink-faint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
