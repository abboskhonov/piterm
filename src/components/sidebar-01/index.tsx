import * as React from "react";
import { cn } from "@/lib/utils";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar-01/app-sidebar";
import { ChatPane } from "@/components/chat/ChatPane";
import { SkillsView } from "@/components/skills/SkillsView";
import { ExtensionsView } from "@/components/extensions/ExtensionsView";
import { TitleBar } from "@/components/TitleBar";

interface ActivePtyInfo {
  key: string;
  sessionPath: string | null;
  workspacePath: string;
  model?: string;
}

export default function Sidebar01() {
  const [activeSessionPath, setActiveSessionPath] = React.useState<string | null>(null);
  const [activeWorkspacePath, setActiveWorkspacePath] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<'chat' | 'skills' | 'extensions'>('chat');
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null);
  const [activePtys, setActivePtys] = React.useState<ActivePtyInfo[]>([]);
  const [visiblePtyKey, setVisiblePtyKey] = React.useState<string | null>(null);

  const handleNewSession = () => {
    setActiveSessionPath(null);
    setPendingPrompt(null);
    setVisiblePtyKey(null);
    setActiveView('chat');
  };

  const handleNewSessionForWorkspace = (workspacePath: string) => {
    setActiveWorkspacePath(workspacePath);
    setActiveSessionPath(null);
    setPendingPrompt(null);
    setVisiblePtyKey(null);
    setActiveView('chat');
  };

  const handleRemoveWorkspace = (workspacePath: string) => {
    window.electron.removeWorkspace(workspacePath).catch(console.error);
    // Clean up any active PTYs for this workspace
    setActivePtys((prev) => {
      const remaining = prev.filter((p) => p.workspacePath !== workspacePath);
      // If visible PTY was removed, clear it
      const removed = prev.filter((p) => p.workspacePath === workspacePath);
      if (removed.some((p) => p.key === visiblePtyKey)) {
        setVisiblePtyKey(null);
      }
      // Kill PTYs on main side
      for (const p of removed) {
        window.electron.ptyKill(p.key).catch(() => {});
      }
      return remaining;
    });
    // Clear active workspace/session if they belonged to removed workspace
    if (activeWorkspacePath === workspacePath) {
      setActiveWorkspacePath(null);
      setActiveSessionPath(null);
      setVisiblePtyKey(null);
    }
  };

  const handleStartSession = (workspacePath: string, prompt: string, model?: string) => {
    const key = `new:${workspacePath}:${Date.now()}`;
    setActiveWorkspacePath(workspacePath);
    setPendingPrompt(prompt);
    setActivePtys((prev) => [...prev, { key, sessionPath: null, workspacePath, model }]);
    setVisiblePtyKey(key);
  };

  const handleSelectSession = (path: string, workspacePath?: string) => {
    setActiveSessionPath(path);
    setPendingPrompt(null);
    setActiveView('chat');

    const ws = workspacePath ?? activePtys.find((p) => p.sessionPath === path)?.workspacePath ?? activeWorkspacePath;
    if (!ws) return;

    if (!activePtys.find((p) => p.key === path)) {
      setActivePtys((prev) => [...prev, { key: path, sessionPath: path, workspacePath: ws }]);
    }
    setVisiblePtyKey(path);
  };

  const handlePtyExit = (key: string) => {
    setActivePtys((prev) => prev.filter((p) => p.key !== key));
    if (visiblePtyKey === key) {
      setVisiblePtyKey(null);
    }
  };

  // Ctrl+Tab / Ctrl+Shift+Tab to cycle active terminal tabs
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key !== "Tab") return;
      e.preventDefault();
      if (activePtys.length === 0) return;
      const currentIndex = activePtys.findIndex((p) => p.key === visiblePtyKey);
      const direction = e.shiftKey ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + activePtys.length) % activePtys.length;
      const next = activePtys[nextIndex];
      setVisiblePtyKey(next.key);
      setActiveSessionPath(next.sessionPath);
      setActiveView('chat');
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePtys, visiblePtyKey]);

  return (
    <SidebarProvider>
      <TitleBar />
      <AppSidebar
        activeSessionPath={activeSessionPath}
        activeView={activeView}
        activePtyKeys={activePtys.map((p) => p.key)}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onNewSessionForWorkspace={handleNewSessionForWorkspace}
        onRemoveWorkspace={handleRemoveWorkspace}
        onWorkspaceChange={(path) => setActiveWorkspacePath(path)}
        onNavigate={(view) => setActiveView(view as 'chat' | 'skills' | 'extensions')}
      />
      <SidebarInset className="flex flex-col bg-background overflow-hidden pt-10">
        <div className={cn(
          "flex shrink-0 items-center gap-3 px-4",
          activeView !== 'chat' ? "h-11 border-b border-border/40" : "h-11 border-b border-border/40 sm:hidden"
        )}>
          <SidebarTrigger className="sm:hidden" />
          {activeView !== 'chat' && (
            <button
              onClick={() => setActiveView('chat')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {activeView === 'chat' ? (
            <ChatPane
              activePtys={activePtys}
              visiblePtyKey={visiblePtyKey}
              workspacePath={activeWorkspacePath}
              initialPrompt={pendingPrompt ?? undefined}
              onStartSession={handleStartSession}
              onPtyExit={handlePtyExit}
            />
          ) : activeView === 'skills' ? (
            <SkillsView workspacePath={activeWorkspacePath} />
          ) : (
            <ExtensionsView />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
