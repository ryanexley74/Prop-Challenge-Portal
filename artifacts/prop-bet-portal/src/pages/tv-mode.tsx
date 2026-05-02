import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetGame,
  useGetLeaderboard,
  getGetGameQueryKey,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Trophy, Tv2, ArrowLeft, X } from "lucide-react";
import { SyncCountdownRing } from "@/components/sync-countdown-ring";
import confetti from "canvas-confetti";

const COLORS = ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f43f5e"];
const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHTS = ["h-28", "h-40", "h-20"]; // 2nd, 1st, 3rd
const PODIUM_ORDER = [1, 0, 2]; // left=2nd, center=1st, right=3rd

function propResultLabel(type: string, result: boolean) {
  if (type === "yes_no") return result ? "YES ✅" : "NO ❌";
  return result ? "OVER ✅" : "UNDER ❌";
}

// ─── Scrolling ticker ──────────────────────────────────────────────────────

interface TickerProps {
  items: { question: string; type: string; result: boolean }[];
  status: string;
}

function ResultsTicker({ items, status }: TickerProps) {
  const segment = useMemo(() => {
    if (items.length === 0) return null;
    return items.map((p, i) => (
      <span key={i} className="inline-flex items-center gap-3 shrink-0">
        <span className="text-slate-500 font-black px-3">◆</span>
        <span className="text-slate-300 font-bold">{p.question}</span>
        <span
          className="font-black tracking-wider px-2 py-0.5 rounded text-sm"
          style={{
            background: p.result ? "rgba(249,115,22,0.2)" : "rgba(100,116,139,0.2)",
            color: p.result ? "#fb923c" : "#94a3b8",
          }}
        >
          {propResultLabel(p.type, p.result)}
        </span>
      </span>
    ));
  }, [items]);

  const duration = Math.max(items.length * 6, 12);

  return (
    <div
      className="shrink-0 flex items-stretch border-t"
      style={{ height: "3rem", borderColor: "#1e293b", background: "#070f1c" }}
    >
      <div
        className="shrink-0 flex items-center gap-2 px-4 border-r z-10"
        style={{ borderColor: "#1e293b", background: "#070f1c", minWidth: "9rem" }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{
            background: status === "active" ? "#ef4444" : status === "completed" ? "#22c55e" : "#f97316",
            boxShadow: status === "active" ? "0 0 6px #ef4444" : "none",
            animation: status === "active" ? "pulse 1.5s ease-in-out infinite" : "none",
          }}
        />
        <span className="text-orange-400 text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap">
          {status === "active" ? "🔴 Live" : status === "completed" ? "✅ Final" : "Results"}
        </span>
      </div>

      <div className="flex-1 overflow-hidden relative flex items-center">
        {items.length === 0 ? (
          <span className="text-slate-600 text-xs font-bold uppercase tracking-widest px-6">
            No props resolved yet — check back soon
          </span>
        ) : (
          <div
            className="ticker-track items-center text-sm whitespace-nowrap"
            style={{ animationDuration: `${duration}s` }}
          >
            {segment}
            {segment}
          </div>
        )}
        <div
          className="absolute inset-y-0 left-0 w-12 pointer-events-none"
          style={{ background: "linear-gradient(to right, #070f1c, transparent)" }}
        />
        <div
          className="absolute inset-y-0 right-0 w-12 pointer-events-none"
          style={{ background: "linear-gradient(to left, #070f1c, transparent)" }}
        />
      </div>

      <div className="shrink-0 flex items-center px-4 border-l" style={{ borderColor: "#1e293b" }}>
        <Tv2 className="w-4 h-4 text-slate-700" />
      </div>
    </div>
  );
}

// ─── Celebration overlay ───────────────────────────────────────────────────

interface CelebrationEntry {
  playerId: number;
  playerName: string;
  score: number;
  correctAnswers: number;
  totalResolved: number;
  rank: number;
}

interface CelebrationProps {
  entries: CelebrationEntry[];
  onDismiss: () => void;
}

