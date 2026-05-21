import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  IconSearch,
  IconChevronDown,
  IconPlus,
  IconBolt,
  IconFolder,
  IconSparkles,
  IconPuzzle,
  IconLayoutSidebar,
  IconLayoutSidebarRightCollapse,
} from "@tabler/icons-react";
import { useSidebar } from "@/components/ui/sidebar";
import { CommandMenu } from "@/components/chat/CommandMenu";
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

const navItems = [
  { id: "new-session", title: "New Session", icon: IconPlus, active: true },
  { id: "skills", title: "Skills", icon: IconSparkles },
  { id: "extensions", title: "Extensions", icon: IconPuzzle },
];

export function NavHeader({
  activeView,
  workspaces,
  sessions,
  activeWorkspace,
  onSelectWorkspace,
  onSelectSession,
  onAddWorkspace,
  onNewSession,
  onNavigate,
}: {
  activeView?: string;
  workspaces: WorkspaceInfo[];
  sessions: SessionListItem[];
  activeWorkspace: WorkspaceInfo | null;
  onSelectWorkspace: (path: string) => void;
  onSelectSession: (path: string) => void;
  onAddWorkspace: () => void;
  onNewSession: () => void;
  onNavigate?: (view: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { state, toggleSidebar } = useSidebar();

  // Map app view to nav item id for highlight sync
  const activeNav = React.useMemo(() => {
    if (activeView === "skills") return "skills";
    if (activeView === "extensions") return "extensions";
    return "new-session";
  }, [activeView]);
  const isCollapsed = state === "collapsed";

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Collapsed icon-only rail
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        {/* Toggle expand */}
        <button
          onClick={() => toggleSidebar()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <IconLayoutSidebarRightCollapse className="h-4 w-4" />
        </button>

        {/* Search icon */}
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Search"
          aria-label="Search"
        >
          <IconSearch className="h-4 w-4" />
        </button>

        {/* Nav icons */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "new-session") onNewSession();
                if (item.id === "skills" || item.id === "extensions") {
                  onNavigate?.(item.id);
                }
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              title={item.title}
              aria-label={item.title}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        <CommandMenu
          open={open}
          onOpenChange={setOpen}
          sessions={sessions}
          onSelectSession={onSelectSession}
        />
      </div>
    );
  }

  // Expanded full view
  return (
    <div className="flex flex-col gap-1 px-3 pt-3 pb-2">
      {/* Workspace switcher */}
      <div className="flex items-center justify-between px-1 mb-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
          >
            <IconBolt className="h-4 w-4 text-foreground" />
            <span className="truncate max-w-[140px]">
              {activeWorkspace?.displayName ?? "Select project"}
            </span>
            <IconChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.path}
                className="gap-2"
                onClick={() => onSelectWorkspace(ws.path)}
              >
                <IconFolder className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{ws.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {ws.sessionCount}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="gap-2 text-muted-foreground" onClick={onAddWorkspace}>
              <IconPlus className="h-4 w-4" />
              New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleSidebar()}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <IconLayoutSidebar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm",
          "bg-background/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        )}
      >
        <IconSearch className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="hidden lg:inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "new-session") onNewSession();
                if (item.id === "skills" || item.id === "extensions") {
                  onNavigate?.(item.id);
                }
              }}
              className={cn(
                "flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.title}</span>
            </button>
          );
        })}
      </div>

      <CommandMenu
        open={open}
        onOpenChange={setOpen}
        sessions={sessions}
        onSelectSession={onSelectSession}
      />
    </div>
  );
}
