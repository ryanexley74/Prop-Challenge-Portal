import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetGameRecap, getGetGameRecapQueryKey } from "@workspace/api-client-react";
import { Trophy, ArrowLeft, Check, Link2, Users, Target, BarChart3, Zap, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHTS = ["h-24", "h-36", "h-16"];

function resultLabel(type: string, result: boolean) {
  if (type === "yes_no") return result ? "YES" : "NO";
  return result ? "OVER" : "UNDER";
}

function AccuracyBar({ trueCount, falseCount, result, type }: {
  trueCount: number;
  falseCount: number;
  result: boolean | null | undefined;
  type: string;
}) {
  const total = trueCount + falseCount;
  if (total === 0) return (
    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">No picks</span>
  );
  const truePct = Math.round((trueCount / total) * 100);
  const falsePct = 100 - truePct;
  const trueLabel = type === "yes_no" ? "YES" : "OVER";
  const falseLabel = type === "yes_no" ? "NO" : "UNDER";
  const trueWon = result === true;
  const falseWon = result === false;

  return (
    <div className="space-y-1.5">
      <div className="flex rounded-full overflow-hidden h-3" style={{ background: "rgba(255,255,255,0.05)" }}>
        {truePct > 0 && (
          <div
            className="h-full transition-all"
            style={{
              width: `${truePct}%`,
              background: trueWon ? "#f97316" : result !== null && result !== undefined ? "rgba(249,115,22,0.3)" : "#3b82f6",
            }}
          />
        )}
        {falsePct > 0 && (
          <div
            className="h-full transition-all"
            style={{
              width: `${falsePct}%`,
              background: falseWon ? "#f97316" : result !== null && result !== undefined ? "rgba(249,115,22,0.3)" : "#475569",
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs font-bold">
        <span style={{ color: trueWon ? "#f97316" : result !== null ? "#64748b" : "#94a3b8" }}>
          {trueLabel} {truePct}% ({trueCount})
        </span>
        <span style={{ color: falseWon ? "#f97316" : result !== null ? "#64748b" : "#94a3b8" }}>
          ({falseCount}) {falsePct}% {falseLabel}
        </span>
      </div>
    </div>
  );
}

export default function GameRecap() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const [copied, setCopied] = useState(false);
  const [propFilter, setPropFilter] = useState<"all" | "resolved" | "pending">("all");
  const [pendingOpen, setPendingOpen] = useState(false);

  const { data: recap, isLoading } = useGetGameRecap(id, {
    query: { enabled: !!id, queryKey: getGetGameRecapQueryKey(id) },
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Find toughest and easiest resolved prop by accuracy
  const { toughestId, easiestId } = useMemo(() => {
    if (!recap) return { toughestId: null, easiestId: null };
    const resolved = recap.propStats.filter(
      (p) => p.result !== null && p.result !== undefined && p.accuracy !== null && p.totalPicks > 0
    );
    if (resolved.length < 2) return { toughestId: null, easiestId: null };
    const sorted = [...resolved].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
    return { toughestId: sorted[0].propId, easiestId: sorted[sorted.length - 1].propId };
  }, [recap]);

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 space-y-4" style={{ background: "#0a1628" }}>
        <Skeleton className="h-40 w-full rounded-2xl" style={{ background: "#1e293b" }} />
        <Skeleton className="h-20 w-full rounded-2xl" style={{ background: "#1e293b" }} />
        <Skeleton className="h-56 w-full rounded-2xl" style={{ background: "#1e293b" }} />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" style={{ background: "#1e293b" }} />)}
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a1628" }}>
        <div className="text-center">
          <Trophy className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-black uppercase tracking-wider text-white mb-2">Game Not Found</h2>
          <p className="text-slate-500 font-bold">This recap link may be invalid.</p>
        </div>
      </div>
    );
  }

  const resolvedStats = recap.propStats.filter((p) => p.result !== null && p.result !== undefined);
  const pendingStats = recap.propStats.filter((p) => p.result === null || p.result === undefined);

  const visibleResolvedStats = propFilter === "pending" ? [] : resolvedStats;
  const visiblePendingStats = propFilter === "resolved" ? [] : pendingStats;
  const showFilterBar = recap.propStats.length > 8;

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0a1628" }}>
      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)",
          borderBottom: "1px solid rgba(249,115,22,0.2)",
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.08) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-4 max-w-3xl py-10 relative">
          <div className="flex items-start justify-between mb-6 gap-4">
            <Link
              href={`/games/${id}`}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" /> Game Hub
            </Link>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:scale-105"
              style={{
                background: copied ? "rgba(34,197,94,0.2)" : "rgba(249,115,22,0.15)",
                border: copied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(249,115,22,0.4)",
                color: copied ? "#86efac" : "#fb923c",
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "Link Copied!" : "Share Recap"}
            </button>
          </div>

          <div className="text-center">
            <div className="text-6xl mb-4">🏆</div>
            <div className="text-orange-400 text-xs font-black uppercase tracking-[0.4em] mb-2">
              Final Recap
            </div>
            <h1 className="text-white font-black uppercase tracking-wider mb-2" style={{ fontSize: "clamp(1.75rem, 5vw, 3rem)" }}>
              {recap.gameName}
            </h1>
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest"
              style={{
                background: recap.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                color: recap.status === "completed" ? "#86efac" : "#fb923c",
                border: recap.status === "completed" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(249,115,22,0.3)",
              }}
            >
              {recap.status === "completed" ? "✅ Final" : recap.status === "active" ? "🔴 Live" : "Open"}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-3xl py-8 space-y-8">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Players", value: recap.totalPlayers },
            { icon: Target, label: "Props Resolved", value: `${recap.resolvedProps}/${recap.totalProps}` },
            { icon: BarChart3, label: "Avg Accuracy", value: `${recap.overallAccuracy}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Icon className="w-5 h-5 text-orange-400 mx-auto mb-2" />
              <div className="text-white text-2xl font-black leading-none mb-1">{value}</div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Podium */}
        {recap.podium.length > 0 && (
          <div
            className="rounded-2xl p-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h2 className="text-orange-400 text-xs font-black uppercase tracking-[0.35em] text-center mb-8">
              Top Finishers
            </h2>
            <div className="flex items-end justify-center gap-4">
              {PODIUM_ORDER.map((entryIdx) => {
                const entry = recap.podium[entryIdx];
                if (!entry) return <div key={entryIdx} className="w-28" />;
                const isChamp = entryIdx === 0;
                const medal = MEDALS[entryIdx];
                const heightClass = PODIUM_HEIGHTS[entryIdx];

                return (
                  <div key={entry.playerId} className="flex flex-col items-center gap-2">
                    <div className="text-center mb-1">
                      <div className="text-3xl mb-1">{medal}</div>
                      <div
                        className="font-black uppercase tracking-wide text-sm"
                        style={{
                          color: isChamp ? "#f97316" : "#94a3b8",
                          textShadow: isChamp ? "0 0 16px rgba(249,115,22,0.5)" : "none",
                        }}
                      >
                        {entry.playerName}
                      </div>
                      <div className="text-white font-black mt-0.5" style={{ fontSize: isChamp ? "1.75rem" : "1.25rem" }}>
                        {entry.score}
                        <span className="text-slate-500 text-xs font-bold ml-1">pts</span>
                      </div>
                      <div className="text-slate-600 text-xs font-bold">
                        {entry.correctAnswers}/{entry.totalResolved}
                      </div>
                    </div>
                    <div
                      className={`w-28 ${heightClass} rounded-t-xl flex items-center justify-center`}
                      style={{
                        background: isChamp
                          ? "linear-gradient(to bottom, rgba(249,115,22,0.35), rgba(249,115,22,0.1))"
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid ${isChamp ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)"}`,
                        borderBottom: "none",
                        boxShadow: isChamp ? "0 0 30px rgba(249,115,22,0.15)" : "none",
                      }}
                    >
                      <span className="font-black text-3xl" style={{ color: isChamp ? "#f97316" : "#334155" }}>
                        #{entry.rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Remaining players */}
            {recap.podium.length < recap.totalPlayers && (
              <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-widest text-center">
                  + {recap.totalPlayers - recap.podium.length} more players
                </p>
              </div>
            )}
          </div>
        )}

        {/* Prop breakdown */}
        {recap.propStats.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
              <h2 className="text-orange-400 text-xs font-black uppercase tracking-[0.35em]">
                Prop-by-Prop Breakdown
              </h2>
              <span className="text-slate-600 text-xs font-bold">
                {recap.resolvedProps}/{recap.totalProps} resolved
              </span>
            </div>

            {/* Filter tabs — only shown when there are enough props */}
            {showFilterBar && (
              <div
                className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {(["all", "resolved", "pending"] as const).map((tab) => {
                  const count = tab === "all" ? recap.propStats.length : tab === "resolved" ? resolvedStats.length : pendingStats.length;
                  const label = tab === "all" ? "All" : tab === "resolved" ? "✅ Resolved" : "⏳ Pending";
                  const active = propFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setPropFilter(tab)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
                      style={
                        active
                          ? { background: "rgba(249,115,22,0.2)", color: "#f97316", border: "1px solid rgba(249,115,22,0.35)" }
                          : { color: "#64748b", border: "1px solid transparent" }
                      }
                    >
                      {label}
                      <span
                        className="px-1.5 py-0.5 rounded-md text-xs font-black"
                        style={{
                          background: active ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)",
                          color: active ? "#fb923c" : "#475569",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resolved props */}
            {visibleResolvedStats.length > 0 && visibleResolvedStats.map((stat, idx) => {
              const isToughest = stat.propId === toughestId;
              const isEasiest = stat.propId === easiestId;

              return (
                <div
                  key={stat.propId}
                  className="rounded-2xl p-5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: isToughest
                      ? "1px solid rgba(239,68,68,0.25)"
                      : isEasiest
                      ? "1px solid rgba(34,197,94,0.2)"
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-slate-600 text-xs font-bold uppercase">Prop {idx + 1}</span>
                        {isToughest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                            <TrendingDown className="w-3 h-3" /> Toughest
                          </span>
                        )}
                        {isEasiest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#86efac" }}>
                            <Zap className="w-3 h-3" /> Easiest
                          </span>
                        )}
                      </div>
                      <p className="text-white font-bold leading-snug">{stat.question}</p>
                      {stat.threshold !== null && stat.threshold !== undefined && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-bold text-slate-500"
                          style={{ background: "rgba(255,255,255,0.05)" }}>
                          Line: {stat.threshold}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span
                        className="px-3 py-1.5 rounded-lg font-black text-sm uppercase tracking-wider"
                        style={{ background: "rgba(249,115,22,0.18)", color: "#f97316" }}
                      >
                        {resultLabel(stat.type, stat.result as boolean)}
                      </span>
                      {stat.accuracy !== null && (
                        <span
                          className="text-xs font-black uppercase tracking-wider"
                          style={{
                            color: (stat.accuracy ?? 0) >= 70 ? "#86efac"
                              : (stat.accuracy ?? 0) >= 40 ? "#fbbf24"
                              : "#f87171",
                          }}
                        >
                          {stat.accuracy}% got it
                        </span>
                      )}
                    </div>
                  </div>

                  <AccuracyBar
                    trueCount={stat.trueCount}
                    falseCount={stat.falseCount}
                    result={stat.result}
                    type={stat.type}
                  />
                </div>
              );
            })}

            {/* Pending props — collapsible when there are also resolved ones */}
            {visiblePendingStats.length > 0 && (
              <>
                <button
                  onClick={() => setPendingOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <span className="text-slate-500 text-xs font-black uppercase tracking-[0.3em]">
                    ⏳ Unresolved Props
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-black"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}
                    >
                      {visiblePendingStats.length}
                    </span>
                    <span className="text-slate-600 text-xs font-bold">
                      {pendingOpen ? "▲ Hide" : "▼ Show"}
                    </span>
                  </div>
                </button>

                {pendingOpen && visiblePendingStats.map((stat, idx) => (
                  <div
                    key={stat.propId}
                    className="rounded-2xl p-5 opacity-50"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="text-slate-600 text-xs font-bold uppercase block mb-1">
                          Prop {resolvedStats.length + idx + 1}
                        </span>
                        <p className="text-slate-400 font-bold leading-snug">{stat.question}</p>
                      </div>
                      <span className="shrink-0 px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider text-slate-600"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        Pending
                      </span>
                    </div>
                    {stat.totalPicks > 0 && (
                      <AccuracyBar
                        trueCount={stat.trueCount}
                        falseCount={stat.falseCount}
                        result={null}
                        type={stat.type}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-slate-700 text-xs font-bold uppercase tracking-widest">
            🏈 Prop Bet Challenge — Bragging Rights Only
          </p>
          <div className="flex justify-center gap-4 mt-3">
            <Link href={`/games/${id}`} className="text-slate-600 hover:text-slate-400 text-xs font-bold uppercase tracking-wider transition-colors">
              Game Hub
            </Link>
            <Link href={`/games/${id}/tv`} className="text-slate-600 hover:text-slate-400 text-xs font-bold uppercase tracking-wider transition-colors">
              TV Mode
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
