"use client";

import { useEffect, useRef } from "react";
import type { Alert } from "@/lib/types";

type MonitorStateDetail = { alerts?: Alert[] };

function alertSignature(alerts: Alert[]) {
  return alerts
    .map((alert) => `${alert.id}:${alert.severity}:${alert.title}:${alert.detail}:${alert.module}`)
    .sort()
    .join("|");
}

/**
 * Reconciles time-derived DOC Monitor alert changes with the native DOC.OS shell.
 *
 * RealtimeMonitor already emits `doctype:records-changed` when persisted records
 * change. This bridge covers the other important case: an alert can change only
 * because time advanced (renewal milestone, overdue deadline, etc.) while the
 * underlying record id/updatedAt stays identical.
 *
 * The event deliberately uses source="monitor" so RealtimeMonitor ignores the
 * reconciliation event and no refresh loop is created. DoctypeOS still consumes
 * `doctype:records-changed` and refreshes its authorized StatePayload, keeping the
 * menu counter, native attention card and alert list synchronized with the Guardião.
 */
export function MonitorStateBridge({ initialAlerts }: { initialAlerts: Alert[] }) {
  const signatureRef = useRef(alertSignature(initialAlerts));

  useEffect(() => {
    const onMonitorState = (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail) return;
      const detail = event.detail as MonitorStateDetail;
      if (!Array.isArray(detail.alerts)) return;

      const nextSignature = alertSignature(detail.alerts);
      if (nextSignature === signatureRef.current) return;
      signatureRef.current = nextSignature;

      window.dispatchEvent(new CustomEvent("doctype:records-changed", {
        detail: { source: "monitor", reason: "alerts-changed" },
      }));
    };

    window.addEventListener("doctype:monitor-state", onMonitorState);
    return () => window.removeEventListener("doctype:monitor-state", onMonitorState);
  }, []);

  return null;
}
