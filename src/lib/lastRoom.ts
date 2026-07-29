/**
 * The last table you sat at, remembered so the lobby can offer a one-click way
 * back. Unlike the per-tab identity, this lives in localStorage: it should
 * survive closing the tab and reopening tomorrow morning.
 */
const LAST_ROOM_KEY = "pp:lastRoom";

export function rememberRoom(roomId: string): void {
  try {
    localStorage.setItem(LAST_ROOM_KEY, roomId);
  } catch {
    // Private mode or a full quota - a missing shortcut is not worth throwing.
  }
}

export function readLastRoom(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY);
  } catch {
    return null;
  }
}
