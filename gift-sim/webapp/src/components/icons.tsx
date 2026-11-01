// Растровые иконки из public/icons и public/fx (нарезаны из сгенерированных листов, прозрачный фон).

const BASE = "./";

export function Ico({ name, size = 24, class: cls = "", alt = "" }: { name: string; size?: number; class?: string; alt?: string }) {
  return (
    <img
      class={`ico ${cls}`}
      src={`${BASE}${name.includes("/") ? name : `icons/${name}`}.webp`}
      style={{ width: size, height: size }}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}

// Валюта — золотая монета со звездой. Без size подстраивается под размер шрифта (1.15em).
export function Star({ size }: { size?: number }) {
  return (
    <img
      class={size ? "star" : "star em"}
      src={`${BASE}icons/star.webp`}
      style={size ? { width: size, height: size } : undefined}
      alt="★"
      draggable={false}
      decoding="async"
    />
  );
}

export function KeyIcon({ size = 16 }: { size?: number }) {
  return <Ico name="key" size={size} alt="ключ" />;
}

export type TabIcon = "home" | "games" | "inventory" | "profile";
