import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "./styles.css";
import { api, errorText } from "./api";
import { TabBar, Toast, TopBar } from "./components/ui";
import { CaseScreen } from "./screens/CaseScreen";
import { Games } from "./screens/Games";
import { Home } from "./screens/Home";
import { Inventory } from "./screens/Inventory";
import { Profile } from "./screens/Profile";
import { Player, Top } from "./screens/Top";
import { Crash } from "./screens/games/Crash";
import { Contract, Upgrade } from "./screens/games/GiftGames";
import { Coinflip, Plinko, Wheel } from "./screens/games/Instant";
import { Mines } from "./screens/games/Mines";
import { Battles, Jackpot } from "./screens/games/PvP";

const GAME_SCREENS = { crash: Crash, upgrade: Upgrade, contract: Contract, mines: Mines, wheel: Wheel, plinko: Plinko, coinflip: Coinflip, jackpot: Jackpot, battles: Battles };
import { back, profile, route, showToast } from "./state";
import { initTelegram, setBack, tg } from "./tg";
import type { Profile as P } from "./types";

initTelegram();

function App() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tg?.initData) {
      setError("Игра открывается через бота @FortumDropsBot");
      return;
    }
    api<P>("login")
      .then((p) => {
        profile.value = p;
        if (p.is_new) showToast("+3 000 ★ на старт. Удачи!");
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  const r = route.value;
  useEffect(() => {
    setBack(r.name === "case" || r.name === "game" || r.name === "top" || r.name === "player" ? back : null);
  }, [r.name]);

  if (error) {
    return (
      <div class="splash">
        <div>
          <div class="logo">FORTUM DROPS</div>
          <p class="muted" style={{ marginTop: 12 }}>
            {error}
          </p>
          <a class="btn" style={{ marginTop: 16, textDecoration: "none" }} href="https://t.me/FortumDropsBot">
            Открыть бота
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="app">
      <TopBar />
      {r.name === "home" && <Home />}
      {r.name === "games" && <Games />}
      {r.name === "inventory" && <Inventory />}
      {r.name === "profile" && <Profile />}
      {r.name === "case" && <CaseScreen id={r.id} />}
      {r.name === "top" && <Top />}
      {r.name === "player" && <Player key={r.id} id={r.id} />}
      {r.name === "game" && (() => { const G = GAME_SCREENS[r.id]; return <G key={r.id} />; })()}
      <TabBar />
      <Toast />
    </div>
  );
}

render(<App />, document.getElementById("app")!);
