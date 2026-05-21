import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconSearch,
  IconPlus,
  IconPuzzle,
  IconLayoutSidebar,
  IconLayoutSidebarRightCollapse,
} from "@tabler/icons-react";
import { useSidebar } from "@/components/ui/sidebar";
import { CommandMenu } from "@/components/chat/CommandMenu";
import type { SessionListItem } from "../../../types/electron-api";

const navItems = [
  { id: "new-session", title: "New Conversation", icon: IconPlus, active: true },
  { id: "search", title: "Conversation History", icon: IconSearch },
  { id: "extensions", title: "Extensions", icon: IconPuzzle },
];

export function NavHeader({
  activeView,
  allSessions,
  onNewSession,
  onSelectSession,
  onNavigate,
}: {
  activeView?: string;
  allSessions: SessionListItem[];
  onNewSession: () => void;
  onSelectSession: (path: string, workspacePath?: string) => void;
  onNavigate?: (view: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { state, toggleSidebar } = useSidebar();
  const activeNav = React.useMemo(() => {
    if (activeView === "extensions") return "extensions";
    if (activeView === "search") return "search";
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

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <button
          onClick={() => toggleSidebar()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <IconLayoutSidebarRightCollapse className="h-4 w-4" />
        </button>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "new-session") onNewSession();
                if (item.id === "search") setOpen(true);
                if (item.id === "extensions") {
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
          sessions={allSessions}
          onSelectSession={onSelectSession}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 pt-3 pb-2">
      {/* Toggle + collapse */}
      <div className="flex items-center justify-end px-1 mb-1">
        <button
          onClick={() => toggleSidebar()}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <IconLayoutSidebar className="h-4 w-4" />
        </button>
      </div>

      {/* Top action buttons */}
      <div className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "new-session") onNewSession();
                if (item.id === "search") setOpen(true);
                if (item.id === "extensions") {
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
        sessions={allSessions}
        onSelectSession={onSelectSession}
      />
    </div>
  );
}
