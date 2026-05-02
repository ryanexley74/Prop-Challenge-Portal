import { useParams, Link } from "wouter";
import { useGetGame, useGetLeaderboard, getGetGameQueryKey, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trophy, Activity, Users, ListChecks, Link2, Check, Tv2, ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteQrDialog } from "@/components/invite-qr-dialog";

export default function GameHub() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const [copied, setCopied] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem(`prop_game_${id}_player`);
    if (stored) setMyPlayerId(Number(stored));
  }, [id]);

  const { data: game, isLoading: gameLoading } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id) }
  });

  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard(id, {
    query: { enabled: !!id, queryKey: getGetLeaderboardQueryKey(id), refetchInterval: 3000 }
  });

  const handleCopyInvite = () => {
    const link = `${window.location.origin}/games/${id}/join`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast({ title: "Invite link copied!", description: "Share this link with your friends." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (gameLoading || lbLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!game) {
    return <div className="p-8 text-center text-xl font-bold">Game not found</div>;
  }

  const colors = ['#f97316', '#0f172a', '#16a34a', '#eab308', '#9333ea'];

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="bg-primary text-primary-foreground py-6 shadow-md mb-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-black bg-secondary text-secondary-foreground rounded uppercase tracking-widest">
                {game.status}
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wider">{game.name}</h1>
            {game.description && <p className="opacity-90">{game.description}</p>}
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-center px-4 py-2 bg-primary-foreground/10 rounded-lg">
              <div className="text-3xl font-black">{game.playerCount}</div>
              <div className="text-xs uppercase font-bold opacity-80">Players</div>
            </div>
            <div className="text-center px-4 py-2 bg-primary-foreground/10 rounded-lg">
              <div className="text-3xl font-black">{leaderboard?.resolvedPropCount}/{leaderboard?.totalPropCount}</div>
              <div className="text-xs uppercase font-bold opacity-80">Props</div>
            </div>
            {game.status === "open" && (
              <Link href={`/games/${id}/join`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold uppercase tracking-wider">
                Join Game
              </Link>
            )}
            <button
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-2 h-10 px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "Copied!" : "Invite Link"}
            </button>
            {game && <InviteQrDialog gameId={id} gameName={game.name} variant="glass" />}
            {myPlayerId && (
              <Link
                href={`/games/${id}/results`}
                className="inline-flex items-center gap-2 h-10 px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                My Results
              </Link>
            )}
            <Link
              href={`/games/${id}/tv`}
              className="inline-flex items-center gap-2 h-10 px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              <Tv2 className="w-4 h-4" />
              TV Mode
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
            <TabsTrigger value="leaderboard" className="font-bold uppercase tracking-wider text-xs">Leaderboard</TabsTrigger>
            <TabsTrigger value="props" className="font-bold uppercase tracking-wider text-xs">Props & Action</TabsTrigger>
          </TabsList>
          
          <TabsContent value="leaderboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" /> Live Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard?.entries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-bold">No players yet</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leaderboard?.entries.slice(0, 10)}>
                          <XAxis dataKey="playerName" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold' }} />
                          <YAxis hide />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                            {leaderboard?.entries.slice(0, 10).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {leaderboard?.entries.map((entry, idx) => (
                        <div key={entry.playerId} className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className="w-8 text-center font-black text-xl text-muted-foreground">
                              #{entry.rank}
                            </div>
                            <div className="font-bold text-lg">{entry.playerName}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-2xl text-primary">{entry.score} pts</div>
                            <div className="text-xs text-muted-foreground uppercase font-bold">
                              {entry.correctAnswers} / {entry.totalResolved} correct
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="props">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-primary" /> The Board
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {game.props.map((prop, idx) => (
                    <div key={prop.id} className="p-4 border-2 rounded-lg bg-card flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                      <div>
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Prop {idx + 1}</div>
                        <div className="font-bold text-lg">{prop.question}</div>
                        {prop.threshold && (
                          <div className="inline-block mt-2 px-2 py-1 bg-muted rounded text-sm font-bold">
                            Line: {prop.threshold}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end">
                        {prop.result === null ? (
                          <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Result</span>
                            <span className={`px-4 py-2 rounded-md font-black text-lg uppercase ${prop.result ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                              {prop.type === "yes_no" 
                                ? (prop.result ? "YES" : "NO") 
                                : (prop.result ? "OVER" : "UNDER")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {game.props.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-bold">No props posted yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}