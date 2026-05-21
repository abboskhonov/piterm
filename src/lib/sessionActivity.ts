import * as React from "react";

const STREAMING_TIMEOUT_MS = 60_000;

type SessionActivity = {
  isStreaming: boolean;
  hasNewContent: boolean;
  lastTokenAt: number;
};

const store = new Map<string, SessionActivity>();
const listeners = new Map<string, Set<() => void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notify(sessionPath: string) {
  listeners.get(sessionPath)?.forEach((cb) => cb());
}

function clearTimer(sessionPath: string) {
  const t = timers.get(sessionPath);
  if (t) {
    clearTimeout(t);
    timers.delete(sessionPath);
  }
}

function startTimer(sessionPath: string) {
  clearTimer(sessionPath);
  timers.set(
    sessionPath,
    setTimeout(() => {
      const current = store.get(sessionPath);
      if (current?.isStreaming) {
        store.set(sessionPath, {
          ...current,
          isStreaming: false,
          hasNewContent: true,
        });
        notify(sessionPath);
      }
      timers.delete(sessionPath);
    }, STREAMING_TIMEOUT_MS)
  );
}

/**
 * Called on every streaming token. Mutates lastTokenAt in-place —
 * this value is not displayed so it doesn't need to trigger React renders.
 * The timeout timer is reset so the safety cutoff doesn't fire mid-stream.
 */
export function touchSessionToken(sessionPath: string) {
  const current = store.get(sessionPath);
  if (!current) return;

  current.lastTokenAt = Date.now();

  if (current.isStreaming) {
    startTimer(sessionPath);
  }
}

/**
 * Set streaming state for a session. Creates a new object so React's
 * Object.is comparison detects the change and re-renders subscribed components.
 */
export function setSessionStreaming(sessionPath: string, streaming: boolean) {
  const prev = store.get(sessionPath);
  if (prev && prev.isStreaming === streaming) return;

  const current: SessionActivity = prev
    ? { ...prev, isStreaming: streaming }
    : { isStreaming: streaming, hasNewContent: false, lastTokenAt: Date.now() };

  if (!streaming) {
    current.hasNewContent = true;
    clearTimer(sessionPath);
  } else {
    current.lastTokenAt = Date.now();
    startTimer(sessionPath);
  }

  store.set(sessionPath, current);
  notify(sessionPath);
}

/**
 * Clear the "new content" dot when the user opens this session.
 * Only creates a new object (and triggers a render) if the dot was visible.
 */
export function markSessionViewed(sessionPath: string) {
  const prev = store.get(sessionPath);
  if (!prev || !prev.hasNewContent) return;

  store.set(sessionPath, { ...prev, hasNewContent: false });
  notify(sessionPath);
}

export function getSessionActivity(sessionPath: string): SessionActivity {
  return (
    store.get(sessionPath) || {
      isStreaming: false,
      hasNewContent: false,
      lastTokenAt: 0,
    }
  );
}

export function useSessionActivity(sessionPath: string): SessionActivity {
  const [activity, setActivity] = React.useState<SessionActivity>(() =>
    getSessionActivity(sessionPath)
  );

  React.useEffect(() => {
    const update = () => setActivity(getSessionActivity(sessionPath));
    const set = listeners.get(sessionPath) || new Set();
    set.add(update);
    listeners.set(sessionPath, set);
    return () => {
      set.delete(update);
    };
  }, [sessionPath]);

  return activity;
}
