import { useState } from "react";
import { useImportProps, useCreateProp, getListPropsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Download, Link2, Loader2, Check, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

interface ParsedProp {
  question: string;
  type: "yes_no" | "over_under";
  threshold?: number | null;
}

interface ImportPropsDialogProps {
  gameId: number;
  existingCount: number;
}

export function ImportPropsDialog({ gameId, existingCount }: ImportPropsDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "paste">("url");

  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [parsedProps, setParsedProps] = useState<ParsedProp[] | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const queryClient = useQueryClient();
  const importPropsMutation = useImportProps();
  const createProp = useCreateProp();

  const isPending = importPropsMutation.isPending;

  const onSuccess = (result: { props: ParsedProp[]; sourceTitle?: string }) => {
    setParsedProps(result.props);
    setSourceTitle(result.sourceTitle ?? "");
    setSelected(new Set(result.props.map((_, i) => i)));
    setFetchError(null);
  };

  const handleFetchUrl = () => {
    if (!url.trim()) return;
    setParsedProps(null);
    setSelected(new Set());
    setFetchError(null);
    importPropsMutation.mutate(
      { gameId, data: { url: url.trim() } },
      {
        onSuccess,
        onError: () => {
          setFetchError("Could not fetch that URL. The site may block automated requests — try the Paste Text tab instead.");
        },
      }
    );
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    setParsedProps(null);
    setSelected(new Set());
    setFetchError(null);
    importPropsMutation.mutate(
      { gameId, data: { text: pasteText.trim() } },
      {
        onSuccess,
        onError: () => {
          setFetchError("Could not extract props from the pasted text. Try adjusting the input.");
        },
      }
    );
  };

  const toggleAll = () => {
    if (!parsedProps) return;
    setSelected(selected.size === parsedProps.length ? new Set() : new Set(parsedProps.map((_, i) => i)));
  };

  const toggleOne = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleImport = async () => {
    if (!parsedProps || selected.size === 0) return;
    setImporting(true);

    const toImport = [...selected].sort((a, b) => a - b).map((i) => parsedProps[i]);
    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const prop = toImport[i];
      try {
        await new Promise<void>((resolve, reject) => {
          createProp.mutate(
            { gameId, data: { question: prop.question, type: prop.type, threshold: prop.threshold ?? undefined, order: existingCount + i } },
            { onSuccess: () => { successCount++; resolve(); }, onError: reject }
          );
        });
      } catch { /* continue */ }
    }

    await queryClient.invalidateQueries({ queryKey: getListPropsQueryKey(gameId) });
    setImporting(false);
    toast.success(`Imported ${successCount} of ${toImport.length} props!`);
    handleOpenChange(false);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setParsedProps(null);
      setUrl("");
      setPasteText("");
      setSelected(new Set());
      setFetchError(null);
      setTab("url");
    }
  };

  const switchToPaste = (e: React.MouseEvent) => {
    e.preventDefault();
    setTab("paste");
    setParsedProps(null);
    setFetchError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-bold gap-2">
          <Download className="w-4 h-4" />
          Import from URL
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="font-black uppercase tracking-wider">Import Props</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden px-6 py-4 gap-4">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "url" | "paste"); setParsedProps(null); setFetchError(null); setSelected(new Set()); }}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1 font-bold gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> From URL
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1 font-bold gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Paste Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Paste a link to a prop bet sheet. Works best with standard HTML sites (blogs, WordPress, etc.).
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/prop-bets"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                  disabled={isPending}
                  className="flex-1"
                />
                <Button onClick={handleFetchUrl} disabled={!url.trim() || isPending} className="font-bold gap-2 shrink-0">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {isPending ? "Fetching..." : "Fetch"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Open the prop sheet in your browser, select all text (Ctrl+A / Cmd+A), copy it, and paste it below. Works for any site including Google Sites.
              </p>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-wider">Prop Bet Sheet Text</Label>
                <Textarea
                  placeholder="Paste the full text of your prop bet sheet here..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={isPending}
                  rows={6}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <Button onClick={handleParsePaste} disabled={!pasteText.trim() || isPending} className="w-full font-bold gap-2">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {isPending ? "Extracting props with AI..." : "Extract Props"}
              </Button>
            </TabsContent>
          </Tabs>

          {isPending && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <p className="text-xs text-muted-foreground text-center font-medium">AI is reading and extracting prop bets...</p>
            </div>
          )}

          {fetchError && !isPending && (
            <div className="flex items-start gap-2 text-destructive text-sm font-medium p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fetchError}</span>
            </div>
          )}

          {parsedProps !== null && !isPending && parsedProps.length === 0 && (
            <div className="flex items-start gap-2 text-amber-700 text-sm font-medium p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                No props detected. This site may load content dynamically (like Google Sites).{" "}
                <button className="underline font-bold" onClick={switchToPaste}>
                  Try the Paste Text tab
                </button>{" "}
                — copy the text from the page and paste it here.
              </span>
            </div>
          )}

          {parsedProps !== null && parsedProps.length > 0 && !isPending && (
            <div className="flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{parsedProps.length} props found</p>
                  {sourceTitle && <p className="text-xs text-muted-foreground truncate max-w-xs">{sourceTitle}</p>}
                </div>
                <button onClick={toggleAll} className="text-xs font-bold text-primary underline underline-offset-2">
                  {selected.size === parsedProps.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="overflow-y-auto border rounded-lg divide-y max-h-64">
                {parsedProps.map((prop, i) => (
                  <label key={i} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleOne(i)} className="mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{prop.question}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {prop.type === "yes_no" ? "Yes / No" : "Over / Under"}
                        </Badge>
                        {prop.threshold != null && (
                          <Badge variant="outline" className="text-xs">Line: {prop.threshold}</Badge>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {parsedProps !== null && parsedProps.length > 0 && (
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={selected.size === 0 || importing} className="font-bold gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {importing ? "Importing..." : `Import ${selected.size} Prop${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
