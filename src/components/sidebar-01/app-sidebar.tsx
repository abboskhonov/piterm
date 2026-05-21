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
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSessionPath: string | null;
  activeView?: string;
  onSelectSession: (path: string) => void;
  onNewSession?: () => void;
  onWorkspaceChange?: (path: string | null) => void;
  onNavigate?: (view: string) => void;
}

export function AppSidebar({
  activeSessionPath,
  activeView,
  onSelectSession,
  onNewSession,
  onWorkspaceChange,
  onNavigate,
  ...props
}: AppSidebarProps) {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceInfo[]>([]);
  const [activeWorkspacePath, setActiveWorkspacePath] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionListItem[]>([]);

  // Load workspaces on mount
  React.useEffect(() => {
    const load = async () => {
      const list = await window.electron.getWorkspaces();
      setWorkspaces(list);
      if (list.length > 0 && !activeWorkspacePath) {
        setActiveWorkspacePath(list[0].path);
      }
    };
    load();
  }, []);

  // Notify parent of workspace changes
  React.useEffect(() => {
    onWorkspaceChange?.(activeWorkspacePath);
  }, [activeWorkspacePath]);

  // Load sessions when active workspace changes
  React.useEffect(() => {
    if (!activeWorkspacePath) return;
    const load = async () => {
      const list = await window.electron.getSessions(activeWorkspacePath);
      setSessions(list);
    };
    load();
  }, [activeWorkspacePath]);

  // Listen for session index updates
  React.useEffect(() => {
    const unsubscribe = window.electron.onSessionIndexUpdated(() => {
      window.electron.getWorkspaces().then((list) => {
        setWorkspaces(list);
        if (activeWorkspacePath) {
          window.electron.getSessions(activeWorkspacePath).then(setSessions);
        }
      });
    });
    return unsubscribe;
  }, [activeWorkspacePath]);

  const activeWorkspace = workspaces.find((w) => w.path === activeWorkspacePath);

  return (
    <Sidebar {...props} collapsible="icon" className="border-r border-border/40">
      <SidebarContent className="flex flex-col gap-0 overflow-hidden pt-10">
        <NavHeader
          activeView={activeView}
          workspaces={workspaces}
          sessions={sessions}
          activeWorkspace={activeWorkspace ?? null}
          onSelectWorkspace={(path) => {
            setActiveWorkspacePath(path);
          }}
          onSelectSession={onSelectSession}
          onAddWorkspace={async () => {
            const result = await window.electron.addWorkspace();
            if (!result.cancelled && result.path) {
              setActiveWorkspacePath(result.path);
            }
          }}
          onNewSession={async () => {
            if (!activeWorkspacePath) {
              console.warn("No active workspace to start a session in");
              return;
            }
            await window.electron.newSession(activeWorkspacePath);
            onNewSession?.();
          }}
          onNavigate={onNavigate}
        />
        <NavSessions
          sessions={sessions}
          activeSessionPath={activeSessionPath ?? undefined}
          onSelectSession={onSelectSession}
        />
      </SidebarContent>
      <SettingsFooter />
    </Sidebar>
  );
}

function SettingsFooter() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarFooter className={cn("border-t border-border/20", isCollapsed && "items-center")}>
      <button
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
  );
}
