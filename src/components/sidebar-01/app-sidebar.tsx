import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { NavHeader } from "@/components/sidebar-01/nav-header";
import { NavSessions } from "@/components/sidebar-01/nav-sessions";
import { IconSettings } from "@tabler/icons-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSessionPath: string | null;
  activeView?: string;
  activePtyKeys?: string[];
  onSelectSession: (path: string, workspacePath?: string) => void;
  onNewSession?: () => void;
  onNewSessionForWorkspace?: (workspacePath: string) => void;
  onRemoveWorkspace?: (workspacePath: string) => void;
  onWorkspaceChange?: (path: string | null) => void;
  onNavigate?: (view: string) => void;
}

export function AppSidebar({
  activeSessionPath,
  activeView,
  activePtyKeys,
  onSelectSession,
  onNewSession,
  onNewSessionForWorkspace,
  onRemoveWorkspace,
  onWorkspaceChange,
  onNavigate,
  ...props
}: AppSidebarProps) {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceInfo[]>([]);
  const [workspaceSessions, setWorkspaceSessions] = React.useState<Record<string, SessionListItem[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [lastActiveWorkspace, setLastActiveWorkspace] = React.useState<string | null>(null);

  // Load workspaces on mount
  React.useEffect(() => {
    window.electron.getWorkspaces().then((list) => {
      setWorkspaces(list);
    });
  }, []);

  // Load sessions when a workspace is expanded and not yet loaded
  const prevExpandedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    for (const path of expanded) {
      if (prevExpandedRef.current.has(path)) continue;
      window.electron.getSessions(path).then((list) => {
        setWorkspaceSessions((prev) => ({ ...prev, [path]: list }));
      });
    }
    prevExpandedRef.current = new Set(expanded);
  }, [expanded]);

  // Refresh on session index updates
  React.useEffect(() => {
    const unsubscribe = window.electron.onSessionIndexUpdated(() => {
      window.electron.getWorkspaces().then((list) => {
        setWorkspaces(list);
        for (const path of expanded) {
          window.electron.getSessions(path).then((sessions) => {
            setWorkspaceSessions((prev) => ({ ...prev, [path]: sessions }));
          });
        }
      });
    });
    return unsubscribe;
  }, [expanded]);

  const allSessions = React.useMemo(
    () => Object.values(workspaceSessions).flat(),
    [workspaceSessions]
  );

  const toggleWorkspace = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    setLastActiveWorkspace(path);
    onWorkspaceChange?.(path);
  };

  const handleSelectSession = (path: string, workspacePath: string) => {
    setLastActiveWorkspace(workspacePath);
    onWorkspaceChange?.(workspacePath);
    onSelectSession(path, workspacePath);
  };

  const handleNewSession = () => {
    if (!lastActiveWorkspace) {
      // Pick first workspace if none active
      const first = workspaces[0]?.path ?? null;
      if (first) {
        setLastActiveWorkspace(first);
        onWorkspaceChange?.(first);
      }
    }
    onNewSession?.();
  };

  const handleAddWorkspace = async () => {
    const result = await window.electron.addWorkspace();
    if (!result.cancelled && result.path) {
      setExpanded((prev) => new Set(prev).add(result.path!));
      setLastActiveWorkspace(result.path);
      onWorkspaceChange?.(result.path);
    }
  };

  return (
    <Sidebar {...props} collapsible="icon" className="border-r border-border/40">
      <SidebarContent className="flex flex-col gap-0 overflow-hidden pt-10">
        <NavHeader
          activeView={activeView}
          allSessions={allSessions}
          onNewSession={handleNewSession}
          onSelectSession={onSelectSession}
          onNavigate={onNavigate}
        />
        <NavSessions
          workspaces={workspaces}
          workspaceSessions={workspaceSessions}
          expandedWorkspaces={expanded}
          activeSessionPath={activeSessionPath ?? undefined}
          activePtyKeys={activePtyKeys}
          onToggleWorkspace={toggleWorkspace}
          onSelectSession={handleSelectSession}
          onNewSessionForWorkspace={onNewSessionForWorkspace}
          onRemoveWorkspace={onRemoveWorkspace}
          onAddWorkspace={handleAddWorkspace}
        />
      </SidebarContent>
      <SettingsFooter />
    </Sidebar>
  );
}

function SettingsFooter() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <SidebarFooter className={cn("border-t border-border/20", isCollapsed && "items-center")}>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center gap-2.5 rounded-md text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors",
            isCollapsed ? "h-8 w-8 justify-center p-0" : "w-full px-2.5 py-[7px]"
          )}
          title="Settings"
          aria-label="Settings"
        >
          <IconSettings className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </SidebarFooter>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
