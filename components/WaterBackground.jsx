"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function WaterBackground() {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState("fallback");
  const [controlsHost, setControlsHost] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    setControlsHost(document.getElementById("homepage-background-controls"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const connection = navigator.connection;
    let disposed = false;
    let generation = 0;
    let pendingContext = null;

    function releaseContext(context) {
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      if (pendingContext === context) pendingContext = null;
    }

    function stop() {
      generation++;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      releaseContext(pendingContext);
    }

    function fallback() {
      stop();
      if (!disposed) setState("fallback");
    }

    async function start(ticket) {
      if (disposed || ticket !== generation) return;
      const canvas = document.createElement("canvas");
      let context;
      try {
        context = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      } catch {}
      if (!context) { fallback(); return; }
      pendingContext = context;
      setState("loading");
      try {
        const { createWaterBackground } = await import("@/lib/water-background");
        if (disposed || ticket !== generation) {
          releaseContext(context);
          return;
        }
        sceneRef.current = createWaterBackground(host, canvas, context, { onStateChange: setState, onFailure: fallback });
        pendingContext = null;
        sceneRef.current.setPaused(pausedRef.current || document.hidden);
      } catch {
        releaseContext(context);
        if (!disposed && ticket === generation) fallback();
      }
    }

    function syncPreferences() {
      stop();
      setState("fallback");
      const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;
      if (reducedMotion.matches || forcedColors.matches || connection?.saveData || lowMemory) {
        return;
      }
      const ticket = generation;
      start(ticket);
    }

    function visibilityChanged() {
      sceneRef.current?.setPaused(pausedRef.current || document.hidden);
    }

    reducedMotion.addEventListener("change", syncPreferences);
    forcedColors.addEventListener("change", syncPreferences);
    connection?.addEventListener?.("change", syncPreferences);
    document.addEventListener("visibilitychange", visibilityChanged);
    syncPreferences();
    return () => {
      disposed = true;
      stop();
      reducedMotion.removeEventListener("change", syncPreferences);
      forcedColors.removeEventListener("change", syncPreferences);
      connection?.removeEventListener?.("change", syncPreferences);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  function toggleMotion() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    sceneRef.current?.setPaused(next || document.hidden);
  }

  return <>
    <div ref={hostRef} className="home-water-background" aria-hidden="true" data-state={state} />
    {controlsHost && (state === "ready" || state === "paused") && createPortal(
      <button type="button" className="background-motion-toggle" aria-pressed={paused} onClick={toggleMotion}>
        {paused ? "Play background" : "Pause background"}
      </button>, controlsHost,
    )}
  </>;
}