function CelebrationOverlay({ entries, onDismiss }: CelebrationProps) {
  const firedRef = useRef(false);
  const top3 = entries.slice(0, 3);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...opts,
        origin: { y: 0.6 },
        particleCount: Math.floor(200 * particleRatio),
        spread: 70,
        startVelocity: 30,
      });
    };

    // Initial big burst
    fire(0.25, { angle: 60,  spread: 55, origin: { x: 0, y: 0.6 } });
    fire(0.25, { angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
    fire(0.2,  { spread: 60, decay: 0.91, scalar: 0.8 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1,  { spread: 120, startVelocity: 45 });

    // Sustained confetti shower for 4 seconds
    const end = Date.now() + 4000;
    const colors = ["#f97316", "#eab308", "#f8fafc", "#3b82f6", "#22c55e"];
    const interval = setInterval(() => {
      if (Date.now() > end) { clearInterval(interval); return; }
      confetti({ angle: 60,  spread: 55, particleCount: 8,  origin: { x: 0 },    colors });
      confetti({ angle: 120, spread: 55, particleCount: 8,  origin: { x: 1 },    colors });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Dismiss on keypress
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(7, 15, 28, 0.93)", backdropFilter: "blur(4px)" }}
    >
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-6 right-8 text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
      >
        <X className="w-5 h-5" /> Close
      </button>

      {/* Trophy + title */}
      <div className="text-center mb-10">
        <div className="text-8xl mb-4" style={{ filter: "drop-shadow(0 0 24px #f97316)" }}>🏆</div>
        <div className="text-orange-400 text-sm font-black uppercase tracking-[0.4em] mb-2">Game Over</div>
        <h2 className="text-white font-black uppercase tracking-wider" style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}>
          Final Standings
        </h2>
      </div>

      {/* Podium — order: 2nd · 1st · 3rd */}
      <div className="flex items-end gap-4 mb-10">
        {PODIUM_ORDER.map((entryIdx) => {
          const entry = top3[entryIdx];
          if (!entry) return <div key={entryIdx} className="w-36" />;
          const isChamp = entryIdx === 0;
          const podiumHeightClass = PODIUM_HEIGHTS[entryIdx];
          const medal = MEDALS[entryIdx];
          const color = COLORS[entryIdx % COLORS.length];

          return (
            <div key={entry.playerId} className="flex flex-col items-center gap-2">
              {/* Player info above pedestal */}
              <div className="text-center mb-2">
                <div className="text-4xl mb-1">{medal}</div>
                <div
                  className="font-black uppercase tracking-wide text-center"
                  style={{ color, fontSize: isChamp ? "1.25rem" : "1rem", textShadow: isChamp ? `0 0 20px ${color}80` : "none" }}
                >
                  {entry.playerName}
                </div>
                <div
                  className="font-black mt-1"
                  style={{ color: "#f8fafc", fontSize: isChamp ? "2.5rem" : "1.75rem", lineHeight: 1 }}
                >
                  {entry.score}
                  <span className="text-slate-500 text-sm font-bold ml-1">pts</span>
                </div>
                <div className="text-slate-500 text-xs font-bold uppercase mt-0.5">
                  {entry.correctAnswers}/{entry.totalResolved} correct
                </div>
              </div>

              {/* Pedestal block */}
              <div
                className={`w-36 ${podiumHeightClass} flex items-center justify-center rounded-t-lg`}
                style={{
                  background: isChamp
                    ? "linear-gradient(to bottom, rgba(249,115,22,0.4), rgba(249,115,22,0.1))"
                    : "linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
                  border: `2px solid ${isChamp ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.1)"}`,
                  borderBottom: "none",
                  boxShadow: isChamp ? "0 0 40px rgba(249,115,22,0.2)" : "none",
                }}
              >
                <span
                  className="font-black text-4xl"
                  style={{ color: isChamp ? "#f97316" : "#475569" }}
                >
                  #{entry.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Remaining finishers */}
      {entries.length > 3 && (
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
          {entries.slice(3).map((entry) => (
            <div
              key={entry.playerId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-slate-400 font-black text-sm">#{entry.rank}</span>
              <span className="text-slate-300 font-bold">{entry.playerName}</span>
              <span className="text-slate-500 font-black text-sm">{entry.score}pts</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onDismiss}
        className="mt-10 px-8 py-3 rounded-lg font-black uppercase tracking-wider text-white transition-all hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #f97316, #ea580c)",
          boxShadow: "0 0 32px rgba(249,115,22,0.4)",
        }}
      >
        View Full Leaderboard
      </button>
    </div>
  );
}

// ─── Main TV Mode page ─────────────────────────────────────────────────────

export default function TvMode() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const { data: game } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id), refetchInterval: 3000 },
  });

  const { data: leaderboard } = useGetLeaderboard(id, {
    query: { enabled: !!id, queryKey: getGetLeaderboardQueryKey(id), refetchInterval: 3000 },
  });

  // Re-show celebration if game transitions to completed during this session
  useEffect(() => {
    if (!game) return;
    if (prevStatusRef.current && prevStatusRef.current !== "completed" && game.status === "completed") {
      setCelebrationDismissed(false);
    }
    prevStatusRef.current = game.status;
  }, [game?.status]);

  // Fullscreen on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const entries = leaderboard?.entries ?? [];
  const chartData = entries.slice(0, 10);
  const topScore = Math.max(...chartData.map((e) => e.score), 1);
  const resolvedCount = leaderboard?.resolvedPropCount ?? 0;
  const totalCount = leaderboard?.totalPropCount ?? 0;

  const resolvedProps = useMemo(() => {
    if (!game?.props) return [];
    return game.props
      .filter((p) => p.result !== null && p.result !== undefined)
      .sort((a, b) => {
        const ta = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
        const tb = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
        return tb - ta;
      }) as { question: string; type: string; result: boolean; resolvedAt: string | null }[];
  }, [game?.props]);

  const showCelebration =
    game?.status === "completed" && entries.length > 0 && !celebrationDismissed;

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden select-none"
      style={{ background: "#0f172a", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Celebration overlay */}
      {showCelebration && (
        <CelebrationOverlay
          entries={entries}
          onDismiss={() => setCelebrationDismissed(true)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Trophy className="w-10 h-10 text-orange-400 shrink-0" />
          <div>
            <div className="text-orange-400 text-xs font-black uppercase tracking-[0.3em] mb-0.5">
              Live Leaderboard
            </div>
            <h1 className="text-white text-3xl font-black uppercase tracking-wider leading-none">
              {game?.name ?? "Loading…"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-orange-400 text-4xl font-black leading-none">
              {resolvedCount}
              <span className="text-slate-500 text-2xl">/{totalCount}</span>
            </div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">
              Props Resolved
            </div>
          </div>
          <div className="text-center">
            <div className="text-white text-4xl font-black leading-none">{entries.length}</div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">
              Players
            </div>
          </div>

          {/* Sync countdown — only shown when auto-sync is active */}
          {game?.sheetUrl && game?.status === "active" && (
            <div className="flex flex-col items-center gap-1">
              <SyncCountdownRing
                lastSheetSync={game.lastSheetSync ?? null}
                syncInterval={game.syncInterval ?? 5}
                size={110}
                strokeWidth={9}
                showLabel={true}
                dark={true}
              />
              <div className="text-slate-500 text-xs font-black uppercase tracking-widest">
                Next Sync
              </div>
            </div>
          )}
          {game?.status === "completed" && !celebrationDismissed === false && (
            <button
              onClick={() => setCelebrationDismissed(false)}
              className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm font-bold uppercase tracking-wider border border-orange-500/40 hover:border-orange-400 rounded-lg px-4 py-2"
            >
              🏆 Show Podium
            </button>
          )}
          <Link
            href={`/games/${id}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider border border-slate-600 hover:border-slate-400 rounded-lg px-4 py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Link>
        </div>
      </header>

      {/* Orange divider */}
      <div
        className="h-0.5 mx-8 shrink-0 mb-4"
        style={{ background: "linear-gradient(to right, #f97316, #fb923c80, transparent)" }}
      />

      {/* Main content */}
      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
          <Trophy className="w-24 h-24 opacity-20" />
          <p className="text-3xl font-black uppercase tracking-wider">Waiting for players…</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-8 pb-4 gap-4 min-h-0 overflow-hidden">
          {/* Bar chart */}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 16, left: 16, bottom: 8 }}>
                <XAxis
                  dataKey="playerName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontWeight: 700, fontSize: 18 }}
                />
                <YAxis hide domain={[0, Math.ceil(topScore * 1.15)]} />
                <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={120}>
                  <LabelList
                    dataKey="score"
                    position="top"
                    style={{ fill: "#f8fafc", fontWeight: 900, fontSize: 22 }}
                    formatter={(v: number) => `${v}`}
                  />
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Player cards */}
          <div
            className="shrink-0 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 5)}, 1fr)` }}
          >
            {entries.slice(0, 10).map((entry, idx) => {
              const isFirst = idx === 0;
              return (
                <div
                  key={entry.playerId}
                  className="rounded-xl px-4 py-3 flex flex-col items-center gap-1"
                  style={{
                    background: isFirst ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
                    border: isFirst
                      ? "2px solid rgba(249,115,22,0.6)"
                      : "2px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="text-2xl leading-none">{MEDALS[idx] ?? `#${entry.rank}`}</div>
                  <div
                    className="font-black uppercase tracking-wide text-center leading-tight truncate w-full"
                    style={{
                      color: COLORS[idx % COLORS.length],
                      fontSize: entries.length > 6 ? "0.85rem" : "1rem",
                    }}
                  >
                    {entry.playerName}
                  </div>
                  <div className="text-white font-black text-2xl leading-none">{entry.score}</div>
                  <div className="text-slate-500 text-xs font-bold uppercase">
                    {entry.correctAnswers}/{entry.totalResolved} correct
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrolling ticker */}
      <ResultsTicker items={resolvedProps} status={game?.status ?? ""} />
    </div>
  );
}
