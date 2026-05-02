import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteQrDialogProps {
  gameId: number;
  gameName: string;
  variant?: "default" | "ghost" | "outline" | "glass";
  size?: "sm" | "default";
}

export function InviteQrDialog({ gameId, gameName, variant = "default", size = "default" }: InviteQrDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const inviteUrl = `${window.location.origin}/games/${gameId}/join`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      toast({ title: "Invite link copied!" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const glassClass =
    "inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider bg-white/15 hover:bg-white/25 text-white transition-colors px-4 py-2 rounded-md h-10";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === "glass" ? (
          <button className={glassClass}>
            <QrCode className="w-4 h-4" />
            QR Code
          </button>
        ) : (
          <Button variant={variant === "default" ? "outline" : variant} size={size} className="font-bold gap-2">
            <QrCode className="w-4 h-4" />
            {size === "sm" ? "QR Code" : "Show QR Code"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-wider text-center">
            Scan to Join
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          <p className="text-sm text-muted-foreground font-medium text-center">
            {gameName}
          </p>

          <div className="p-4 bg-white rounded-2xl shadow-md border">
            <QRCodeSVG
              value={inviteUrl}
              size={220}
              level="M"
              includeMargin={false}
              fgColor="#0f172a"
            />
          </div>

          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center font-bold uppercase tracking-wider">
              Or share the link
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border text-xs font-mono break-all text-muted-foreground">
              <span className="flex-1 truncate">{inviteUrl}</span>
            </div>
            <Button onClick={handleCopy} className="w-full font-bold gap-2" variant="outline">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
