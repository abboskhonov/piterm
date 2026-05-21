import type { ElementType } from "react";

export interface SessionItem {
  id: string;
  title: string;
  updatedAt: string;
  tag?: string;
  messageCount?: number;
  active?: boolean;
}

export interface WorkspaceItem {
  id: string;
  path: string;
  displayName: string;
  sessionCount: number;
  sessions: SessionItem[];
}

export interface NavItem {
  id: string;
  title: string;
  icon: ElementType;
  badge?: number;
  active?: boolean;
  shortcut?: string;
}

export interface SidebarData {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  activeSessionId?: string;
  navItems: NavItem[];
}
