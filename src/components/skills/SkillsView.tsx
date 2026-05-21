import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconSearch,
  IconExternalLink,
  IconRefresh,
  IconLoader2,
  IconPlus,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import type { SkillInfo } from "../../../types/electron-api";

interface RemoteSkill {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
}

function formatInstalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface SkillsViewProps {
  workspacePath?: string | null;
}

export function SkillsView({ workspacePath }: SkillsViewProps) {
  const [installed, setInstalled] = React.useState<SkillInfo[]>([]);
  const [installedLoading, setInstalledLoading] = React.useState(true);
  const [installedQuery, setInstalledQuery] = React.useState("");

  const [remoteSkills, setRemoteSkills] = React.useState<RemoteSkill[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [exploreTab, setExploreTab] = React.useState<"trending" | "popular">("trending");
  const [exploreQuery, setExploreQuery] = React.useState("");

  // Install state
  const [installingId, setInstallingId] = React.useState<string | null>(null);
  const [showScopeFor, setShowScopeFor] = React.useState<string | null>(null);
  const [installResult, setInstallResult] = React.useState<
    Record<string, "success" | "error">
  >({});

  // Load installed skills
  const loadInstalled = React.useCallback(async () => {
    setInstalledLoading(true);
    try {
      const skills = await window.electron.getInstalledSkills();
      setInstalled(skills);
    } catch (err) {
      console.error("Failed to load installed skills:", err);
    } finally {
      setInstalledLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInstalled();
  }, [loadInstalled]);

  // Load remote skills (trending / search)
  const searchRemote = React.useCallback(async (query: string) => {
    setRemoteLoading(true);
    try {
      const data = await window.electron.searchSkills(query);
      setRemoteSkills(data.skills ?? []);
    } catch (err) {
      console.error("Failed to search skills:", err);
      setRemoteSkills([]);
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  // Initial load for trending
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    searchRemote("trending");
  }, [searchRemote]);

  // Re-search when explore query changes (with debounce)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      searchRemote(exploreQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [exploreQuery, searchRemote]);

  const handleInstall = React.useCallback(
    async (skill: RemoteSkill, global: boolean) => {
      const spec = `${skill.source}@${skill.skillId}`;
      setInstallingId(skill.id);
      setShowScopeFor(null);
      try {
        const result = await window.electron.installSkill(
          spec,
          global,
          global ? undefined : (workspacePath ?? undefined)
        );
        if (result.success) {
          setInstallResult((prev) => ({ ...prev, [skill.id]: "success" }));
          // Refresh installed list
          loadInstalled();
        } else {
          console.error("Install failed:", result.stderr);
          setInstallResult((prev) => ({ ...prev, [skill.id]: "error" }));
        }
      } catch (err) {
        console.error("Install error:", err);
        setInstallResult((prev) => ({ ...prev, [skill.id]: "error" }));
      } finally {
        setInstallingId(null);
      }
    },
    [workspacePath, loadInstalled]
  );

  const filteredInstalled = installed.filter((s) => {
    const q = installedQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  const displayedRemote = React.useMemo(() => {
    if (exploreTab === "popular") {
      return [...remoteSkills].sort((a, b) => b.installs - a.installs);
    }
    return remoteSkills;
  }, [remoteSkills, exploreTab]);

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage reusable skills for this project.
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <IconPlus className="h-4 w-4" />
            New
          </button>
        </div>

        {/* ── Installed skills ── */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-foreground">Installed</h2>
              <span className="text-xs text-muted-foreground">
                ~/.agents/skills
              </span>
            </div>
            <button
              onClick={loadInstalled}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Refresh"
            >
              <IconRefresh className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-4">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={installedQuery}
              onChange={(e) => setInstalledQuery(e.target.value)}
              placeholder="Search repository skills..."
              className="pl-9 bg-background/50"
            />
          </div>

          {installedLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Loading installed skills...
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {installedQuery ? "No matching skills found" : "No skills installed yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Install skills from the explore section below
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInstalled.map((skill) => (
                <div
                  key={skill.path}
                  className="group flex flex-col gap-1 rounded-lg border border-border/40 bg-card/50 p-4 hover:border-border/80 hover:bg-card transition-colors"
                >
                  <span className="font-medium text-sm text-foreground">
                    {skill.name}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {skill.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Explore / Add to project ── */}
        <section>
          <h2 className="text-sm font-medium text-foreground mb-4">Add to project</h2>

          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
              <button
                onClick={() => setExploreTab("trending")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
                  exploreTab === "trending"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Trending
              </button>
              <button
                onClick={() => setExploreTab("popular")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
                  exploreTab === "popular"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Popular
              </button>
            </div>

            <div className="relative flex-1 max-w-xs">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={exploreQuery}
                onChange={(e) => setExploreQuery(e.target.value)}
                placeholder="Search skills..."
                className="pl-9 bg-background/50"
              />
            </div>
          </div>

          {remoteLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Searching skills.sh...
            </div>
          ) : displayedRemote.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {exploreQuery ? `No results for "${exploreQuery}"` : "No skills found"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedRemote.map((skill) => {
                const isInstalling = installingId === skill.id;
                const result = installResult[skill.id];
                const showScope = showScopeFor === skill.id;

                return (
                  <div
                    key={skill.id}
                    className="group flex flex-col gap-2 rounded-lg border border-border/40 bg-card/50 p-4 hover:border-border/80 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {skill.name}
                      </span>
                      {isInstalling ? (
                        <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-0.5" />
                      ) : result === "success" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                          <IconCheck className="h-3.5 w-3.5" />
                          Installed
                        </span>
                      ) : result === "error" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500 shrink-0">
                          <IconX className="h-3.5 w-3.5" />
                          Failed
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowScopeFor(skill.id)}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
                        >
                          Install
                        </button>
                      )}
                    </div>

                    {showScope && !isInstalling && !result && (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleInstall(skill, true)}
                          className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          Global
                        </button>
                        <button
                          onClick={() => handleInstall(skill, false)}
                          disabled={!workspacePath}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium transition-colors",
                            workspacePath
                              ? "bg-accent text-accent-foreground hover:bg-accent/80"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                          title={workspacePath ? undefined : "Select a workspace first"}
                        >
                          Project
                        </button>
                        <button
                          onClick={() => setShowScopeFor(null)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {skill.source}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="text-xs text-muted-foreground/70">
                        {formatInstalls(skill.installs)} installs
                      </span>
                      <a
                        href={`https://skills.sh/${skill.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electron.openExternal(`https://skills.sh/${skill.id}`);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        View
                        <IconExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
