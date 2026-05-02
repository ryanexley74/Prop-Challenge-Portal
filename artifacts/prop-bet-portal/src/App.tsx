import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import GameHub from "@/pages/game-hub";
import JoinGame from "@/pages/join-game";
import AdminPanel from "@/pages/admin-panel";
import TvMode from "@/pages/tv-mode";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/games/:gameId" component={GameHub} />
      <Route path="/games/:gameId/join" component={JoinGame} />
      <Route path="/games/:gameId/admin" component={AdminPanel} />
      <Route path="/games/:gameId/tv" component={TvMode} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;