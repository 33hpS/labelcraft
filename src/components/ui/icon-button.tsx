import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /**
   * Accessible label for screen readers.
   */
  label: string
  children: React.ReactNode
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        aria-label={label}
        className={cn("relative", className)}
        {...props}
      >
        <span className="sr-only">{label}</span>
        {children}
      </Button>
    )
  }
)

IconButton.displayName = "IconButton"
