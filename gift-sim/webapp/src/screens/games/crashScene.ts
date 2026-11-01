// Сцена краша на canvas: звёзды навстречу, сетка множителей, светящаяся кривая,
// ракета с огненным шлейфом и дымом, взрыв с обломками и ударной волной.

const sprite = (src: string) => { const i = new Image(); i.src = src; return i; };
const ROCKET = sprite("./fx/rocket.webp");
const EXPLOSION = sprite("./fx/explosion.webp");
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; grow: number; kind: "flame" | "smoke" | "spark" | "debris"; hue: number };
type SpeedStar = { x: number; y: number; z: number };

export type SceneInput = {
  phase: "betting" | "running" | "crashed";
  rate: number;
  t: number;          // секунды полёта (для running), для crashed — момент взрыва
  mult: number;       // текущий / итоговый множитель
  roundId: number;
};

export class CrashScene {
  private parts: Particle[] = [];
  private stars: SpeedStar[] = [];
  private last = 0;
  private boomRound = -1;
  private boomAt = 0;
  private boomX = 0;
  private boomY = 0;
  private spawnAcc = 0;

  constructor() {
    for (let i = 0; i < 46; i++) this.stars.push({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75 });
  }

  draw(c: HTMLCanvasElement, s: SceneInput) {
    const now = performance.now();
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;

    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const running = s.phase === "running", crashed = s.phase === "crashed";
    const tEnd = s.phase === "betting" ? 0 : crashed ? Math.log(Math.max(1, s.mult)) / s.rate : s.t;
    const L = 16, R = 46, T = 26, B = 20;
    const tMax = Math.max(8, tEnd * 1.12);
    const mMax = Math.max(1.8, s.mult * 1.14 + 0.05);
    const x = (tt: number) => L + (tt / tMax) * (W - L - R);
    const y = (m: number) => H - B - ((m - 1) / (mMax - 1)) * (H - T - B);

    this.drawStars(g, W, H, dt, running ? 0.35 + Math.log(Math.max(1, s.mult)) * 0.6 : crashed ? 0.04 : 0.08);
    this.drawGrid(g, W, H, mMax, y, R);

    // ---------------------------------------------------------------- кривая
    const tip = { x: x(tEnd), y: y(Math.exp(s.rate * tEnd)) };
    if (s.phase !== "betting") {
      const col = crashed ? ["#ff7a8a", "#ff2d55"] : endColors(s.mult);
      const path = new Path2D();
      path.moveTo(x(0), y(1));
      const N = 90;
      for (let i = 1; i <= N; i++) { const tt = (tEnd * i) / N; path.lineTo(x(tt), y(Math.exp(s.rate * tt))); }

      // заливка под кривой
      const area = new Path2D(path);
      area.lineTo(tip.x, H - B);
      area.lineTo(x(0), H - B);
      area.closePath();
      const fill = g.createLinearGradient(0, tip.y, 0, H - B);
      fill.addColorStop(0, hexA(col[1], 0.32));
      fill.addColorStop(1, hexA(col[1], 0));
      g.fillStyle = fill;
      g.fill(area);

      const stroke = g.createLinearGradient(x(0), 0, Math.max(x(0) + 1, tip.x), 0);
      stroke.addColorStop(0, crashed ? "#ff9aa6" : "#3d9bff");
      stroke.addColorStop(0.55, col[0]);
      stroke.addColorStop(1, col[1]);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.save();
      g.shadowColor = col[1];
      g.shadowBlur = 18;
      g.globalAlpha = 0.35;
      g.lineWidth = 10;
      g.strokeStyle = stroke;
      g.stroke(path);
      g.restore();
      g.lineWidth = 3.5;
      g.strokeStyle = stroke;
      g.stroke(path);
    }

    // ---------------------------------------------------------------- ракета и частицы
    const rocketPos = s.phase === "betting" ? { x: x(0) + 26, y: H - B - 22 } : tip;
    let dir = { x: 0.7071, y: -0.7071 };
    if (running) {
      const dtt = Math.max(tEnd, 0.05) * 0.02;
      const px = x(tEnd - dtt), py = y(Math.exp(s.rate * (tEnd - dtt)));
      const len = Math.hypot(tip.x - px, tip.y - py) || 1;
      dir = { x: (tip.x - px) / len, y: (tip.y - py) / len };
    }

    if (crashed && this.boomRound !== s.roundId) {
      this.boomRound = s.roundId;
      this.boomAt = now;
      this.boomX = tip.x;
      this.boomY = tip.y;
      this.burst(tip.x, tip.y);
    }

    if (!crashed) this.emit(rocketPos, dir, dt, running ? 1 : 0.35);
    this.updateParticles(g, dt);

    if (crashed) {
      this.drawExplosion(g, now);
    } else if (ready(ROCKET)) {
      const wob = Math.sin(now / 85) * 0.035 + (running ? Math.sin(now / 37) * 0.012 : 0);
      const ang = Math.atan2(dir.y, dir.x) + Math.PI / 4 + wob; // на картинке нос смотрит вверх-вправо (−45°)
      const sz = 48, ratio = ROCKET.naturalHeight / ROCKET.naturalWidth;
      // тёплое свечение вокруг ракеты
      const glow = g.createRadialGradient(rocketPos.x, rocketPos.y, 0, rocketPos.x, rocketPos.y, 42);
      glow.addColorStop(0, "rgba(255,190,90,0.35)");
      glow.addColorStop(1, "rgba(255,190,90,0)");
      g.fillStyle = glow;
      g.fillRect(rocketPos.x - 42, rocketPos.y - 42, 84, 84);
      g.save();
      g.translate(rocketPos.x, rocketPos.y);
      g.rotate(ang);
      g.drawImage(ROCKET, -sz * 0.62, -sz * ratio * 0.38, sz, sz * ratio);
      g.restore();
    }
  }

