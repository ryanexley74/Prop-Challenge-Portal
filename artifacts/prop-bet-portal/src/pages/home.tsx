import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListGames, useCreateGame, getListGamesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Plus, Activity, Link2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CopyInviteButton({ gameId }: { gameId: number }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = `${window.location.origin}/games/${gameId}/join`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast({ title: "Invite link copied!", description: link });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="font-bold gap-2">
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
      {copied ? "Copied!" : "Copy Invite Link"}
    </Button>
  );
}

export default function Home() {
  const { data: games, isLoading } = useListGames();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createGame = useCreateGame();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleCreate = async () => {
    if (!name) return;
    createGame.mutate({ data: { name, description } }, {
      onSuccess: (game) => {
        queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });
        setOpen(false);
        setLocation(`/games/${game.id}/admin`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="bg-primary text-primary-foreground py-6 shadow-md mb-8">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8" />
            <h1 className="text-2xl font-black uppercase tracking-wider">Prop Bet Portal</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="font-bold">
                <Plus className="w-4 h-4 mr-2" /> NEW GAME
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Game</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Game Name</Label>
                  <Input placeholder="Super Bowl LVIII Props..." value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Winner takes bragging rights..." value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createGame.isPending}>
                  {createGame.isPending ? "Creating..." : "Create Game"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Active Games
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : games?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium text-muted-foreground">No games running right now.</p>
              <p className="text-sm text-muted-foreground mb-4">Start one up for the squad.</p>
              <Button onClick={() => setOpen(true)}>Create Game</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games?.map((game) => (
              <Card key={game.id} className="border-t-4 border-t-primary flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-secondary text-secondary-foreground rounded-full uppercase">
                      {game.status}
                    </span>
                  </div>
                  <CardTitle className="text-xl">{game.name}</CardTitle>
                  {game.description && <CardDescription>{game.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1">
                </CardContent>
                <CardFooter className="bg-muted/50 p-4 border-t flex flex-col gap-2">
                  <Link href={`/games/${game.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 w-full">
                    View Game Hub
                  </Link>
                  {game.status === "open" && (
                    <CopyInviteButton gameId={game.id} />
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}