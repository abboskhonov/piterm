import { TerminalPane } from "./TerminalPane";
import { StartChatPane } from "./StartChatPane";

interface ActivePtyInfo {
  key: string;
  sessionPath: string | null;
  workspacePath: string;
  model?: string;
}

interface ChatPaneProps {
  activePtys: ActivePtyInfo[];
  visiblePtyKey: string | null;
  workspacePath?: string | null;
  initialPrompt?: string;
  onStartSession?: (workspacePath: string, prompt: string, model?: string) => void;
  onPtyExit?: (key: string) => void;
}

export function ChatPane({
  activePtys,
  visiblePtyKey,
  workspacePath,
  initialPrompt,
  onStartSession,
  onPtyExit,
}: ChatPaneProps) {
  // Show start page if no visible PTY
  if (!visiblePtyKey) {
    return (
      <StartChatPane
        defaultWorkspacePath={workspacePath}
        onStart={(ws, prompt, model) => {
          onStartSession?.(ws, prompt, model);
        }}
      />
    );
  }

  return (
    <div className="relative h-full">
      {activePtys.map((pty) => (
        <div
          key={pty.key}
          className={pty.key === visiblePtyKey ? "absolute inset-0" : "hidden"}
        >
          <TerminalPane
            ptyKey={pty.key}
            sessionPath={pty.sessionPath}
            workspacePath={pty.workspacePath}
            isVisible={pty.key === visiblePtyKey}
            initialPrompt={pty.key === visiblePtyKey ? initialPrompt : undefined}
            model={pty.model}
            onPtyExit={onPtyExit}
          />
        </div>
      ))}
    </div>
  );
}
