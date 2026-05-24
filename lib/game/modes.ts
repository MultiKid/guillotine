export type GameMode = "local" | "online";

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
    setupDescription: "One-computer pass-and-play mode. Works offline and keeps the pass screen.",
    badge: "Offline pass-and-play",
  },
  {
    id: "online",
    title: "Online Mode",
    buttonLabel: "Play Online",
    setupTitle: "Online Game Setup",
    setupDescription: "Private online rooms for friends or family playing on separate devices.",
    badge: "Future server-owned game",
  },
];

export function getGameModeConfig(mode: GameMode): GameModeConfig {
  return GAME_MODE_CONFIGS.find((config) => config.id === mode) ?? GAME_MODE_CONFIGS[0];
}
