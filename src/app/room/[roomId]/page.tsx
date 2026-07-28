"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import HandDeck from "@/components/HandDeck";
import JoinModal from "@/components/JoinModal";
import PokerTable from "@/components/PokerTable";
import TopBar from "@/components/TopBar";
import { getDeck } from "@/config/decks";
import { ROOM_CONFIG } from "@/config/room";
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

  const { players, revealed, showResults, story, myVote, connected, canControl, vote, reveal, reset, setStory } =
    useRoom(roomId, me);

  const join = (data: { name: string; role: PlayerRole; avatarSeed: string }) => {
    const identity: Identity = { ...data, id: crypto.randomUUID(), joinedAt: Date.now() };
    sessionStorage.setItem(`pp:${roomId}`, JSON.stringify(identity));
    setMe(identity);
  };

  const deck = getDeck(ROOM_CONFIG.deckId);
  const room: RoomState = useMemo(
    () => ({ id: roomId, name: ROOM_CONFIG.name, deckId: ROOM_CONFIG.deckId, story, revealed, players }),
    [roomId, story, revealed, players]
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

      {ready && !me && <JoinModal roomName={ROOM_CONFIG.name} onJoin={join} />}
    </main>
  );
}
