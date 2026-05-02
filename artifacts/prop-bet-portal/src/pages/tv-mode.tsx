import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetGame, useGetLeaderboard, getGetGameQueryKey, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Trophy, Tv2, ArrowLeft } from "lucide-react";

const COLORS = ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f43f5e"];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TvMode() {
  const { gameId } = useParams();
  const id = Number(gameId);

  const { data: game } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id), refetchInterval: 3000 },
  });

  const { data: leaderboard } = useGetLeaderboard(id, {
    query: { enabled: !!id, queryKey: getGetLeaderboardQueryKey(id), refetchInterval: 3000 },
  });

  // Enter fullscreen when the page mounts
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

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-hidden select-none"
      style={{ background: "#0f172a", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header bar */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Trophy className="w-10 h-10 text-orange-400 shrink-0" />
          <div>
            <div className="text-orange-400 text-xs font-black uppercase tracking-[0.3em] mb-0.5">Live Leaderboard</div>
            <h1 className="text-white text-3xl font-black uppercase tracking-wider leading-none">
              {game?.name ?? "Loading…"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Props resolved */}
          <div className="text-center">
            <div className="text-orange-400 text-4xl font-black leading-none">
              {resolvedCount}<span className="text-slate-500 text-2xl">/{totalCount}</span>
            </div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Props Resolved</div>
          </div>

          {/* Players */}
          <div className="text-center">
            <div className="text-white text-4xl font-black leading-none">{entries.length}</div>
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Players</div>
          </div>

          {/* Exit button */}
          <Link
            href={`/games/${id}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider border border-slate-600 hover:border-slate-400 rounded-lg px-4 py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Link>
        </div>
      </header>

      {/* Divider */}
      <div className="h-0.5 mx-8 bg-gradient-to-r from-orange-500 via-orange-400 to-transparent mb-4 shrink-0" />

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
          <Trophy className="w-24 h-24 opacity-20" />
          <p className="text-3xl font-black uppercase tracking-wider">Waiting for players…</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-8 pb-8 gap-6 overflow-hidden">
          {/* Bar chart */}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 16, left: 16, bottom: 8 }}>
                <XAxis
                  dataKey="playerName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontWeight: 700, fontSize: 18, textAnchor: "middle" }}
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

          {/* Leaderboard rows */}
          <div className="shrink-0 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 5)}, 1fr)` }}>
            {entries.slice(0, 10).map((entry, idx) => {
              const isFirst = idx === 0;
              return (
                <div
                  key={entry.playerId}
                  className="rounded-xl px-4 py-3 flex flex-col items-center gap-1 transition-all"
                  style={{
                    background: isFirst ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.05)",
                    border: isFirst ? "2px solid rgba(249,115,22,0.6)" : "2px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="text-2xl leading-none">{MEDALS[idx] ?? `#${entry.rank}`}</div>
                  <div
                    className="font-black uppercase tracking-wide text-center leading-tight truncate w-full text-center"
                    style={{ color: COLORS[idx % COLORS.length], fontSize: entries.length > 6 ? "0.85rem" : "1rem" }}
                  >
                    {entry.playerName}
                  </div>
                  <div className="text-white font-black text-2xl leading-none">{entry.score}</div>
                  <div className="text-slate-500 text-xs font-bold uppercase">
                    {entry.correctAnswers}/{entry.totalResolved}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer ticker */}
      <div className="shrink-0 h-10 flex items-center gap-3 px-8 border-t border-slate-800">
        <Tv2 className="w-4 h-4 text-orange-400 shrink-0" />
        <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">
          Auto-updating every 3 seconds
        </div>
        <div className="flex-1" />
        <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">
          {game?.status === "active" ? "🔴 LIVE" : game?.status === "completed" ? "✅ FINAL" : game?.status?.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
