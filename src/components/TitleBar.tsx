import * as React from "react";
import { IconMinus, IconSquare, IconCopy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const isMac = window.electron.platform === "darwin";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    window.electron.windowIsMaximized().then(setIsMaximized);
    const unsubscribe = window.electron.onWindowMaximized(setIsMaximized);
    return unsubscribe;
  }, []);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] flex h-10 items-center justify-between select-none",
        "bg-sidebar border-b border-sidebar-border",
        isMac ? "pl-20" : ""
      )}
      style={{ WebkitAppRegion: "drag" }}
    >
      {/* Center title */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-medium text-sidebar-foreground/80">
          Pi Desktop
        </span>
      </div>

      {/* Window controls — hidden on macOS (native traffic lights) */}
      {!isMac && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center"
          style={{ WebkitAppRegion: "no-drag" }}
        >
          <button
            onClick={() => window.electron.windowMinimize()}
            className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="Minimize"
          >
            <IconMinus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => window.electron.windowMaximize()}
            className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <IconCopy className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <IconSquare className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </button>
          <button
            onClick={() => window.electron.windowClose()}
            className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Close"
          >
            <IconX className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
