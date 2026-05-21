import * as React from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import {
  IconChevronRight,
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconPlus,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconPin,
  IconPinFilled,
  IconLoader2,
  IconCircleFilled,
  IconPlayerStop,
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
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

interface NavSessionsProps {
  workspaces: WorkspaceInfo[];
  workspaceSessions: Record<string, SessionListItem[]>;
  expandedWorkspaces: Set<string>;
  activeSessionPath?: string;
  activePtyKeys?: string[];
  onToggleWorkspace: (path: string) => void;
  onSelectSession: (path: string, workspacePath: string) => void;
  onNewSessionForWorkspace?: (workspacePath: string) => void;
  onRemoveWorkspace?: (workspacePath: string) => void;
  onAddWorkspace: () => void;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay >= 30) return `${Math.floor(diffDay / 30)}mo`;
  if (diffDay >= 1) return `${diffDay}d`;
  if (diffHour >= 1) return `${diffHour}h`;
  if (diffMin >= 1) return `${diffMin}m`;
  return "just now";
}

function SessionItem({
  session,
  isActive,
  isPtyActive,
  onSelect,
}: {
  session: SessionListItem;
  isActive: boolean;
  isPtyActive?: boolean;
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

  const handleStop = async () => {
    if (isPtyActive) {
      await window.electron.ptyKill(session.path);
    }
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

            <span className="flex items-center gap-1.5 shrink-0">
              {isPtyActive && (
                <IconCircleFilled className="h-2 w-2 shrink-0 text-green-500" />
              )}
              {activity.isStreaming && (
                <IconLoader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
              )}
              {!activity.isStreaming && activity.hasNewContent && !isActive && (
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {timeAgo(session.updatedAt)}
              </span>
            </span>
          </button>
        )}

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
                {isPtyActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleStop}>
                      <IconPlayerStop className="h-3.5 w-3.5" />
                      Stop
                    </DropdownMenuItem>
                  </>
                )}
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

export function NavSessions({
  workspaces,
  workspaceSessions,
  expandedWorkspaces,
  activeSessionPath,
  activePtyKeys,
  onToggleWorkspace,
  onSelectSession,
  onNewSessionForWorkspace,
  onRemoveWorkspace,
  onAddWorkspace,
}: NavSessionsProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) return null;

  return (
    <SidebarGroup className="flex-1 overflow-hidden flex flex-col px-3 pt-2">
      {/* Projects header */}
      <div className="flex items-center justify-between py-2 px-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Projects
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddWorkspace}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Add project"
            aria-label="Add project"
          >
            <IconPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SidebarGroupContent className="flex-1 overflow-y-auto no-scrollbar -mx-1">
        {workspaces.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground/50 text-center">
            No projects yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {workspaces.map((workspace) => {
              const isExpanded = expandedWorkspaces.has(workspace.path);
              const sessions = workspaceSessions[workspace.path] ?? [];

              return (
                <div key={workspace.path} className="flex flex-col">
                  {/* Workspace folder row */}
                  <div
                    className={cn(
                      "group/workspace flex items-center gap-1 w-full rounded-md px-2 py-2 text-left text-sm transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <button
                      onClick={() => onToggleWorkspace(workspace.path)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      {isExpanded ? (
                        <IconChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <IconChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {isExpanded ? (
                        <IconFolderOpen className="h-4 w-4 shrink-0" />
                      ) : (
                        <IconFolder className="h-4 w-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{workspace.displayName}</span>
                    </button>

                    {/* New session button — visible on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewSessionForWorkspace?.(workspace.path);
                      }}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded transition-colors",
                        "opacity-0 group-hover/workspace:opacity-100",
                        "hover:bg-accent/80 text-muted-foreground hover:text-foreground"
                      )}
                      title="New chat"
                      aria-label="New chat"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>

                    {/* Workspace actions dropdown — visible on hover */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded transition-colors",
                              "opacity-0 group-hover/workspace:opacity-100",
                              "hover:bg-accent/80 text-muted-foreground hover:text-foreground"
                            )}
                            title="Project options"
                            aria-label="Project options"
                          >
                            <IconDotsVertical className="h-3.5 w-3.5" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                        <DropdownMenuItem
                          onClick={() => onNewSessionForWorkspace?.(workspace.path)}
                        >
                          <IconPlus className="h-3.5 w-3.5" />
                          New chat
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onRemoveWorkspace?.(workspace.path)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          Remove project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Sessions inside expanded workspace */}
                  {isExpanded && (
                    <div className="flex flex-col gap-0.5 pl-6 pr-1 pb-1">
                      {sessions.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-muted-foreground/40">
                          No sessions
                        </div>
                      ) : (
                        sessions.map((session) => (
                          <SessionItem
                            key={session.path}
                            session={session}
                            isActive={session.path === activeSessionPath}
                            isPtyActive={activePtyKeys?.includes(session.path)}
                            onSelect={(path) => onSelectSession(path, workspace.path)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
