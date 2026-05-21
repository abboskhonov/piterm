import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { IconChevronRight } from "@tabler/icons-react";
import "@xterm/xterm/css/xterm.css";
import type { WorkspaceInfo, SessionListItem } from "../../../types/electron-api";

interface TerminalPaneProps {
  ptyKey: string;
  sessionPath: string | null;
  workspacePath: string | null;
  initialPrompt?: string;
  model?: string;
  onPtyExit?: (key: string) => void;
}

export function TerminalPane({ ptyKey, sessionPath, workspacePath, initialPrompt, model, onPtyExit }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOpenedRef = useRef<string | null>(null);
  const onPtyExitRef = useRef(onPtyExit);
  useEffect(() => {
    onPtyExitRef.current = onPtyExit;
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("");

  // Initialize xterm once
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: '"Geist Mono", "Menlo", monospace',
      fontSize: 13,
      cursorBlink: true,
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
    terminal.open(containerRef.current);

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

    // Receive PTY data
    const unsubData = window.electron.onPtyData(ptyKey, (data) => {
      terminal.write(data);
    });

    // PTY exit / crash
    const unsubExit = window.electron.onPtyExit(ptyKey, (exitCode) => {
      setPtyExited(true);
      onPtyExitRef.current?.(ptyKey);
      if (exitCode !== 0 && exitCode !== null) {
        setError(`pi exited with code ${exitCode}. Make sure "pi" is installed and works.`);
      }
    });

    // Send user keystrokes to PTY
    terminal.onData((data) => {
      window.electron.ptyInput(ptyKey, data).catch(console.error);
    });

    // Observe resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || entry.contentRect.width === 0 || entry.contentRect.height === 0) return;
      try {
        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          window.electron.ptyResize(ptyKey, cols, rows).catch(console.error);
        }
      } catch {
        // ignore
      }
    });
    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      clearTimeout(fitTimer);
      unsubData();
      unsubExit();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      // NOTE: do NOT kill PTY here — we want sessions to stay alive in background
    };
  }, [ptyKey]);

  // Resolve workspace name + session title when deps change
  useEffect(() => {
    if (!workspacePath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspaceName("");
      setSessionTitle("");
      return;
    }

    window.electron.getWorkspaces().then((workspaces: WorkspaceInfo[]) => {
      const ws = workspaces.find((w) => w.path === workspacePath);
      if (ws) setWorkspaceName(ws.displayName);
    });

    window.electron.getSessions(workspacePath).then((sessions: SessionListItem[]) => {
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

    // Skip if already opened this key
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
      window.electron.newSession(ptyKey, workspacePath, initialPrompt, model).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
  }, [ptyKey, sessionPath, workspacePath, initialPrompt, model]);

  // initialPrompt is passed as a CLI arg to pi via newSession above.
  // No need to type it into the PTY — pi receives it directly on spawn.

  return (
    <div className="flex h-full flex-col bg-background">
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
    </div>
  );
}
