import { go, type GameId } from "../state";
import { haptic } from "../tg";

const GAMES: { id: GameId; emoji: string; name: string; desc: string; tag?: string }[] /* emoji — запасной вариант */ = [
  { id: "crash", emoji: "📈", name: "Краш", desc: "Успей забрать до взрыва", tag: "онлайн" },
  { id: "battles", emoji: "⚔️", name: "Битвы кейсов", desc: "Дороже дроп — весь банк твой", tag: "PvP" },
  { id: "jackpot", emoji: "🏆", name: "Джекпот", desc: "Общий банк подарков", tag: "PvP" },
  { id: "upgrade", emoji: "⬆️", name: "Апгрейд", desc: "Рискни ради подарка дороже" },
  { id: "contract", emoji: "📜", name: "Контракт", desc: "3–10 подарков в один" },
  { id: "mines", emoji: "💣", name: "Мины", desc: "Открывай клетки, обходи мины" },
  { id: "wheel", emoji: "🎡", name: "Колесо", desc: "Лови множитель" },
  { id: "plinko", emoji: "🔻", name: "Плинко", desc: "Множители до ×164" },
  { id: "coinflip", emoji: "🪙", name: "Монетка", desc: "50/50, выигрыш ×1,92" },
];

export function Games() {
  return (
    <>
      <h1>Игры</h1>
      <div class="games">
        {GAMES.map((g) => (
          <button
            class="game-card glass"
            onClick={() => {
              haptic.tap();
              go({ name: "game", id: g.id });
            }}
          >
            {g.tag && <span class="soon">{g.tag}</span>}
            <img class="game-art" src={`./games/${g.id}.webp`} alt="" width={256} height={256} loading="lazy" draggable={false} />
            <div>
              <b>{g.name}</b>
              <br />
              <span>{g.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
