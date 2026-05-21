import { cn } from "@/lib/utils"

interface KbdProps extends React.ComponentProps<"kbd"> {
  active?: boolean
}

function Kbd({ className, active, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      data-active={active ? "" : undefined}
      className={cn(
        /* Box — tight, crisp, works on any surface */
        "inline-flex h-[18px] w-fit min-w-[18px] shrink-0 items-center justify-center rounded-sm border border-foreground/10 bg-foreground/[0.05] px-[3px] font-sans text-[10px] font-medium leading-none text-foreground/60 select-none",
        /* Press feedback — GPU-only, 75ms */
        "transition-transform duration-75 ease-out",
        "data-[active]:scale-[0.92] data-[active]:bg-foreground/10 data-[active]:text-foreground/90",
        /* Tooltip overrides */
        "in-data-[slot=tooltip-content]:border-white/20 in-data-[slot=tooltip-content]:bg-white/10 in-data-[slot=tooltip-content]:text-white/90 dark:in-data-[slot=tooltip-content]:border-white/10 dark:in-data-[slot=tooltip-content]:bg-white/5",
        /* Icon sizing */
        "[&_svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
