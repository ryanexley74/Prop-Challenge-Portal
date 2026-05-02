import { useEffect, useState } from "react";

interface SyncCountdownRingProps {
  lastSheetSync: string | null;
  syncInterval: number | null;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  dark?: boolean;
}

function getRingColor(ratio: number): string {
  // ratio = remaining / total (1 = just synced, 0 = due now)
  if (ratio > 0.6) return "#22c55e";   // green
  if (ratio > 0.35) return "#eab308";  // yellow
  if (ratio > 0.15) return "#f97316";  // orange
  return "#ef4444";                    // red
}

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000));
  if (totalSecs === 0) return "NOW";
  if (totalSecs > 60) {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return String(totalSecs);
}

export function SyncCountdownRing({
  lastSheetSync,
  syncInterval,
  size = 100,
  strokeWidth = 8,
  showLabel = true,
  dark = false,
}: SyncCountdownRingProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const intervalMs = (syncInterval ?? 5) * 60 * 1000;
  const lastSyncMs = lastSheetSync ? new Date(lastSheetSync).getTime() : 0;
  const nextSyncMs = lastSyncMs + intervalMs;
  const remaining = Math.max(0, nextSyncMs - now);
  const elapsed = intervalMs - remaining;

  // progress 0→1 as the interval elapses (ring fills clockwise)
  const progress = Math.min(1, elapsed / intervalMs);
  const ratio = remaining / intervalMs; // 1 = full time, 0 = due
  const color = getRingColor(ratio);
  const isUrgent = ratio < 0.15;

  const cx = size / 2;
  const cy = size / 2;
  const radius = cx - strokeWidth - 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const timeDisplay = formatTime(remaining);
  const fontSize = size * (timeDisplay === "NOW" ? 0.18 : timeDisplay.length > 4 ? 0.2 : 0.25);

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: size,
        height: size,
        animation: isUrgent ? "syncPulse 0.8s ease-in-out infinite alternate" : "none",
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", display: "block" }}
      >
        {/* Glow layer — blurred duplicate of progress ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: `blur(${strokeWidth * 0.8}px)` }}
        />
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)"}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.9s linear, stroke 0.6s ease",
            filter: `drop-shadow(0 0 ${strokeWidth * 0.6}px ${color})`,
          }}
        />
      </svg>

      {/* Center content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
        style={{ color, transition: "color 0.6s ease" }}
      >
        <span
          style={{
            fontSize,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: timeDisplay === "NOW" ? "0.05em" : "0",
            textShadow: `0 0 ${size * 0.12}px ${color}80`,
          }}
        >
          {timeDisplay}
        </span>
        {showLabel && timeDisplay !== "NOW" && (
          <span
            style={{
              fontSize: size * 0.1,
              fontWeight: 700,
              color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
              marginTop: size * 0.04,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            sync
          </span>
        )}
      </div>
    </div>
  );
}
