import { haptic } from "../tg";
import { showToast } from "../state";

// Витрина игр. Логика всех игр уже работает на сервере, экраны подключаются во второй части интерфейса.
const GAMES = [
  { emoji: "📈", name: "Краш", desc: "Забери ставку до взрыва" },
  { emoji: "⬆️", name: "Апгрейд", desc: "Подарок → подарок дороже" },
  { emoji: "📜", name: "Контракт", desc: "3–10 подарков → один" },
  { emoji: "💣", name: "Мины", desc: "Открывай клетки, не взорвись" },
  { emoji: "🎡", name: "Колесо", desc: "Три уровня риска" },
  { emoji: "🔻", name: "Плинко", desc: "Шарик и множители" },
  { emoji: "🪙", name: "Монетка", desc: "Орёл или решка, ×1.92" },
  { emoji: "🏆", name: "Джекпот", desc: "Банк подарков на всех" },
  { emoji: "⚔️", name: "Битвы кейсов", desc: "Кто выбьет дороже" },
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
              showToast("Экран игры появится в следующем обновлении");
            }}
          >
            <span class="soon">скоро</span>
            <div class="emoji">{g.emoji}</div>
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
