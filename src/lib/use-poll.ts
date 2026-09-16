"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `task` on an interval, but only while the tab is actually visible.
 * A phone left on a background tab stops hammering the server, and coming
 * back to the tab refreshes immediately instead of waiting for the next tick.
 */
export function usePoll(task: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const saved = useRef(task);

  useEffect(() => {
    saved.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const run = () => {
      void saved.current();
    };

    const start = () => {
      if (timer) return;
      run();
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
