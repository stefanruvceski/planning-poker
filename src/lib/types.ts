export type PlayerRole = "player" | "spectator";

export interface Player {
  /** Stable session id (later: userId from Supabase Auth) */
  id: string;
  name: string;
  /** DiceBear avatar seed - deterministic, same seed = same avatar */
  avatarSeed: string;
  role: PlayerRole;
  /** Visible to everyone before the reveal - only "has voted or not" */
  hasVoted: boolean;
  /** Null until cards are revealed - the value is never broadcast before that */
  vote: string | null;
  isHost?: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  deckId: string;
  revealed: boolean;
  players: Player[];
  /** Current story/task - extensible later into a backlog of issues */
  story?: string;
}
