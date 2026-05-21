import * as React from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import {
  IconAdjustmentsHorizontal,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconPin,
  IconPinFilled,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSessionActivity } from "@/lib/sessionActivity";
import type { SessionListItem } from "../../../types/electron-api";

interface NavSessionsProps {
  sessions: SessionListItem[];
  activeSessionPath?: string;
  onSelectSession?: (path: string) => void;
}

function SessionItem({
  session,
  isActive,
  onSelect,
}: {
  session: SessionListItem;
  isActive: boolean;
  onSelect?: (path: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(session.title);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activity = useSessionActivity(session.path);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleRename = async () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) {
      await window.electron.renameSession(session.path, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRename();
    if (e.key === "Escape") {
      setEditValue(session.title);
      setEditing(false);
    }
  };

  const handlePin = async () => {
    await window.electron.pinSession(session.path, !session.pinned);
  };

  const handleDelete = async () => {
    await window.electron.deleteSession(session.path);
    setConfirmDelete(false);
  };

  return (
    <>
      <div
        className={cn(
          "group/menu-item relative w-full rounded-md transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        {editing ? (
          <div className="px-2 py-1.5">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleRename}
              className="h-7 text-sm"
            />
          </div>
        ) : (
          <button
            onClick={() => onSelect?.(session.path)}
            className="w-full text-left flex items-center gap-2 rounded-md px-2.5 py-2 pr-7"
          >
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
              {session.pinned && (
                <IconPinFilled className="h-3 w-3 shrink-0 opacity-50" />
              )}
              <span className="truncate text-sm">
                {session.title || "Untitled"}
              </span>
            </span>

            {/* Activity indicators — shown while streaming or after new content */}
            {activity.isStreaming && (
              <IconLoader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
            )}
            {!activity.isStreaming && activity.hasNewContent && !isActive && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            )}
          </button>
        )}

        {/* 3-dot menu — hidden by default, visible on hover or when active */}
        {!editing && (
          <div
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 z-10",
              isActive ? "opacity-100" : "opacity-0 group-hover/menu-item:opacity-100"
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded transition-colors",
                      isActive
                        ? "hover:bg-accent-foreground/10"
                        : "hover:bg-accent/80"
                    )}
                  >
                    <IconDotsVertical className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                <DropdownMenuItem
                  onClick={() => {
                    setEditValue(session.title);
                    setEditing(true);
                  }}
                >
                  <IconPencil className="h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePin}>
                  {session.pinned ? (
                    <>
                      <IconPin className="h-3.5 w-3.5" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <IconPinFilled className="h-3.5 w-3.5" />
                      Pin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{session.title || "Untitled"}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NavSessions({ sessions, activeSessionPath, onSelectSession }: NavSessionsProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) return null;

  return (
    <SidebarGroup className="flex-1 overflow-hidden flex flex-col px-3 pt-2">
      {/* Section header */}
      <div className="flex items-center justify-between py-2 px-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Recent chats
        </span>
        <button className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <IconAdjustmentsHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <SidebarGroupContent className="flex-1 overflow-y-auto no-scrollbar -mx-1">
        {sessions.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground/50 text-center">
            No sessions yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sessions.map((session) => (
              <SessionItem
                key={session.path}
                session={session}
                isActive={session.path === activeSessionPath}
                onSelect={onSelectSession}
              />
            ))}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