  // ---------------------------------------------------------------- части сцены

  private drawStars(g: CanvasRenderingContext2D, W: number, H: number, dt: number, speed: number) {
    for (const st of this.stars) {
      st.x -= speed * st.z * dt * 0.55;
      st.y += speed * st.z * dt * 0.28;
      if (st.x < -0.02) { st.x = 1.02; st.y = Math.random(); }
      if (st.y > 1.02) { st.y = -0.02; st.x = Math.random(); }
      const len = Math.min(18, speed * st.z * 9);
      g.strokeStyle = `rgba(210,225,255,${0.25 + st.z * 0.55})`;
      g.lineWidth = st.z * 1.6;
      g.beginPath();
      g.moveTo(st.x * W, st.y * H);
      g.lineTo(st.x * W + len, st.y * H - len * 0.5);
      g.stroke();
    }
  }

  private drawGrid(g: CanvasRenderingContext2D, W: number, H: number, mMax: number, y: (m: number) => number, R: number) {
    const span = mMax - 1;
    const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    const step = steps.find((v) => span / v <= 4) ?? 1000;
    g.font = "600 10px -apple-system, Roboto, sans-serif";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.setLineDash([3, 5]);
    for (let m = 1 + step; m < mMax; m += step) {
      const yy = y(m);
      g.strokeStyle = "rgba(255,255,255,0.08)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(10, yy);
      g.lineTo(W - R + 4, yy);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.fillText(`×${+m.toFixed(2)}`, W - R + 8, yy);
    }
    g.setLineDash([]);
  }

