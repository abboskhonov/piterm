import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  IconChevronRight,
  IconSearch,
  IconX,
  IconCopy,
  IconClipboard,
  IconTrash,
  IconSelect,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import "@xterm/xterm/css/xterm.css";
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

interface TerminalPaneProps {
  ptyKey: string;
  sessionPath: string | null;
  workspacePath: string | null;
  isVisible?: boolean;
  initialPrompt?: string;
  model?: string;
  onPtyExit?: (key: string) => void;
}

export function TerminalPane({
  ptyKey,
  sessionPath,
  workspacePath,
  isVisible,
  initialPrompt,
  model,
  onPtyExit,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOpenedRef = useRef<string | null>(null);
  const onPtyExitRef = useRef(onPtyExit);
  const isVisibleRef = useRef(isVisible);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string>("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    show: boolean;
  }>({ x: 0, y: 0, show: false });

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState(0);
  const [searchCurrent, setSearchCurrent] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onPtyExitRef.current = onPtyExit;
  });

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // ─── Initialize xterm once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: '"Geist Mono", "Menlo", monospace',
      fontSize: 13,
      cursorBlink: true,
      bellStyle: "visual",
      theme: {
        background: "#00000000",
        foreground: "#e4e4e7",
        cursor: "#a1a1aa",
        selectionBackground: "#3f3f46",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#d946ef",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#e879f9",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Web links: Ctrl/Cmd+click to open URLs externally
    const webLinksAddon = new WebLinksAddon(
      (event, uri) => {
        if (event.ctrlKey || event.metaKey) {
          window.electron.openExternal(uri).catch(console.error);
        }
      },
      {},
      true
    );
    terminal.loadAddon(webLinksAddon);

    // File paths: Ctrl/Cmd+click to open with default app
    const wsPath = workspacePath ?? "";
    terminal.registerLinkProvider({
      provideLinks(y, callback) {
        const line = terminal.buffer.active.getLine(y);
        if (!line) {
          callback(undefined);
          return;
        }
        const text = line.translateToString(true);
        const regex = /\/[\w.-]+(?:\/[\w.-]+)*\/?/g;
        const links: Array<{
          text: string;
          range: {
            start: { x: number; y: number };
            end: { x: number; y: number };
          };
          activate: (event: MouseEvent, text: string) => void;
        }> = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const path = match[0];
          const prefix = text.slice(
            Math.max(0, match.index - 3),
            match.index
          );
          if (prefix.includes(":/")) continue;
          const startX = match.index;
          const endX = match.index + path.length;
          links.push({
            text: path,
            range: {
              start: { x: startX, y },
              end: { x: endX, y },
            },
            activate(event, text) {
              if (!event.ctrlKey && !event.metaKey) return;
              const fullPath = text.startsWith("/")
                ? text
                : wsPath
                  ? `${wsPath.replace(/\/$/, "")}/${text}`
                  : text;
              window.electron.openPath(fullPath).catch(console.error);
            },
          });
        }
        callback(links);
      },
    });

    terminal.open(containerRef.current);

    // Custom key handler for copy/paste/find
    terminal.attachCustomKeyEventHandler((e) => {
      // Cmd/Ctrl+C: copy if selection exists, otherwise let xterm send to PTY
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "c" &&
        !e.shiftKey
      ) {
        if (terminal.hasSelection()) {
          return false; // let browser handle copy
        }
        return true; // xterm handles Ctrl+C (SIGINT)
      }
      // Cmd/Ctrl+V or Ctrl+Shift+V: paste
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        navigator.clipboard
          .readText()
          .then((text) => {
            window.electron.ptyInput(ptyKey, text).catch(console.error);
          })
          .catch(() => {});
        return false;
      }
      // Ctrl+F / Cmd+F: open find
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return false;
      }
      // Ctrl+Backspace: delete word backward (send Ctrl+W)
      if (e.key === "Backspace" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        window.electron.ptyInput(ptyKey, "\x17").catch(console.error);
        return false;
      }
      // Alt+Backspace: delete word backward (send ESC DEL)
      if (e.key === "Backspace" && e.altKey && !e.shiftKey) {
        e.preventDefault();
        window.electron.ptyInput(ptyKey, "\x1b\x7f").catch(console.error);
        return false;
      }
      // Ctrl+Left / Ctrl+Right: word navigation
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          window.electron.ptyInput(ptyKey, "\x1bb").catch(console.error); // ESC b
          return false;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          window.electron.ptyInput(ptyKey, "\x1bf").catch(console.error); // ESC f
          return false;
        }
      }
      return true;
    });

    // Visual bell
    terminal.onBell(() => {
      containerRef.current?.animate(
        [
          { boxShadow: "inset 0 0 0 0 rgba(239,68,68,0)" },
          { boxShadow: "inset 0 0 0 2px rgba(239,68,68,0.3)" },
          { boxShadow: "inset 0 0 0 0 rgba(239,68,68,0)" },
        ],
        { duration: 300 }
      );
    });

    // Defer first fit until DOM layout has settled
    const fitTimer = setTimeout(() => {
      if (terminalRef.current !== terminal) return;
      try {
        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          window.electron.ptyResize(ptyKey, cols, rows).catch(console.error);
        }
      } catch {
        // ignore fit errors on unmounted terminal
      }
      setReady(true);
    }, 200);

    // Receive PTY data — ALWAYS write to terminal buffer, never drop.
    // xterm.js handles hidden rendering internally; the buffer must stay
    // up to date so content isn't lost when switching tabs.
    const unsubData = window.electron.onPtyData(ptyKey, (data) => {
      terminal.write(data);
    });

    // PTY exit / crash
    const unsubExit = window.electron.onPtyExit(ptyKey, (exitCode) => {
      setPtyExited(true);
      onPtyExitRef.current?.(ptyKey);
      if (exitCode !== 0 && exitCode !== null) {
        setError(
          `pi exited with code ${exitCode}. Make sure "pi" is installed and works.`
        );
      }
    });

    // Send user keystrokes to PTY
    terminal.onData((data) => {
      window.electron.ptyInput(ptyKey, data).catch(console.error);
    });

    // Observe resize
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!isVisibleRef.current) return;
      const entry = entries[0];
      if (
        !entry ||
        entry.contentRect.width === 0 ||
        entry.contentRect.height === 0
      )
        return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddon.fit();
          const { cols, rows } = terminal;
          if (cols > 0 && rows > 0) {
            window.electron
              .ptyResize(ptyKey, cols, rows)
              .catch(console.error);
          }
        } catch {
          // ignore
        }
      }, 150);
    });
    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      clearTimeout(fitTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      unsubData();
      unsubExit();
      resizeObserver.disconnect();
      webLinksAddon.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [ptyKey]);

  const workspaceName = useMemo(() => {
    if (!workspacePath) return "";
    return workspacePath.split(/[\\/]/).pop() || "Project";
  }, [workspacePath]);

  // Resolve session title when deps change
  useEffect(() => {
    if (!workspacePath) {
      setSessionTitle("");
      return;
    }
    window.electron
      .getSessions(workspacePath)
      .then((sessions: SessionListItem[]) => {
        if (sessionPath) {
          const s = sessions.find((x) => x.path === sessionPath);
          setSessionTitle(s?.title || "Untitled");
        } else {
          setSessionTitle("New session");
        }
      });
  }, [workspacePath, sessionPath]);

  // Spawn or switch PTY when ptyKey changes
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    if (lastOpenedRef.current === ptyKey) return;
    lastOpenedRef.current = ptyKey;

    setError(null);
    setPtyExited(false);
    terminal.clear();

    if (sessionPath) {
      window.electron.openSession(sessionPath).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    } else if (workspacePath) {
      window.electron
        .newSession(ptyKey, workspacePath, initialPrompt, model)
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
    }
  }, [ptyKey, sessionPath, workspacePath, initialPrompt, model]);

  // When this pane becomes visible again (tab switch), refresh xterm to repaint
  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || !isVisible) return;

    let rafId = 0;
    const timer = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          const { cols, rows } = terminal;
          if (cols > 0 && rows > 0) {
            window.electron.ptyResize(ptyKey, cols, rows).catch(console.error);
          }
          terminal.refresh(0, rows - 1);
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            terminal.refresh(0, terminal.rows - 1);
          } catch {
            // ignore
          }
        }, 100);
      });
    }, 30);

    // Focus terminal when visible
    terminal.focus();

    return () => {
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isVisible, ptyKey]);

  // Document-level paste for files/images (xterm.js textarea won't bubble)
  useEffect(() => {
    if (!isVisible) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) {
        e.preventDefault();
        try {
          const paths = files.map((f) => window.electron.getPathForFile(f));
          const text = paths.map((p) => `"${p}"`).join(" ");
          window.electron.ptyInput(ptyKey, text);
          terminalRef.current?.focus();
        } catch (err) {
          console.error("Paste error:", err);
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isVisible, ptyKey]);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu.show) return;
    const handleClick = () =>
      setContextMenu((prev) => ({ ...prev, show: false }));
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu.show]);

  // Close search on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        terminalRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // ─── Drag & Drop ────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      try {
        const paths = files.map((f) => window.electron.getPathForFile(f));
        const text = paths.map((p) => `"${p}"`).join(" ");
        window.electron.ptyInput(ptyKey, text);
        terminalRef.current?.focus();
      } catch (err) {
        console.error("Drop error:", err);
      }
    },
    [ptyKey]
  );

  // ─── Context Menu ─────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, show: true });
  }, []);

  const handleCopy = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal || !terminal.hasSelection()) return;
    const text = terminal.getSelection();
    navigator.clipboard.writeText(text).catch(() => {});
    terminal.clearSelection();
    setContextMenu((prev) => ({ ...prev, show: false }));
  }, []);

  const handlePasteMenu = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      window.electron.ptyInput(ptyKey, text).catch(console.error);
      terminalRef.current?.focus();
    } catch {}
    setContextMenu((prev) => ({ ...prev, show: false }));
  }, [ptyKey]);

  const handleSelectAll = useCallback(() => {
    terminalRef.current?.selectAll();
    setContextMenu((prev) => ({ ...prev, show: false }));
  }, []);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    setContextMenu((prev) => ({ ...prev, show: false }));
  }, []);

  // ─── Search ───────────────────────────────────────────────────────────
  const performSearch = useCallback(
    (direction: "next" | "prev") => {
      const terminal = terminalRef.current;
      if (!terminal || !searchQuery.trim()) {
        setSearchMatches(0);
        setSearchCurrent(0);
        terminal?.clearSelection();
        return;
      }

      const buffer = terminal.buffer.active;
      const q = searchQuery.trim();
      const regex = new RegExp(
        q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      );
      const matches: { row: number; col: number; length: number }[] = [];

      for (let y = 0; y < buffer.length; y++) {
        const line = buffer.getLine(y);
        if (!line) continue;
        const text = line.translateToString(true);
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          matches.push({ row: y, col: m.index, length: m[0].length });
          if (m.index === regex.lastIndex) regex.lastIndex++;
        }
      }

      setSearchMatches(matches.length);

      if (matches.length === 0) {
        terminal.clearSelection();
        setSearchCurrent(0);
        return;
      }

      const rawCurrent =
        direction === "next"
          ? (searchCurrent % matches.length) + 1
          : ((searchCurrent - 2 + matches.length) % matches.length) + 1;
      const idx = Math.max(1, Math.min(rawCurrent, matches.length));
      const match = matches[idx - 1];

      terminal.select(match.col, match.row, match.length);
      terminal.scrollLines(match.row - buffer.viewportY);
      setSearchCurrent(idx);
    },
    [searchQuery, searchCurrent]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performSearch("next");
      }
    },
    [performSearch]
  );

  return (
    <div
      className="flex h-full flex-col bg-background"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      {/* Terminal header */}
      {workspacePath && (
        <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/40 px-4">
          <span className="text-xs font-medium text-foreground truncate">
            {workspaceName || "Project"}
          </span>
          {sessionTitle && (
            <>
              <IconChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground truncate">
                {sessionTitle}
              </span>
            </>
          )}
        </div>
      )}

      {/* Find bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5">
          <IconSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchCurrent(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find in terminal..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {searchMatches > 0 ? `${searchCurrent}/${searchMatches}` : "0/0"}
          </span>
          <button
            onClick={() => performSearch("prev")}
            disabled={searchMatches === 0}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
            title="Previous match"
          >
            <IconChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => performSearch("next")}
            disabled={searchMatches === 0}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
            title="Next match"
          >
            <IconChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setSearchOpen(false);
              terminalRef.current?.clearSelection();
              terminalRef.current?.focus();
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="shrink-0 bg-destructive/10 text-destructive text-xs px-3 py-2 text-center">
          {error}
        </div>
      )}
      {ptyExited && !error && (
        <div className="shrink-0 bg-muted/50 text-muted-foreground text-xs px-3 py-2 text-center">
          Session ended. Start a new chat to continue.
        </div>
      )}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="absolute inset-0 p-2" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse mr-2" />
            Starting terminal…
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu.show && (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg border border-border/50 bg-popover shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCopy}
            disabled={!terminalRef.current?.hasSelection()}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-40 hover:bg-accent"
          >
            <IconCopy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={handlePasteMenu}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-accent"
          >
            <IconClipboard className="h-3.5 w-3.5" /> Paste
          </button>
          <button
            onClick={handleSelectAll}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-accent"
          >
            <IconSelect className="h-3.5 w-3.5" /> Select All
          </button>
          <div className="my-1 border-t border-border/30" />
          <button
            onClick={handleClear}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-accent text-muted-foreground"
          >
            <IconTrash className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
