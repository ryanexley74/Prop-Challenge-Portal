import { useEffect, useRef, useState } from "react";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

interface ResolvedProp {
  id: number;
  question: string;
  type: string;
  result?: boolean | null;
}

function resultText(type: string, result: boolean) {
  if (type === "yes_no") return result ? "YES ✅" : "NO ❌";
  return result ? "OVER ✅" : "UNDER ❌";
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission as NotifPermission;
  });

  const request = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
  };

  return { permission, request };
}

export function usePropNotifications(
  props: ResolvedProp[],
  gameName: string,
  enabled: boolean
) {
  const seenIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const resolvedProps = props.filter(
    (p) => p.result !== null && p.result !== undefined
  ) as (ResolvedProp & { result: boolean })[];

  useEffect(() => {
    if (!enabled || !("Notification" in window) || Notification.permission !== "granted") return;
    if (resolvedProps.length === 0) return;

    if (!initializedRef.current) {
      // Seed the set on first load without firing any notifications
      resolvedProps.forEach((p) => seenIdsRef.current.add(p.id));
      initializedRef.current = true;
      return;
    }

    // Fire a notification for each newly resolved prop
    resolvedProps.forEach((p) => {
      if (seenIdsRef.current.has(p.id)) return;
      seenIdsRef.current.add(p.id);

      new Notification(`🏈 Prop Resolved — ${gameName}`, {
        body: `${p.question}\n→ ${resultText(p.type, p.result)}`,
        icon: "/favicon.ico",
        tag: `prop-${p.id}`,
        requireInteraction: false,
      });
    });
  }, [resolvedProps, enabled, gameName]);
}
