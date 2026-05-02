import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetGame, useListProps, useJoinGame, useSubmitAnswers, getGetGameQueryKey, getListPropsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function JoinGame() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const [, setLocation] = useLocation();

  const { data: game, isLoading: gameLoading } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id) }
  });

  const { data: props, isLoading: propsLoading } = useListProps(id, {
    query: { enabled: !!id, queryKey: getListPropsQueryKey(id) }
  });

  const joinGame = useJoinGame();
  const submitAnswers = useSubmitAnswers();

  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "picks">("name");
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Check if they already joined this game
    const stored = localStorage.getItem(`prop_game_${id}_player`);
    if (stored) {
      setPlayerId(Number(stored));
      setStep("picks"); // Skip straight to picks if already joined but didn't finish
    }
  }, [id]);

  if (gameLoading || propsLoading) {
    return <div className="p-8"><Skeleton className="h-96 w-full max-w-2xl mx-auto rounded-xl" /></div>;
  }

  if (!game || game.status !== "open") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CardTitle className="mb-4">Game is closed</CardTitle>
          <p className="text-muted-foreground mb-8">This game is no longer accepting new players or picks.</p>
          <Button onClick={() => setLocation(`/games/${id}`)}>Go to Game Hub</Button>
        </Card>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!name.trim()) return;
    joinGame.mutate({ data: { name } }, {
      onSuccess: (player) => {
        setPlayerId(player.id);
        localStorage.setItem(`prop_game_${id}_player`, player.id.toString());
        setStep("picks");
      }
    });
  };

  const handleAnswer = (propId: number, answer: boolean) => {
    setAnswers(prev => ({ ...prev, [propId]: answer }));
  };

  const handleSubmitPicks = async () => {
    if (!playerId || !props) return;
    
    // Ensure all props are answered
    if (Object.keys(answers).length !== props.length) {
      toast.error("Please answer all props before submitting!");
      return;
    }

    const answersList = Object.entries(answers).map(([propId, answer]) => ({
      propId: Number(propId),
      answer
    }));

    submitAnswers.mutate({ data: { playerId, answers: answersList } }, {
      onSuccess: () => {
        toast.success("Picks locked in!");
        setLocation(`/games/${id}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-black uppercase tracking-wider mb-2">Join Game</h1>
          <p className="text-xl opacity-80 font-bold">{game.name}</p>
        </div>

        {step === "name" && (
          <Card className="border-t-4 border-t-primary shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-black">Enter Your Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-lg font-bold">What should we call you?</Label>
                  <Input 
                    placeholder="Enter your name..." 
                    className="text-lg py-6"
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                size="lg" 
                className="w-full font-black text-lg h-14 uppercase tracking-wider" 
                onClick={handleJoin} 
                disabled={joinGame.isPending || !name.trim()}
              >
                {joinGame.isPending ? "Joining..." : "Let's Go"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === "picks" && props && (
          <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl shadow-sm border text-center">
              <h2 className="text-2xl font-black uppercase">Make Your Picks</h2>
              <p className="text-muted-foreground font-bold mt-2">Lock in your answers before kickoff.</p>
            </div>

            <div className="space-y-4">
              {props.map((prop, idx) => {
                const answered = answers[prop.id] !== undefined;
                const isYes = answers[prop.id] === true;
                const isNo = answers[prop.id] === false;

                return (
                  <Card key={prop.id} className={`border-l-4 transition-colors ${answered ? 'border-l-primary' : 'border-l-muted'}`}>
                    <CardContent className="p-6">
                      <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Prop {idx + 1}</div>
                      <div className="font-bold text-xl mb-4">{prop.question}</div>
                      {prop.threshold && (
                        <div className="inline-block mb-4 px-2 py-1 bg-muted rounded text-sm font-bold">
                          Line: {prop.threshold}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Button 
                          variant={isYes ? "default" : "outline"} 
                          className={`h-16 text-lg font-black uppercase tracking-wider ${isYes ? 'shadow-md scale-[1.02]' : ''}`}
                          onClick={() => handleAnswer(prop.id, true)}
                        >
                          {prop.type === "yes_no" ? "Yes" : "Over"}
                        </Button>
                        <Button 
                          variant={isNo ? "secondary" : "outline"} 
                          className={`h-16 text-lg font-black uppercase tracking-wider ${isNo ? 'shadow-md scale-[1.02]' : ''}`}
                          onClick={() => handleAnswer(prop.id, false)}
                        >
                          {prop.type === "yes_no" ? "No" : "Under"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-background/80 backdrop-blur-md p-4 border-t -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-none sm:p-0">
              <Button 
                size="lg" 
                className="w-full h-16 text-xl font-black uppercase tracking-wider shadow-xl"
                onClick={handleSubmitPicks}
                disabled={submitAnswers.isPending}
              >
                {submitAnswers.isPending ? "Submitting..." : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6" /> Lock In Picks
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}