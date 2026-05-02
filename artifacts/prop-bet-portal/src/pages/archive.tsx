import { useListGames, useGetGameSummary, getGetGameSummaryQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Trophy, Users, Target, ArrowLeft, Clock, ChevronRight, Archive as ArchiveIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function ArchiveGameCard({ gameId, name, createdAt }: { gameId: number; name: string; createdAt: string }) {
  const { data: summary } = useGetGameSummary(gameId, {
    query: { queryKey: getGetGameSummaryQueryKey(gameId) },
  });

  const date = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3 h-3 text-slate-600" />
              <span className="text-slate-600 text-xs font-bold uppercase tracking-wider">{date}</span>
            </div>
            <h3 className="text-white font-black text-xl uppercase tracking-wide leading-tight">{name}</h3>
          </div>
          <span
            className="shrink-0 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider"
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "#86efac",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            ✅ Final
          </span>
        </div>

        {summary ? (
          <>
            {summary.topPlayer && (
              <div
                className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                style={{
                  background: "rgba(249,115,22,0.08)",
                  border: "1px solid rgba(249,115,22,0.2)",
                }}
              >
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider" style={{ color: "rgba(251,146,60,0.6)" }}>
                    Champion
                  </div>
                  <div className="font-black text-lg leading-tight" style={{ color: "#f97316" }}>
                    {summary.topPlayer}
                  </div>
                  <div className="text-xs font-bold" style={{ color: "rgba(251,146,60,0.5)" }}>
                    {summary.topScore} pts correct
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Users, label: "Players", value: summary.totalPlayers },
                { icon: Target, label: "Props", value: `${summary.resolvedProps}/${summary.totalProps}` },
                { icon: null, label: "Top Score", value: summary.topScore !== null ? `${summary.topScore} pts` : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-2.5 text-center"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  {Icon && <Icon className="w-4 h-4 text-slate-500 mx-auto mb-1" />}
                  {!Icon && <div className="w-4 h-4 mx-auto mb-1" />}
                  <div className="text-white font-black text-base leading-none mb-0.5">{value}</div>
                  <div className="text-slate-600 text-xs font-bold uppercase">{label}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <Link
          href={`/games/${gameId}/recap`}
          className="flex items-center justify-between gap-2 px-5 py-3.5 text-sm font-black uppercase tracking-wider transition-colors hover:bg-white/5"
          style={{ color: "#f97316" }}
        >
          View Full Recap
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function Archive() {
  const { data: games, isLoading } = useListGames();

  const completedGames = (games ?? [])
    .filter((g) => g.status === "completed" && g.includeInArchive !== false)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0a1628" }}>
      <header
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #0f172a 100%)",
          borderBottom: "1px solid rgba(249,115,22,0.2)",
        }}
      >
        <div className="container mx-auto px-4 max-w-3xl py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm font-bold uppercase tracking-wider mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>

          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              <Trophy className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <div className="text-orange-400 text-xs font-black uppercase tracking-[0.4em] mb-0.5">
                Hall of Fame
              </div>
              <h1 className="text-white font-black text-3xl uppercase tracking-wide">Game Archive</h1>
            </div>
          </div>

          {!isLoading && (
            <p className="text-slate-500 font-bold text-sm mt-3">
              {completedGames.length} completed game{completedGames.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-3xl py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" style={{ background: "#1e293b" }} />
            ))}
          </div>
        ) : completedGames.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-white text-2xl font-black uppercase tracking-wide mb-2">No Completed Games Yet</h2>
            <p className="text-slate-500 font-bold mb-6">
              When you mark a game as completed, its recap will appear here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-sm tracking-wider"
              style={{
                background: "rgba(249,115,22,0.15)",
                color: "#f97316",
                border: "1px solid rgba(249,115,22,0.3)",
              }}
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {completedGames.map((game) => (
              <ArchiveGameCard key={game.id} gameId={game.id} name={game.name} createdAt={game.createdAt} />
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
