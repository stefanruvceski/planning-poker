"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DebugPanel from "@/components/DebugPanel";
import HandDeck from "@/components/HandDeck";
import JoinModal from "@/components/JoinModal";
import PokerTable from "@/components/PokerTable";
import RecapModal from "@/components/RecapModal";
import TopBar from "@/components/TopBar";
import { cardHotkey, getDeck } from "@/config/decks";
import { roomLabel } from "@/config/room";
import { rememberRoom } from "@/lib/lastRoom";
import type { PlayerRole, RoomState } from "@/lib/types";
import { useRoom, type Identity } from "@/lib/useRoom";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId ?? "default";

  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false); // sessionStorage read, avoids a modal flash
  const [debug, setDebug] = useState(false); // ?debug in the URL turns on the diagnostics panel

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
  }, []);

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

  // The deck is part of the shared room state now (the facilitator can switch
  // it live), so useRoom owns it - it seeds from ?deck= / sessionStorage and
  // then follows the channel.
  const { players, revealed, showResults, story, deckId, deadline, myVote, connected, canControl, facilitatorId, winnerIds, vote, reveal, reset, setStory, setDeck, startTimer, cancelTimer, recap, clearRecap } =
    useRoom(roomId, me);

  const deck = getDeck(deckId);
  const displayName = roomLabel(roomId);
  const [recapOpen, setRecapOpen] = useState(false);

  // Keyboard shortcuts: number keys vote by card position, Enter/Space runs the
  // reveal (facilitator), Esc clears your vote. Same functions the buttons call
  // - nothing new on the wire.
  useEffect(() => {
    if (!me || !connected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      // Don't hijack keys while someone is typing the story.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;

      if (e.key === "Enter" || e.key === " ") {
        if (canControl) {
          e.preventDefault();
          if (revealed) reset();
          else reveal();
        }
        return;
      }
      // Spectators run the table but never vote.
      if (me.role === "spectator") return;
      if (e.key === "Escape") {
        if (myVote) vote(myVote); // toggles the current vote back off
        return;
      }
      if (revealed) return; // voting is closed
      const idx = deck.cards.findIndex((_, i) => cardHotkey(i) === e.key);
      if (idx >= 0) {
        e.preventDefault();
        vote(deck.cards[idx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me, connected, canControl, revealed, myVote, deck, vote, reveal, reset]);

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
    // 100dvh (not 100vh) so the phone's browser bar can't push the hand deck
    // out of view - the column always fits the *visible* viewport.
    <main className="flex h-[100dvh] flex-col">
      <TopBar
        roomName={room.name}
        deckName={deck.name}
        playerCount={players.length}
        connected={connected}
        recapCount={recap.length}
        onShowRecap={() => setRecapOpen(true)}
      />

      {/* Padding leaves room for the seats that hang over the table edge - tight
          on a phone so the table itself gets as much width as possible. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4 pt-6 sm:px-16 sm:pb-10 sm:pt-12">
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
          onDeck={setDeck}
          deadline={deadline}
          onStartTimer={startTimer}
          onCancelTimer={cancelTimer}
        />
      </div>

      <HandDeck
        deck={deck}
        myVote={myVote}
        disabled={revealed || !connected}
        spectator={me?.role === "spectator"}
        onPick={vote}
      />

      {debug && (
        <DebugPanel
          meId={me?.id ?? ""}
          connected={connected}
          revealed={revealed}
          showResults={showResults}
          myVote={myVote}
          canControl={canControl}
          facilitatorId={facilitatorId}
          players={players}
        />
      )}

      {ready && !me && <JoinModal roomName={displayName} onJoin={join} />}

      {recapOpen && (
        <RecapModal
          roomName={displayName}
          entries={recap}
          onClose={() => setRecapOpen(false)}
          onClear={clearRecap}
        />
      )}
    </main>
  );
}
