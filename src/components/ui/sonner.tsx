"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Loader2Icon } from "lucide-react"

import { PixelIcon } from "@/components/pixel-icon"

// Square status mark like the "!" squares on the landing
function ToastMark({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`flex size-5 items-center justify-center border-2 border-ink font-pixel text-8 ${className}`}
    >
      {children}
    </span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <ToastMark className="bg-accent">
            <PixelIcon name="check" className="size-2.5" />
          </ToastMark>
        ),
        info: <ToastMark className="bg-lilac">i</ToastMark>,
        warning: <ToastMark className="bg-butter">!</ToastMark>,
        error: <ToastMark className="bg-white text-danger">!</ToastMark>,
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-white)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-ink)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Sonner's own styles are not in a Tailwind layer, so overrides need `!`
          toast: "cn-toast gap-3! border-2! font-sans! text-15! shadow-px!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
