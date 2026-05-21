import * as React from "react";
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

export default function Sidebar01() {
  const [activeSessionPath, setActiveSessionPath] = React.useState<string | null>(null);
  const [activeWorkspacePath, setActiveWorkspacePath] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<'chat' | 'skills' | 'extensions'>('chat');

  return (
    <SidebarProvider>
      <TitleBar />
      <AppSidebar
        activeSessionPath={activeSessionPath}
        activeView={activeView}
        onSelectSession={(path) => {
          setActiveSessionPath(path);
          setActiveView('chat');
        }}
        onNewSession={() => {
          setActiveSessionPath(null);
          setActiveView('chat');
        }}
        onWorkspaceChange={(path) => setActiveWorkspacePath(path)}
        onNavigate={(view) => setActiveView(view as 'chat' | 'skills' | 'extensions')}
      />
      <SidebarInset className="flex flex-col bg-background overflow-hidden pt-10">
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border/40 px-4">
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
              sessionPath={activeSessionPath}
              workspacePath={activeWorkspacePath}
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
