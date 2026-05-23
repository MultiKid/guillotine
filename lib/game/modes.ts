export type GameMode = "local" | "online" | "hostPhones";

export type GameModeConfig = {
  id: GameMode;
  title: string;
  buttonLabel: string;
  setupTitle: string;
  setupDescription: string;
  badge: string;
};

export const GAME_MODE_CONFIGS: GameModeConfig[] = [
  {
    id: "local",
    title: "Local Mode",
    buttonLabel: "Play Local",
    setupTitle: "Local Game Setup",
    setupDescription: "Existing one-computer pass-and-play mode. Works offline and keeps the pass screen.",
    badge: "Offline pass-and-play",
  },
  {
    id: "online",
    title: "Online Mode",
    buttonLabel: "Play Online",
    setupTitle: "Online Game Setup",
    setupDescription: "Future private multiplayer mode. For now, this runs the same local gameplay duplicate.",
    badge: "Future server-owned game",
  },
  {
    id: "hostPhones",
    title: "Host Screen + Phones",
    buttonLabel: "Host Screen + Phones",
    setupTitle: "Host Screen Setup",
    setupDescription: "Future public display with phones as private controllers. For now, this runs local gameplay.",
    badge: "Future shared-screen mode",
  },
];

export function getGameModeConfig(mode: GameMode): GameModeConfig {
  return GAME_MODE_CONFIGS.find((config) => config.id === mode) ?? GAME_MODE_CONFIGS[0];
}
