import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { IconCornerDownLeft, IconMessageCircle } from "@tabler/icons-react";
import type { SessionListItem } from "../../../types/electron-api";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionListItem[];
  onSelectSession: (path: string) => void;
}

export const CommandMenu = React.memo(function CommandMenu({
  open,
  onOpenChange,
  sessions,
  onSelectSession,
}: CommandMenuProps) {
  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  // Memoize the heavy list so parent re-renders don't recreate all CommandItems
  const sessionItems = React.useMemo(() => {
    if (sessions.length === 0) return null;
    return (
      <CommandGroup
        className="p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
        heading="Sessions"
      >
        {sessions.map((session) => (
          <CommandItem
            className="px-3! h-9 rounded-md border border-transparent font-medium hover:border-input hover:bg-input/50"
            key={session.path}
            onSelect={() => runCommand(() => onSelectSession(session.path))}
            value={`session ${session.title || "Untitled"} ${session.path}`}
          >
            <IconMessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{session.title || "Untitled"}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {session.messageCount}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  }, [sessions, runCommand, onSelectSession]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false} className="rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800 max-w-lg duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Search workspaces, sessions, and commands
          </DialogDescription>
        </DialogHeader>

        <Command className="rounded-none bg-transparent **:data-[slot=command-input-wrapper]:p-0 **:data-[slot=command-input-wrapper]:pb-1 **:data-[slot=command-input]:py-0">
          <CommandInput placeholder="Search chats..." />
          {/* Only mount heavy list when open — saves DOM nodes + React reconciler work */}
          {open && (
            <CommandList className="no-scrollbar min-h-[280px] scroll-pt-2 scroll-pb-1.5">
              <CommandEmpty className="py-12 text-center text-muted-foreground text-sm">
                No chats found.
              </CommandEmpty>
              {sessionItems}
            </CommandList>
          )}
        </Command>

        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 px-4 font-medium text-muted-foreground text-xs dark:border-t-neutral-700 dark:bg-neutral-800">
          <Kbd>
            <IconCornerDownLeft className="h-3 w-3" />
          </Kbd>
          <span>Select</span>
          <span className="ml-auto">
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> Navigate
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
});