  private emit(p: { x: number; y: number }, dir: { x: number; y: number }, dt: number, power: number) {
    const tail = { x: p.x - dir.x * 22, y: p.y - dir.y * 22 };
    const perp = { x: -dir.y, y: dir.x };
    this.spawnAcc += dt * 110 * power;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const spread = (Math.random() - 0.5) * 2;
      const sp = 70 + Math.random() * 90;
      this.parts.push({
        x: tail.x + perp.x * spread * 3, y: tail.y + perp.y * spread * 3,
        vx: -dir.x * sp + perp.x * spread * 28, vy: -dir.y * sp + perp.y * spread * 28,
        life: 0, max: 0.28 + Math.random() * 0.3, size: 4 + Math.random() * 3, grow: -6, kind: "flame", hue: 0,
      });
      if (Math.random() < 0.3) {
        this.parts.push({
          x: tail.x, y: tail.y, vx: -dir.x * 30 + (Math.random() - 0.5) * 20, vy: -dir.y * 30 + (Math.random() - 0.5) * 20 - 8,
          life: 0, max: 0.9 + Math.random() * 0.6, size: 3, grow: 12, kind: "smoke", hue: 0,
        });
      }
      if (Math.random() < 0.08) {
        this.parts.push({
          x: tail.x, y: tail.y, vx: -dir.x * 140 + (Math.random() - 0.5) * 90, vy: -dir.y * 140 + (Math.random() - 0.5) * 90,
          life: 0, max: 0.5, size: 1.6, grow: 0, kind: "spark", hue: 0,
        });
      }
    }
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
  }

  private burst(x: number, y: number) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, sp = 70 + Math.random() * 230;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.7 + Math.random() * 0.8,
        size: 1.5 + Math.random() * 3, grow: 0, kind: Math.random() < 0.7 ? "debris" : "spark", hue: Math.random(),
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0, max: 1.4 + Math.random(), size: 8, grow: 22, kind: "smoke", hue: 0 });
    }
  }

  private updateParticles(g: CanvasRenderingContext2D, dt: number) {
    const alive: Particle[] = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (p.kind === "debris" || p.kind === "spark") p.vy += 260 * dt;
      p.vx *= p.kind === "smoke" ? 0.97 : 0.985;
      p.vy *= p.kind === "smoke" ? 0.97 : 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0.3, p.size + p.grow * dt);
      alive.push(p);
    }
    this.parts = alive;

    // дым — обычное наложение, огонь и искры — «свечение»
    for (const p of alive) {
      if (p.kind !== "smoke") continue;
      const k = p.life / p.max;
      g.fillStyle = `rgba(170,160,200,${(1 - k) * 0.22})`;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const p of alive) {
      if (p.kind === "smoke") continue;
      const k = p.life / p.max;
      let color: string;
      if (p.kind === "flame") color = k < 0.25 ? `rgba(255,245,190,${1 - k})` : k < 0.6 ? `rgba(255,170,60,${1 - k})` : `rgba(255,80,50,${(1 - k) * 0.9})`;
      else if (p.kind === "spark") color = `rgba(255,230,150,${1 - k})`;
      else color = p.hue < 0.5 ? `rgba(255,150,50,${1 - k})` : `rgba(255,90,70,${1 - k})`;
      g.fillStyle = color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  private drawExplosion(g: CanvasRenderingContext2D, now: number) {
    const e = (now - this.boomAt) / 1000;
    // ударная волна
    if (e < 0.6) {
      const r = 10 + e * 170;
      g.strokeStyle = `rgba(255,200,120,${0.7 * (1 - e / 0.6)})`;
      g.lineWidth = 3 * (1 - e / 0.6) + 0.5;
      g.beginPath();
      g.arc(this.boomX, this.boomY, r, 0, Math.PI * 2);
      g.stroke();
    }
    if (ready(EXPLOSION)) {
      const k = Math.min(1, e / 0.22);
      const scale = 0.35 + 0.65 * (1 - Math.pow(1 - k, 3)) + Math.sin(now / 120) * 0.02;
      const size = 96 * scale;
      g.save();
      g.globalAlpha = e > 1.4 ? Math.max(0.55, 1 - (e - 1.4)) : 1;
      g.drawImage(EXPLOSION, this.boomX - size / 2, this.boomY - size / 2, size, size);
      g.restore();
    }
  }
}

function endColors(m: number): [string, string] {
  if (m < 1.5) return ["#6f8bff", "#8b6bff"];
  if (m < 2) return ["#8b6bff", "#b46bff"];
  if (m < 5) return ["#b46bff", "#ff6bd5"];
  if (m < 10) return ["#ff9d3d", "#ffcf5a"];
  return ["#ffcf5a", "#ff7a45"];
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
