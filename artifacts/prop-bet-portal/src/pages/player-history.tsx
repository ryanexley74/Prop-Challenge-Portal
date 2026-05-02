import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { getPlayerHistory, type PlayerHistoryGame } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ArrowLeft, Target, Users, ChevronRight, Search, Medal, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MEDALS = ["🥇", "🥈", "🥉"];

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
        style={{ background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)" }}>
        ✅ Final
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
        style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }}>
        🔴 Live
      </span>
    );
  }
  return (
    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.07)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>
      Open
    </span>
  );
}

function GameRow({ entry, index }: { entry: PlayerHistoryGame; index: number }) {
  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const rankMedal = entry.rank !== null && entry.rank !== undefined && entry.rank <= 3
    ? MEDALS[entry.rank - 1]
    : null;

  const acc = entry.accuracy ?? null;
  const accuracyColor =
    acc === null ? "#64748b"
    : acc >= 70 ? "#86efac"
    : acc >= 50 ? "#fbbf24"
    : "#f87171";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: entry.isChampion
          ? "rgba(249,115,22,0.06)"
          : "rgba(255,255,255,0.03)",
        border: entry.isChampion
          ? "1px solid rgba(249,115,22,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-slate-600 text-xs font-bold uppercase tracking-wider">
                {date}
              </span>
              <StatusBadge status={entry.status} />
              {entry.isChampion && (
                <span className="text-xs font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(249,115,22,0.2)", color: "#f97316", border: "1px solid rgba(249,115,22,0.4)" }}>
                  🏆 Champion
                </span>
              )}
            </div>
            <h3 className="text-white font-black text-base uppercase tracking-wide leading-tight truncate">
              {entry.gameName}
            </h3>
          </div>

          {/* Rank badge */}
          {entry.rank !== null && entry.rank !== undefined && (
            <div className="shrink-0 flex flex-col items-center">
              {rankMedal ? (
                <div className="text-2xl leading-none">{rankMedal}</div>
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
                  #{entry.rank}
                </div>
              )}
              <div className="text-xs font-bold text-slate-600 mt-0.5">
                of {entry.totalPlayers}
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-white font-black text-base leading-none mb-0.5">{entry.score}</div>
            <div className="text-slate-600 text-xs font-bold uppercase">Score</div>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-white font-black text-base leading-none mb-0.5">
              {entry.correctAnswers}/{entry.totalResolved}
            </div>
            <div className="text-slate-600 text-xs font-bold uppercase">Correct</div>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="font-black text-base leading-none mb-0.5" style={{ color: accuracyColor }}>
              {entry.accuracy !== null && entry.accuracy !== undefined ? `${entry.accuracy}%` : "—"}
            </div>
            <div className="text-slate-600 text-xs font-bold uppercase">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Recap link for completed games */}
      {entry.status === "completed" && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link
            href={`/games/${entry.gameId}/recap`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-white/5 transition-colors"
            style={{ color: "#f97316" }}
          >
            View Full Recap <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl p-4 text-center"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-white font-black text-2xl leading-none mb-1">{value}</div>
      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</div>
      {sub && <div className="text-slate-700 text-xs font-bold mt-0.5">{sub}</div>}
    </div>
  );
}

export default function PlayerHistory() {
  const params = useParams<{ playerName: string }>();
  const [, setLocation] = useLocation();
  const playerName = decodeURIComponent(params.playerName ?? "");
  const [searchInput, setSearchInput] = useState("");

  const { data: history, isLoading, isError } = useQuery({
    queryKey: ["player-history", playerName],
    queryFn: () => getPlayerHistory({ name: playerName }),
    enabled: !!playerName,
  });

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    setLocation(`/history/${encodeURIComponent(trimmed)}`);
    setSearchInput("");
  };

  const accuracyColor =
    !history || history.overallAccuracy === 0 ? "#64748b"
    : history.overallAccuracy >= 70 ? "#86efac"
    : history.overallAccuracy >= 50 ? "#fbbf24"
    : "#f87171";

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0a1628" }}>
      <header style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)",
        borderBottom: "1px solid rgba(249,115,22,0.2)",
      }}>
        <div className="container mx-auto px-4 max-w-2xl py-8">
          <Link href="/"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm font-bold uppercase tracking-wider mb-6">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>

          {/* Player identity */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
              <Skeleton className="h-12 w-64 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
          ) : (
            <div className="mb-6">
              <div className="text-orange-400 text-xs font-black uppercase tracking-[0.4em] mb-1">
                Season Record
              </div>
              <h1 className="text-white font-black uppercase tracking-wide leading-tight"
                style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
                {history?.playerName ?? playerName}
              </h1>
              {history && history.totalGames > 0 && (
                <p className="text-slate-500 font-bold text-sm mt-1">
                  {history.totalGames} game{history.totalGames !== 1 ? "s" : ""} tracked
                </p>
              )}
            </div>
          )}

          {/* Overall stats */}
          {history && history.totalGames > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)" }}>
                <div className="font-black text-2xl leading-none mb-1" style={{ color: "#f97316" }}>
                  {history.overallCorrect}/{history.overallResolved}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(251,146,60,0.6)" }}>
                  Overall
                </div>
              </div>
              <div className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="font-black text-2xl leading-none mb-1" style={{ color: accuracyColor }}>
                  {history.overallAccuracy}%
                </div>
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Accuracy</div>
              </div>
              <div className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-white font-black text-2xl leading-none mb-1">
                  {history.championCount > 0 ? `${history.championCount}🏆` : "—"}
                </div>
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                  {history.championCount === 1 ? "Win" : "Wins"}
                </div>
              </div>
              <div className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-white font-black text-2xl leading-none mb-1">
                  {history.bestRank !== null && history.bestRank !== undefined
                    ? history.bestRank <= 3 ? MEDALS[history.bestRank - 1] : `#${history.bestRank}`
                    : "—"}
                </div>
                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">Best Rank</div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-2xl py-8 space-y-6">

        {/* Look up another player */}
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Look Up Another Player
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter player name…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="font-bold bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
            <Button
              onClick={handleSearch}
              disabled={!searchInput.trim()}
              className="font-black uppercase shrink-0"
              style={{ background: "rgba(249,115,22,0.8)" }}
            >
              Go
            </Button>
          </div>
        </div>

        {/* Game list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-36 rounded-2xl" style={{ background: "#1e293b" }} />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-slate-400 font-bold">Could not load history. Try again.</p>
          </div>
        ) : !history || history.totalGames === 0 ? (
          <div className="text-center py-20">
            <Medal className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h2 className="text-white text-xl font-black uppercase tracking-wide mb-2">No Games Found</h2>
            <p className="text-slate-500 font-bold text-sm">
              No archived games found for <span className="text-slate-300">"{playerName}"</span>.
              Check the spelling or look up another name.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Star className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400 text-xs font-black uppercase tracking-[0.3em]">
                Game History
              </span>
            </div>
            {history.games.map((entry, i) => (
              <GameRow key={entry.gameId} entry={entry} index={i} />
            ))}
          </div>
        )}
      </div>

      <div className="text-center pb-4">
        <p className="text-slate-700 text-xs font-bold uppercase tracking-widest">
          🏈 Prop Bet Challenge — Bragging Rights Only
        </p>
      </div>
    </div>
  );
}
