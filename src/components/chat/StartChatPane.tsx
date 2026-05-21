import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconFolder,
  IconChevronDown,
  IconArrowUp,
  IconBrain,
} from "@tabler/icons-react";
import type { WorkspaceInfo, ModelInfo } from "../../../types/electron-api";

interface StartChatPaneProps {
  defaultWorkspacePath?: string | null;
  defaultModel?: string | null;
  onStart: (workspacePath: string, prompt: string, model?: string) => void;
}

export function StartChatPane({ defaultWorkspacePath, defaultModel, onStart }: StartChatPaneProps) {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceInfo[]>([]);
  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<string | null>(
    defaultWorkspacePath ?? null
  );
  const [selectedModel, setSelectedModel] = React.useState<string | null>(defaultModel ?? null);
  const [prompt, setPrompt] = React.useState("");
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = React.useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hasLoadedRef = React.useRef(false);

  // Load workspaces, models, and settings once on mount
  React.useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    window.electron.getWorkspaces().then((list) => {
      setWorkspaces(list);
      if (!selectedWorkspace && list.length > 0) {
        setSelectedWorkspace(list[0].path);
      }
    });

    window.electron.getModels().then((list) => {
      setModels(list);
    });

    window.electron.getDefaultModel().then((s) => {
      if (s && !selectedModel) {
        const fullId = s.defaultModel.includes('/') ? s.defaultModel : `${s.defaultProvider}/${s.defaultModel}`;
        setSelectedModel(fullId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync props when they change
  React.useEffect(() => {
    if (defaultWorkspacePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedWorkspace(defaultWorkspacePath);
    }
  }, [defaultWorkspacePath]);

  React.useEffect(() => {
    if (defaultModel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedModel(defaultModel);
    }
  }, [defaultModel]);

  const selectedWorkspaceName = React.useMemo(
    () => workspaces.find((w) => w.path === selectedWorkspace)?.displayName ?? "Select project",
    [workspaces, selectedWorkspace]
  );

  const selectedModelName = React.useMemo(() => {
    if (!selectedModel) return "Model";
    const m = models.find((mod) => mod.id === selectedModel);
    return m?.name ?? selectedModel.split('/').pop() ?? selectedModel;
  }, [models, selectedModel]);

  const canSubmit = selectedWorkspace && prompt.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart(selectedWorkspace, prompt.trim(), selectedModel ?? undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background overflow-y-auto px-6 py-8">
      <div className="flex flex-col items-center w-full max-w-xl gap-5">
        {/* Prompt card */}
        <div className="relative w-full rounded-2xl border border-border/60 bg-card/40 shadow-sm transition-all duration-300 focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_rgba(var(--primary),0.05)]">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to do?"
            rows={5}
            className="w-full bg-transparent px-5 pt-5 pb-16 text-[16px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 resize-none outline-none border-0"
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            {/* Left: project + model pills */}
            <div className="flex items-center gap-2">
              {/* Project pill */}
              <div className="relative">
                <button
                  onClick={() => {
                    setWorkspaceDropdownOpen((o) => !o);
                    setModelDropdownOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    workspaceDropdownOpen
                      ? "border-primary/40 bg-accent/40 text-foreground"
                      : "border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  )}
                >
                  <IconFolder className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[120px] truncate">{selectedWorkspaceName}</span>
                  <IconChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", workspaceDropdownOpen && "rotate-180")} />
                </button>

                {workspaceDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[200px] rounded-xl border border-border/50 bg-popover shadow-xl py-1 max-h-60 overflow-y-auto">
                    {workspaces.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No projects</div>
                    ) : (
                      workspaces.map((ws) => (
                        <button
                          key={ws.path}
                          onClick={() => {
                            setSelectedWorkspace(ws.path);
                            setWorkspaceDropdownOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors",
                            ws.path === selectedWorkspace
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <IconFolder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{ws.displayName}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Model pill */}
              <div className="relative">
                <button
                  onClick={() => {
                    setModelDropdownOpen((o) => !o);
                    setWorkspaceDropdownOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    modelDropdownOpen
                      ? "border-primary/40 bg-accent/40 text-foreground"
                      : "border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  )}
                >
                  <IconBrain className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[140px] truncate">{selectedModelName}</span>
                  <IconChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", modelDropdownOpen && "rotate-180")} />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[240px] rounded-xl border border-border/50 bg-popover shadow-xl py-1 max-h-60 overflow-y-auto">
                    {models.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No models found</div>
                    ) : (
                      models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelDropdownOpen(false);
                            window.electron.setDefaultModel(m.provider, m.id).catch(() => {});
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors",
                            m.id === selectedModel
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <IconBrain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium">{m.name}</span>
                            <span className="text-[10px] text-muted-foreground/60 truncate">{m.provider}</span>
                          </div>
                          {m.contextWindow && (
                            <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                              {m.contextWindow}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: send button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all",
                canSubmit
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <IconArrowUp className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[11px] text-muted-foreground/40">
          Press <kbd className="rounded border border-border/30 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send, <kbd className="rounded border border-border/30 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
