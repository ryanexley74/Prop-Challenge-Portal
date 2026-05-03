import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetGame,
  useGetLeaderboard,
  useGetPlayerAnswers,
  getGetGameQueryKey,
  getGetLeaderboardQueryKey,
  getGetPlayerAnswersQueryKey,
} from "@workspace/api-client-react";
import { Trophy, CheckCircle2, XCircle, Clock, ArrowLeft, Medal, Bell, BellOff, History, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationPermission, usePropNotifications } from "@/hooks/use-prop-notifications";

type PropFilter = "all" | "correct" | "wrong" | "pending";

const MEDALS = ["🥇", "🥈", "🥉"];

function pickLabel(type: string, answer: boolean) {
  if (type === "yes_no") return answer ? "YES" : "NO";
  return answer ? "OVER" : "UNDER";
}

function resultLabel(type: string, result: boolean) {
  if (type === "yes_no") return result ? "YES" : "NO";
  return result ? "OVER" : "UNDER";
}

export default function PlayerResults() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [filterTab, setFilterTab] = useState<PropFilter>("all");

  useEffect(() => {
    const stored = localStorage.getItem(`prop_game_${id}_player`);
    if (stored) setPlayerId(Number(stored));
  }, [id]);

  const { data: game, isLoading: gameLoading } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id) },
  });

  const { data: answers, isLoading: answersLoading } = useGetPlayerAnswers(
    playerId ?? 0,
    { query: { enabled: !!playerId, queryKey: getGetPlayerAnswersQueryKey(playerId ?? 0) } }
  );

  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard(id, {
    query: { enabled: !!id, queryKey: getGetLeaderboardQueryKey(id), refetchInterval: 5000 },
  });

  const { permission: notifPermission, request: requestNotifPermission } = useNotificationPermission();
  usePropNotifications(game?.props ?? [], game?.name ?? "", notifPermission === "granted");

  const isLoading = gameLoading || answersLoading || lbLoading;

  // If player hasn't joined
  if (!isLoading && !playerId) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">Not Joined Yet</h2>
          <p className="text-muted-foreground font-bold mb-6">
            You haven't joined this game. Join to make picks and track your results.
          </p>
          <div className="flex flex-col gap-3">
            {game?.status === "open" && (
              <Link
                href={`/games/${id}/join`}
                className="inline-flex items-center justify-center h-12 px-6 rounded-lg font-black uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Join Game
              </Link>
            )}
            <Link
              href={`/games/${id}`}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-black uppercase tracking-wider border hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Game Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!game) {
    return <div className="p-8 text-center text-xl font-bold">Game not found</div>;
  }

  // Build answer map: propId → answer
  const answerMap = new Map<number, boolean>(
    (answers ?? []).map((a) => [a.propId, a.answer])
  );

  // Find this player in the leaderboard
  const myEntry = leaderboard?.entries.find((e) => e.playerId === playerId);
  const rank = myEntry?.rank ?? null;
  const score = myEntry?.score ?? 0;
  const correctAnswers = myEntry?.correctAnswers ?? 0;
  const totalResolved = myEntry?.totalResolved ?? 0;
  const playerName = myEntry?.playerName ?? "You";

  const props = game.props ?? [];
  const resolvedProps = props.filter((p) => p.result !== null && p.result !== undefined);
  const pendingProps = props.filter((p) => p.result === null || p.result === undefined);

  const correctPropIds = new Set(
    resolvedProps
      .filter((p) => answerMap.get(p.id) === p.result)
      .map((p) => p.id)
  );

  const wrongProps = resolvedProps.filter((p) => !correctPropIds.has(p.id));
  const correctProps = resolvedProps.filter((p) => correctPropIds.has(p.id));

  const visibleResolved =
    filterTab === "correct" ? correctProps
    : filterTab === "wrong" ? wrongProps
    : filterTab === "pending" ? []
    : resolvedProps;

  const visiblePending = filterTab === "all" || filterTab === "pending" ? pendingProps : [];

  const FILTER_TABS: { key: PropFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: props.length },
    { key: "correct", label: "✓ Correct", count: correctProps.length },
    { key: "wrong", label: "✗ Wrong", count: wrongProps.length },
    { key: "pending", label: "⏳ Pending", count: pendingProps.length },
  ];

  const rankMedal = rank !== null && rank <= 3 ? MEDALS[rank - 1] : null;

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      {/* Header */}
      <header
        className="text-white py-8 shadow-md mb-6"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
      >
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <Link
              href={`/games/${id}`}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" /> Game Hub
            </Link>

            <div className="flex items-center gap-2">
              {playerName && playerName !== "You" && (
                <Link
                  href={`/history/${encodeURIComponent(playerName)}`}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
                  style={{
                    background: "rgba(249,115,22,0.15)",
                    color: "#fb923c",
                    border: "1px solid rgba(249,115,22,0.3)",
                  }}
                >
                  <History className="w-3.5 h-3.5" /> Season Record
                </Link>
              )}
            {notifPermission !== "unsupported" && (
              <button
                onClick={notifPermission === "default" ? requestNotifPermission : undefined}
                title={
                  notifPermission === "granted"
                    ? "Notifications on"
                    : notifPermission === "denied"
                    ? "Notifications blocked — allow in browser settings"
                    : "Get notified when props resolve"
                }
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                  notifPermission === "granted"
                    ? "bg-green-500/20 text-green-300 border border-green-500/40 cursor-default"
                    : notifPermission === "denied"
                    ? "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                    : "bg-white/15 hover:bg-white/25 text-white"
                }`}
              >
                {notifPermission === "denied" ? (
                  <BellOff className="w-3.5 h-3.5" />
                ) : (
                  <Bell className={`w-3.5 h-3.5 ${notifPermission === "granted" ? "fill-green-300" : ""}`} />
                )}
                {notifPermission === "granted" ? "Notifying" : notifPermission === "denied" ? "Blocked" : "Notify Me"}
              </button>
            )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-orange-400 text-xs font-black uppercase tracking-[0.3em] mb-1">
                My Results
              </div>
              <h1 className="text-3xl font-black uppercase tracking-wider leading-tight">
                {playerName}
              </h1>
              <p className="text-slate-400 font-bold mt-1">{game.name}</p>
            </div>

            {rank !== null && (
              <div
                className="shrink-0 flex flex-col items-center justify-center rounded-xl px-5 py-3"
                style={{
                  background:
                    rank === 1
                      ? "rgba(249,115,22,0.25)"
                      : "rgba(255,255,255,0.07)",
                  border:
                    rank === 1
                      ? "2px solid rgba(249,115,22,0.5)"
                      : "2px solid rgba(255,255,255,0.1)",
                }}
              >
                {rankMedal && <div className="text-3xl leading-none mb-1">{rankMedal}</div>}
                <div
                  className="font-black text-3xl leading-none"
                  style={{ color: rank === 1 ? "#f97316" : "#f8fafc" }}
                >
                  #{rank}
                </div>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                  Rank
                </div>
              </div>
            )}
          </div>

          {/* Score stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div
              className="rounded-lg px-4 py-3 text-center"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              <div className="text-orange-400 text-2xl font-black leading-none">{score}</div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Score</div>
            </div>
            <div
              className="rounded-lg px-4 py-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="text-white text-2xl font-black leading-none">
                {correctAnswers}/{totalResolved}
              </div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Correct</div>
            </div>
            <div
              className="rounded-lg px-4 py-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="text-white text-2xl font-black leading-none">{pendingProps.length}</div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Pending</div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-2xl space-y-3">

        {/* Filter tabs — only shown when there are enough props */}
        {props.length > 8 && (
          <div
            className="flex items-center gap-1.5 p-1 rounded-xl overflow-x-auto"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Filter className="w-3.5 h-3.5 text-slate-600 shrink-0 ml-1.5" />
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
                style={
                  filterTab === tab.key
                    ? { background: "rgba(249,115,22,0.2)", color: "#f97316", border: "1px solid rgba(249,115,22,0.35)" }
                    : { color: "#64748b", border: "1px solid transparent" }
                }
              >
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-md text-xs font-black"
                  style={{
                    background: filterTab === tab.key ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.07)",
                    color: filterTab === tab.key ? "#fb923c" : "#475569",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Resolved props */}
        {visibleResolved.length > 0 && (
          <div className="space-y-3">
            {props.length > 8 && filterTab === "all" && (
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground px-1">
                Resolved Props
              </h2>
            )}
            {visibleResolved.map((prop, idx) => {
              const myAnswer = answerMap.get(prop.id);
              const isCorrect = myAnswer === prop.result;
              const didAnswer = myAnswer !== undefined;

              return (
                <div
                  key={prop.id}
                  className="rounded-xl border-2 p-4 bg-card flex gap-4 items-start"
                  style={{
                    borderColor: !didAnswer
                      ? "hsl(var(--border))"
                      : isCorrect
                      ? "rgba(34,197,94,0.5)"
                      : "rgba(239,68,68,0.4)",
                    background: !didAnswer
                      ? undefined
                      : isCorrect
                      ? "rgba(34,197,94,0.05)"
                      : "rgba(239,68,68,0.04)",
                  }}
                >
                  {/* Outcome icon */}
                  <div className="shrink-0 mt-0.5">
                    {!didAnswer ? (
                      <XCircle className="w-6 h-6 text-muted-foreground" />
                    ) : isCorrect ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Prop {idx + 1}
                    </div>
                    <div className="font-bold text-base leading-snug mb-3">{prop.question}</div>
                    {prop.threshold && (
                      <div className="inline-block mb-3 px-2 py-0.5 bg-muted rounded text-xs font-bold">
                        Line: {prop.threshold}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* My pick */}
                      {didAnswer ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground font-bold uppercase">My pick:</span>
                          <span
                            className="px-2.5 py-1 rounded font-black text-sm uppercase"
                            style={{
                              background: isCorrect
                                ? "rgba(34,197,94,0.15)"
                                : "rgba(239,68,68,0.12)",
                              color: isCorrect ? "#22c55e" : "#f87171",
                            }}
                          >
                            {pickLabel(prop.type, myAnswer!)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-bold uppercase italic">
                          No pick submitted
                        </span>
                      )}

                      {/* Divider */}
                      <span className="text-muted-foreground/40 font-black">·</span>

                      {/* Result */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-bold uppercase">Result:</span>
                        <span
                          className="px-2.5 py-1 rounded font-black text-sm uppercase"
                          style={{
                            background: "rgba(249,115,22,0.15)",
                            color: "#f97316",
                          }}
                        >
                          {resultLabel(prop.type, prop.result as boolean)}
                        </span>
                      </div>

                      {/* +1 pt badge */}
                      {isCorrect && (
                        <span
                          className="ml-auto px-2 py-0.5 rounded font-black text-xs uppercase"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                        >
                          +1 pt
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pending props */}
        {visiblePending.length > 0 && (
          <div className="space-y-3 mt-4">
            {(props.length <= 8 || filterTab === "all") && (
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground px-1">
                Pending Props
              </h2>
            )}
            {visiblePending.map((prop, idx) => {
              const myAnswer = answerMap.get(prop.id);
              const didAnswer = myAnswer !== undefined;

              return (
                <div
                  key={prop.id}
                  className="rounded-xl border p-4 bg-card flex gap-4 items-start opacity-70"
                >
                  <div className="shrink-0 mt-0.5">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Prop {resolvedProps.length + idx + 1} · Pending
                    </div>
                    <div className="font-bold text-base leading-snug mb-3">{prop.question}</div>
                    {prop.threshold && (
                      <div className="inline-block mb-3 px-2 py-0.5 bg-muted rounded text-xs font-bold">
                        Line: {prop.threshold}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-bold uppercase">My pick:</span>
                      {didAnswer ? (
                        <span
                          className="px-2.5 py-1 rounded font-black text-sm uppercase"
                          style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}
                        >
                          {pickLabel(prop.type, myAnswer!)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No pick</span>
                      )}
                      <span
                        className="ml-auto px-2 py-0.5 rounded font-black text-xs uppercase"
                        style={{ background: "rgba(100,116,139,0.15)", color: "#94a3b8" }}
                      >
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {props.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Medal className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-bold">No props have been posted yet.</p>
          </div>
        )}

        {/* Back link + season record */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={`/games/${id}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Game Hub
          </Link>
          {playerName && playerName !== "You" && (
            <Link
              href={`/history/${encodeURIComponent(playerName)}`}
              className="inline-flex items-center gap-2 font-bold text-sm transition-colors"
              style={{ color: "#f97316" }}
            >
              <History className="w-4 h-4" /> My Season Record →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
