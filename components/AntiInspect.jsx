"use client";

import { useEffect } from "react";
import { isAntiInspectActive } from "@/lib/anti-inspect";

export default function AntiInspect() {
  useEffect(() => {
    if (!isAntiInspectActive()) {
      return;
    }

    function handleContextMenu(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) {
        return;
      }
      event.preventDefault();
    }

    function handleKeyDown(event) {
      if (event.key === "F12") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (cmdOrCtrl && event.shiftKey) {
        const key = event.key?.toLowerCase();
        if (key === "i" || key === "j" || key === "c") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (cmdOrCtrl && !event.shiftKey && !event.altKey) {
        const key = event.key?.toLowerCase();
        if (key === "u" || key === "s") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }

    function handleDragStart(event) {
      if (event.target?.tagName?.toLowerCase() === "img") {
        event.preventDefault();
      }
    }

    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
    };
  }, []);

  return null;
}
