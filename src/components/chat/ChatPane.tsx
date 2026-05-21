import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface ChatPaneProps {
  sessionPath: string | null;
  workspacePath?: string | null;
}

export function ChatPane({ sessionPath, workspacePath }: ChatPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    fitAddon.fit();

    // Send initial size to main
    const { cols, rows } = terminal;
    window.electron.ptyResize(cols, rows).catch(console.error);

    // Receive PTY data
    const unsubData = window.electron.onPtyData((data) => {
      terminal.write(data);
    });

    // Send user keystrokes to PTY
    terminal.onData((data) => {
      window.electron.ptyInput(data).catch(console.error);
    });

    // Observe resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      window.electron.ptyResize(cols, rows).catch(console.error);
    });
    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      unsubData();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Spawn or switch PTY when session/workspace changes
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    if (sessionPath) {
      terminal.clear();
      window.electron.openSession(sessionPath).catch(console.error);
    } else if (workspacePath) {
      terminal.clear();
      window.electron.newSession(workspacePath).catch(console.error);
    }
  }, [sessionPath, workspacePath]);

  if (!sessionPath && !workspacePath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a workspace or session to start</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div ref={containerRef} className="flex-1 p-2 min-h-0" />
    </div>
  );
}
