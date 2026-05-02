import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  useGetGame, useListProps, useCreateProp, useUpdateProp, useDeleteProp, useUpdateGame,
  useSyncFromSheet, useGetAiStatus, useTestAiConnection,
  getGetGameQueryKey, getListPropsQueryKey,
  type Prop, type AiTestResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, ShieldAlert, Plus, Trash2, ArrowRight, Link2, Check, Tv2, FileText, Sheet, RefreshCw, CheckCircle2, XCircle, Volume2, VolumeX, GripVertical, Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SyncCountdownRing } from "@/components/sync-countdown-ring";
import { SOUND_OPTIONS, playPropSound, type SoundChoice } from "@/lib/prop-sounds";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { InviteQrDialog } from "@/components/invite-qr-dialog";
import { ImportPropsDialog } from "@/components/import-props-dialog";

type PropType = "yes_no" | "over_under";

const PROVIDER_LABELS: Record<string, string> = {
  openai:       "OpenAI",
  gemini:       "Google Gemini",
  groq:         "Groq",
  custom:       "Custom",
  unconfigured: "Not set",
};
const providerLabel = (p: string) => PROVIDER_LABELS[p] ?? p;

function TallyInput({
  propId,
  currentTally,
  onSave,
  disabled,
}: {
  propId: number;
  currentTally: string | null | undefined;
  onSave: (propId: number, tally: string | null) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(currentTally ?? "");

  useEffect(() => {
    setDraft(currentTally ?? "");
  }, [currentTally]);

  const save = () => {
    const trimmed = draft.trim();
    const current = currentTally ?? "";
    if (trimmed === current) return;
    onSave(propId, trimmed || null);
  };

  return (
    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-dashed border-border/60">
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
        📊 Live Tally
      </span>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        disabled={disabled}
        placeholder="e.g. 142, 3 TDs, 26 pts"
        className="h-6 flex-1 text-xs px-2 rounded border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder:text-muted-foreground/40"
      />
      {currentTally && (
        <button
          onClick={() => { setDraft(""); onSave(propId, null); }}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive text-sm font-bold leading-none px-0.5 shrink-0"
          title="Clear tally"
        >
          ×
        </button>
      )}
    </div>
  );
}

function SortablePropCard({
  prop,
  idx,
  onResolve,
  onDelete,
  onSaveTally,
  isPending,
}: {
  prop: Prop;
  idx: number;
  onResolve: (propId: number, result: boolean | null) => void;
  onDelete: (propId: number) => void;
  onSaveTally: (propId: number, tally: string | null) => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`border-l-4 ${prop.result !== null ? "border-l-muted opacity-60" : "border-l-primary"} overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-center">
          {/* Drag handle */}
          <div
            className="hidden md:flex items-center justify-center w-8 self-stretch cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="p-4 flex-1">
            <div className="flex items-start gap-2">
              {/* Mobile drag handle */}
              <div
                className="md:hidden mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Prop {idx + 1}</div>
                <div className="font-bold text-lg">{prop.question}</div>
                {prop.threshold && (
                  <div className="inline-block mt-2 px-2 py-1 bg-muted rounded text-sm font-bold font-mono">
                    Line: {prop.threshold}
                  </div>
                )}
                {prop.result === null && (
                  <TallyInput
                    propId={prop.id}
                    currentTally={prop.tally}
                    onSave={onSaveTally}
                    disabled={isPending}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 text-center">
              Resolve Result
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={prop.result === true ? "default" : "outline"}
                size="sm"
                className="font-black uppercase"
                onClick={() => onResolve(prop.id, true)}
              >
                {prop.type === "yes_no" ? "Yes" : "Over"}
              </Button>
              <Button
                variant={prop.result === false ? "secondary" : "outline"}
                size="sm"
                className="font-black uppercase"
                onClick={() => onResolve(prop.id, false)}
              >
                {prop.type === "yes_no" ? "No" : "Under"}
              </Button>
            </div>
            {prop.result !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs uppercase font-bold"
                onClick={() => onResolve(prop.id, null)}
              >
                Clear Result
              </Button>
            )}
          </div>

          <div className="bg-destructive/10 p-2 md:p-4 flex justify-center items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive hover:text-white"
              onClick={() => onDelete(prop.id)}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AdminPanel() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const queryClient = useQueryClient();
  const [copiedInvite, setCopiedInvite] = useState(false);
  const { toast: showToast } = useToast();

  const handleCopyInvite = () => {
    const link = `${window.location.origin}/games/${id}/join`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedInvite(true);
      showToast({ title: "Invite link copied!", description: link });
      setTimeout(() => setCopiedInvite(false), 2000);
    });
  };

  const { data: game, isLoading: gameLoading } = useGetGame(id, {
    query: { enabled: !!id, queryKey: getGetGameQueryKey(id) }
  });

  const { data: props, isLoading: propsLoading } = useListProps(id, {
    query: { enabled: !!id, queryKey: getListPropsQueryKey(id) }
  });

  const createProp = useCreateProp();
  const updateProp = useUpdateProp();
  const deleteProp = useDeleteProp();
  const updateGame = useUpdateGame();
  const syncFromSheet = useSyncFromSheet();
  const { data: aiStatus } = useGetAiStatus();
  const testAiConn = useTestAiConnection();

  const [propOpen, setPropOpen] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AiTestResult | null>(null);
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<PropType>("yes_no");
  const [threshold, setThreshold] = useState("");
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [syncResult, setSyncResult] = useState<{
    resolved: { propId: number; question: string; result: boolean }[];
    unmatched: string[];
    alreadyResolved: number;
  } | null>(null);

  // Sync URL input from loaded game data
  useEffect(() => {
    if (game?.sheetUrl) setSheetUrlInput(game.sheetUrl);
  }, [game?.sheetUrl]);

  // Optimistic local ordering for drag-and-drop
  const [orderedProps, setOrderedProps] = useState<Prop[]>([]);
  useEffect(() => {
    if (props) setOrderedProps(props);
  }, [props]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedProps((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);

      reordered.forEach((prop, idx) => {
        if (prop.order !== idx) {
          updateProp.mutate(
            { propId: prop.id, data: { order: idx } },
            { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) }) }
          );
        }
      });

      return reordered;
    });
  }, [updateProp, queryClient, id]);

  if (gameLoading || propsLoading) {
    return <div className="p-8"><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  if (!game) {
    return <div className="p-8 text-center text-xl font-bold">Game not found</div>;
  }

  const handleCreateProp = () => {
    if (!question) return;
    createProp.mutate(
      { 
        gameId: id, 
        data: { 
          question, 
          type, 
          threshold: threshold ? Number(threshold) : undefined,
          order: props ? props.length : 0 
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) });
          setPropOpen(false);
          setQuestion("");
          setThreshold("");
          toast.success("Prop added!");
        }
      }
    );
  };

  const handleResolveProp = (propId: number, result: boolean | null) => {
    updateProp.mutate(
      { propId, data: { result } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) });
          toast.success("Prop resolved!");
        }
      }
    );
  };

  const handleDeleteProp = (propId: number) => {
    if (confirm("Are you sure you want to delete this prop?")) {
      deleteProp.mutate(
        { propId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) });
            toast.success("Prop deleted.");
          }
        }
      );
    }
  };

  const INTERVAL_OPTIONS = [
    { value: "1", label: "Every 1 min" },
    { value: "2", label: "Every 2 min" },
    { value: "3", label: "Every 3 min" },
    { value: "5", label: "Every 5 min" },
    { value: "10", label: "Every 10 min" },
    { value: "15", label: "Every 15 min" },
    { value: "30", label: "Every 30 min" },
  ];

  const handleIntervalChange = (value: string) => {
    updateGame.mutate(
      { gameId: id, data: { syncInterval: Number(value) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
          toast.success(`Auto-sync interval set to ${value} min`);
        },
      }
    );
  };

  const handleSoundToggle = (enabled: boolean) => {
    updateGame.mutate(
      { gameId: id, data: { soundEnabled: enabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
          toast.success(enabled ? "TV sound enabled" : "TV sound muted");
        },
      }
    );
  };

  const handleTvToggle = (field: "showBanner" | "showPickReveal" | "showCountdown" | "showTicker" | "showTally", value: boolean) => {
    updateGame.mutate(
      { gameId: id, data: { [field]: value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
        },
      }
    );
  };

  const handleSoundChange = (value: SoundChoice) => {
    updateGame.mutate(
      { gameId: id, data: { soundChoice: value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
          playPropSound(value);
          toast.success(`Sound changed — preview playing`);
        },
      }
    );
  };

  const handleSaveTally = (propId: number, tally: string | null) => {
    updateProp.mutate(
      { propId, data: { tally } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) });
          toast.success(tally ? `Tally updated to "${tally}"` : "Tally cleared");
        },
      }
    );
  };

  const handleSheetSync = () => {
    if (!sheetUrlInput.trim()) return;
    syncFromSheet.mutate(
      { gameId: id, data: { sheetUrl: sheetUrlInput.trim() } },
      {
        onSuccess: (result) => {
          setSyncResult(result);
          queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(id) });
          if (result.resolved.length > 0) {
            toast.success(`Synced! Resolved ${result.resolved.length} prop${result.resolved.length !== 1 ? "s" : ""}.`);
          } else {
            toast.info("Sync complete — no new props resolved yet.");
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Sync failed. Check the sheet URL and sharing settings.";
          toast.error(msg);
        },
      }
    );
  };

  const handleStatusChange = (status: "open" | "active" | "completed") => {
    updateGame.mutate(
      { gameId: id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
          toast.success(`Game status changed to ${status}`);
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="bg-[#0f172a] text-white py-6 shadow-md mb-8">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">Admin Panel</h1>
              <p className="text-sm font-bold opacity-70">Game: {game.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-colors"
            >
              {copiedInvite ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
              {copiedInvite ? "Copied!" : "Invite Link"}
            </button>
            {game && <InviteQrDialog gameId={id} gameName={game.name} variant="glass" />}
            {game.status === "completed" && (
              <Link
                href={`/games/${id}/recap`}
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-md transition-colors"
                style={{
                  background: "rgba(249,115,22,0.2)",
                  border: "1px solid rgba(249,115,22,0.4)",
                  color: "#fb923c",
                }}
              >
                <FileText className="w-4 h-4" /> Share Recap
              </Link>
            )}
            <Link href={`/games/${id}/tv`} className="inline-flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-colors">
              <Tv2 className="w-4 h-4" /> TV Mode
            </Link>
            <Link href={`/games/${id}`} className="inline-flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-colors">
              View Live Hub <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="col-span-1 md:col-span-2 border-primary border-2">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-lg font-black uppercase">Game Status Controls</CardTitle>
              <CardDescription>Control when players can join and when the game ends.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Button 
                  variant={game.status === "open" ? "default" : "outline"}
                  onClick={() => handleStatusChange("open")}
                  className="font-bold uppercase tracking-wider"
                >
                  1. Open (Accepting Picks)
                </Button>
                <Button 
                  variant={game.status === "active" ? "default" : "outline"}
                  onClick={() => handleStatusChange("active")}
                  className="font-bold uppercase tracking-wider"
                >
                  2. Active (Locked)
                </Button>
                <Button 
                  variant={game.status === "completed" ? "default" : "outline"}
                  onClick={() => handleStatusChange("completed")}
                  className="font-bold uppercase tracking-wider"
                >
                  3. Completed
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 mt-2 border-t">
                <div>
                  <div className="font-bold text-sm">Include in Archive</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Show this game in the Game Archive and tally tracking. Uncheck to hide it without deleting anything.
                  </div>
                </div>
                <Switch
                  checked={game.includeInArchive !== false}
                  onCheckedChange={(val) =>
                    updateGame.mutate(
                      { gameId: id, data: { includeInArchive: val } },
                      {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(id) });
                          toast.success(val ? "Game added to archive" : "Game hidden from archive");
                        },
                      }
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="bg-muted pb-4">
              <CardTitle className="text-lg font-black uppercase">Admin Code</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 text-center">
              <div className="font-mono text-3xl font-black tracking-widest text-primary p-4 bg-muted/50 rounded-lg">
                {game.adminCode}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-bold uppercase">Save this code to return later</p>
            </CardContent>
          </Card>
        </div>

        {/* Google Sheet Sync */}
        <Card className="mb-8 border-2 border-green-500/30">
          <CardHeader className="bg-green-500/5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sheet className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg font-black uppercase">Google Sheet Sync</CardTitle>
              </div>
              {game.sheetUrl && game.status === "active" && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} />
                    AUTO-SYNC EVERY {game.syncInterval ?? 5} MIN
                  </div>
                  <SyncCountdownRing
                    lastSheetSync={game.lastSheetSync ?? null}
                    syncInterval={game.syncInterval ?? 5}
                    size={64}
                    strokeWidth={6}
                    showLabel={true}
                    dark={false}
                  />
                </div>
              )}
            </div>
            <CardDescription>
              Paste a public Google Sheet URL. The sheet should list your prop questions and their answers.
              When the game is <strong>Active</strong>, it syncs on your chosen schedule — or click "Sync Now" any time.
            </CardDescription>
            {game.lastSheetSync && (
              <p className="text-xs text-green-700 font-bold mt-1">
                Last synced: {new Date(game.lastSheetSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleSheetSync}
                disabled={syncFromSheet.isPending || !sheetUrlInput.trim()}
                className="font-bold uppercase shrink-0 bg-green-600 hover:bg-green-700 text-white"
              >
                {syncFromSheet.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>
                )}
              </Button>
            </div>

            {/* Interval selector + sharing note */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center gap-2 flex-1">
                <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-bold">Auto-sync interval</span>
              </div>
              <Select
                value={String(game.syncInterval ?? 5)}
                onValueChange={handleIntervalChange}
                disabled={updateGame.isPending}
              >
                <SelectTrigger className="w-40 font-bold text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Make sure the sheet is set to <strong>"Anyone with the link can view"</strong> in Google Sheets sharing settings.
            </p>

            {syncResult && (
              <div className="mt-2 space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-4 text-sm font-bold">
                  <span className="text-green-600">{syncResult.resolved.length} resolved</span>
                  {syncResult.unmatched.length > 0 && (
                    <span className="text-amber-600">{syncResult.unmatched.length} unmatched</span>
                  )}
                  {syncResult.alreadyResolved > 0 && (
                    <span className="text-muted-foreground">{syncResult.alreadyResolved} already done</span>
                  )}
                </div>
                {syncResult.resolved.length > 0 && (
                  <div className="space-y-1">
                    {syncResult.resolved.map((r) => (
                      <div key={r.propId} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="font-medium truncate">{r.question}</span>
                        <span className={`ml-auto font-black text-xs px-2 py-0.5 rounded ${r.result ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.result ? "YES / OVER" : "NO / UNDER"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {syncResult.unmatched.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-600 uppercase">Could not match:</p>
                    {syncResult.unmatched.map((q, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{q}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Sync Status */}
        <Card className="mb-8 border-2 border-blue-500/30">
          <CardHeader className="bg-blue-500/5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg font-black uppercase">AI Sync Status</CardTitle>
              </div>
              {aiStatus && (
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                  aiStatus.configured
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {aiStatus.configured ? "✓ Configured" : "✗ Not configured"}
                </span>
              )}
            </div>
            <CardDescription>
              The AI model that reads your Google Sheet and determines prop results.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {aiStatus ? (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground mb-0.5">Provider</div>
                    <div className="font-bold">{providerLabel(aiStatus.provider)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground mb-0.5">Model</div>
                    <div className="font-mono font-bold text-sm">{aiStatus.model}</div>
                  </div>
                  {aiStatus.baseUrlHost && (
                    <div className="col-span-2">
                      <div className="text-xs font-bold uppercase text-muted-foreground mb-0.5">Endpoint</div>
                      <div className="font-mono text-xs text-muted-foreground">{aiStatus.baseUrlHost}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-bold uppercase"
                    disabled={testAiConn.isPending || !aiStatus.configured}
                    onClick={() =>
                      testAiConn.mutate(undefined, {
                        onSuccess: (r) => setAiTestResult(r),
                        onError: () =>
                          setAiTestResult({ ok: false, latencyMs: 0, error: "Request failed" }),
                      })
                    }
                  >
                    {testAiConn.isPending ? "Testing…" : "Test Connection"}
                  </Button>

                  {aiTestResult && (
                    <div className={`flex items-center gap-1.5 text-sm font-bold ${aiTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                      {aiTestResult.ok ? (
                        <><CheckCircle2 className="w-4 h-4" /> Reachable · {aiTestResult.latencyMs}ms</>
                      ) : (
                        <><XCircle className="w-4 h-4" /> {aiTestResult.error ?? "Failed"}</>
                      )}
                    </div>
                  )}
                </div>

                {!aiStatus.configured && (
                  <p className="text-xs text-amber-600 font-medium bg-amber-50 rounded-lg p-3">
                    Set <code className="font-mono bg-amber-100 px-1 rounded">OPENAI_API_KEY</code>,{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">AI_INTEGRATIONS_OPENAI_BASE_URL</code>, and{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">AI_MODEL</code> in your{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">.env</code> to enable Google Sheet sync.
                  </p>
                )}
              </>
            ) : (
              <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            )}
          </CardContent>
        </Card>

        {/* TV Display Controls */}
        <Card className="mb-8 border-2 border-purple-500/30">
          <CardHeader className="bg-purple-500/5 pb-3">
            <div className="flex items-center gap-2">
              <Tv2 className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg font-black uppercase">TV Display Controls</CardTitle>
            </div>
            <CardDescription>
              Control exactly what appears on the TV screen during the game.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 divide-y">

            {/* Prop Resolved Banner */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-bold text-sm">🔔 Prop Resolved Banner</div>
                <div className="text-xs text-muted-foreground mt-0.5">Slide-in notification at the top when a prop resolves</div>
              </div>
              <Switch
                checked={game.showBanner ?? true}
                disabled={updateGame.isPending}
                onCheckedChange={(v) => handleTvToggle("showBanner", v)}
              />
            </div>

            {/* Pick Reveal */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-bold text-sm">🎯 Pick Reveal</div>
                <div className="text-xs text-muted-foreground mt-0.5">Show how everyone voted before revealing the result</div>
              </div>
              <Switch
                checked={game.showPickReveal ?? true}
                disabled={updateGame.isPending}
                onCheckedChange={(v) => handleTvToggle("showPickReveal", v)}
              />
            </div>

            {/* Sound */}
            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    {(game.soundEnabled ?? true) ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                    Sound Effect
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Play a sound when a prop resolves</div>
                </div>
                <Switch
                  checked={game.soundEnabled ?? true}
                  disabled={updateGame.isPending}
                  onCheckedChange={(v) => handleSoundToggle(v)}
                />
              </div>
              {(game.soundEnabled ?? true) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SOUND_OPTIONS.map((opt) => {
                    const isSelected = (game.soundChoice ?? "chime") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleSoundChange(opt.value)}
                        disabled={updateGame.isPending}
                        className={`flex flex-col items-start gap-0.5 p-2.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-purple-500 bg-purple-50 shadow-sm"
                            : "border-border bg-background hover:border-purple-300 hover:bg-purple-50/50"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-black text-xs">{opt.label}</span>
                          {isSelected && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">On</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sync Countdown */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-bold text-sm">⏱ Sync Countdown</div>
                <div className="text-xs text-muted-foreground mt-0.5">Countdown ring to next sheet sync (top right of TV)</div>
              </div>
              <Switch
                checked={game.showCountdown ?? true}
                disabled={updateGame.isPending}
                onCheckedChange={(v) => handleTvToggle("showCountdown", v)}
              />
            </div>

            {/* Scrolling Ticker */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-bold text-sm">📜 Scrolling Ticker</div>
                <div className="text-xs text-muted-foreground mt-0.5">Results ticker scrolling along the bottom of the TV</div>
              </div>
              <Switch
                checked={game.showTicker ?? true}
                disabled={updateGame.isPending}
                onCheckedChange={(v) => handleTvToggle("showTicker", v)}
              />
            </div>

            {/* Live Tally Strip */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className="font-bold text-sm">📊 Live Tally Strip</div>
                <div className="text-xs text-muted-foreground mt-0.5">Show running counts for in-progress props (synced from sheet)</div>
              </div>
              <Switch
                checked={game.showTally ?? true}
                disabled={updateGame.isPending}
                onCheckedChange={(v) => handleTvToggle("showTally", v)}
              />
            </div>

          </CardContent>
        </Card>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black uppercase flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Manage Props
          </h2>
          <div className="flex items-center gap-2">
            <ImportPropsDialog gameId={id} existingCount={props?.length ?? 0} />
            <Dialog open={propOpen} onOpenChange={setPropOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold uppercase tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Add Prop
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-xl">Create New Prop</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="font-bold">Type</Label>
                  <Select value={type} onValueChange={(val: PropType) => setType(val)}>
                    <SelectTrigger className="font-bold">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes_no">Yes / No</SelectItem>
                      <SelectItem value="over_under">Over / Under</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Question</Label>
                  <Input 
                    placeholder="e.g. Will the coin toss be heads?" 
                    value={question} 
                    onChange={(e) => setQuestion(e.target.value)} 
                    className="font-medium"
                  />
                </div>
                {type === "over_under" && (
                  <div className="space-y-2">
                    <Label className="font-bold">Line / Threshold (Optional)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 45.5" 
                      value={threshold} 
                      onChange={(e) => setThreshold(e.target.value)}
                      className="font-medium font-mono"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreateProp} disabled={createProp.isPending} className="font-bold uppercase w-full">
                  {createProp.isPending ? "Creating..." : "Save Prop"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedProps.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {orderedProps.map((prop, idx) => (
                <SortablePropCard
                  key={prop.id}
                  prop={prop}
                  idx={idx}
                  onResolve={handleResolveProp}
                  onDelete={handleDeleteProp}
                  onSaveTally={handleSaveTally}
                  isPending={updateProp.isPending}
                />
              ))}
              {orderedProps.length === 0 && (
                <Card className="p-12 text-center border-dashed">
                  <p className="text-lg font-bold text-muted-foreground uppercase">No props created yet</p>
                  <Button variant="outline" className="mt-4 font-bold" onClick={() => setPropOpen(true)}>Add your first prop</Button>
                </Card>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}