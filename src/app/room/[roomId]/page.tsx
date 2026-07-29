"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import HandDeck from "@/components/HandDeck";
import JoinModal from "@/components/JoinModal";
import PokerTable from "@/components/PokerTable";
import TopBar from "@/components/TopBar";
import { DEFAULT_DECK_ID, getDeck, isDeckId } from "@/config/decks";
import { roomLabel } from "@/config/room";
import { rememberRoom } from "@/lib/lastRoom";
import type { PlayerRole, RoomState } from "@/lib/types";
import { useRoom, type Identity } from "@/lib/useRoom";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId ?? "default";

  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false); // sessionStorage read, avoids a modal flash

  // Identity lives per tab, so a refresh keeps your seat but a second tab is a second player.
  useEffect(() => {
    const raw = sessionStorage.getItem(`pp:${roomId}`);
    if (raw) setMe(JSON.parse(raw) as Identity);
    setReady(true);
  }, [roomId]);

  // Remember this table so the lobby can offer a one-click way back to it.
  useEffect(() => {
    rememberRoom(roomId);
  }, [roomId]);

  // Which deck this table plays with. It rides in on ?deck= (put there by the
  // lobby's create form and carried in the invite link), then sticks per room
  // in sessionStorage so a refresh or a manually typed URL keeps it.
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  useEffect(() => {
    const storeKey = `pp:${roomId}:deck`;
    const fromUrl = new URLSearchParams(window.location.search).get("deck");
    const fromStore = sessionStorage.getItem(storeKey);
    const chosen = isDeckId(fromUrl) ? fromUrl : isDeckId(fromStore) ? fromStore : DEFAULT_DECK_ID;
    setDeckId(chosen);
    sessionStorage.setItem(storeKey, chosen);
  }, [roomId]);

  const deck = getDeck(deckId);
  const displayName = roomLabel(roomId);
  const { players, revealed, showResults, story, myVote, connected, canControl, facilitatorId, winnerIds, vote, reveal, reset, setStory } =
    useRoom(roomId, me, deck);

  const join = (data: { name: string; role: PlayerRole; avatarSeed: string }) => {
    const identity: Identity = { ...data, id: crypto.randomUUID(), joinedAt: Date.now() };
    sessionStorage.setItem(`pp:${roomId}`, JSON.stringify(identity));
    setMe(identity);
  };

  const room: RoomState = useMemo(
    () => ({ id: roomId, name: displayName, deckId, story, revealed, players }),
    [roomId, displayName, deckId, story, revealed, players]
  );

  return (
    <main className="flex h-screen flex-col">
      <TopBar roomName={room.name} deckName={deck.name} playerCount={players.length} connected={connected} />

      {/* Padding leaves room for the seats that hang over the table edge */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-16 pb-10 pt-12">
        <PokerTable
          room={room}
          meId={me?.id ?? ""}
          canControl={canControl}
          showResults={showResults}
          facilitatorId={facilitatorId}
          winnerIds={winnerIds}
          onReveal={reveal}
          onReset={reset}
          onStory={setStory}
        />
      </div>

      <HandDeck
        deck={deck}
        myVote={myVote}
        disabled={revealed || !connected}
        spectator={me?.role === "spectator"}
        onPick={vote}
      />

      {ready && !me && <JoinModal roomName={displayName} onJoin={join} />}
    </main>
  );
}
