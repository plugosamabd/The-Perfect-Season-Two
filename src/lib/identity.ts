// Stable per-browser player ID + name + dev mode toggle persisted to localStorage.
const ID_KEY = "p820_pid";
const NAME_KEY = "p820_name";
const DEV_KEY = "p820_dev";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_KEY) === "1";
}

export function setDevMode(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) localStorage.setItem(DEV_KEY, "1");
  else localStorage.removeItem(DEV_KEY);
}
