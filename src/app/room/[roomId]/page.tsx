"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DebugPanel from "@/components/DebugPanel";
import HandDeck from "@/components/HandDeck";
import JoinModal from "@/components/JoinModal";
import PokerTable from "@/components/PokerTable";
import RecapModal from "@/components/RecapModal";
import TopBar from "@/components/TopBar";
import { cardHotkey, getDeck } from "@/config/decks";
import { parseRoomId, roomLabel } from "@/config/room";
import { rememberRoom } from "@/lib/lastRoom";
import { useTenant } from "@/lib/tenant";
import type { PlayerRole, RoomState } from "@/lib/types";
import { useRoom, type Identity } from "@/lib/useRoom";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params?.roomId ?? "";
  const { brand, profile, session, updateProfile } = useTenant();

  // A room is brand-qualified. A link into another brand's room isn't ours to
  // open - send them back to their own lobby.
  const roomBrand = parseRoomId(roomId).brandId;
  useEffect(() => {
    if (roomBrand && roomBrand !== brand.id) router.replace("/");
  }, [roomBrand, brand.id, router]);
  const wrongBrand = roomBrand !== "" && roomBrand !== brand.id;

  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false); // sessionStorage read, avoids a modal flash
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  // The role (player/spectator) is chosen per room and kept for a refresh; the
  // identity itself is the logged-in account, so a second tab is the same seat.
  useEffect(() => {
    const raw = sessionStorage.getItem(`pp:${roomId}`);
    if (raw) setMe(JSON.parse(raw) as Identity);
    setReady(true);
  }, [roomId]);

  useEffect(() => {
    if (!wrongBrand) rememberRoom(roomId);
  }, [roomId, wrongBrand]);

  const { players, revealed, showResults, animateReveal, story, deckId, deadline, myVote, connected, canControl, facilitatorId, winnerIds, dbError, vote, reveal, reset, setStory, setDeck, startTimer, cancelTimer, recap, clearRecap } =
    useRoom(roomId, me, brand.id);

  const deck = getDeck(deckId);
  const displayName = roomLabel(roomId);
  const [recapOpen, setRecapOpen] = useState(false);

  useEffect(() => {
    if (!me || !connected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;

      if (e.key === "Enter" || e.key === " ") {
        if (canControl) {
          e.preventDefault();
          if (revealed) reset();
          else reveal();
        }
        return;
      }
      if (me.role === "spectator") return;
      if (e.key === "Escape") {
        if (myVote) vote(myVote);
        return;
      }
      if (revealed) return;
      const idx = deck.cards.findIndex((_, i) => cardHotkey(i) === e.key);
      if (idx >= 0) {
        e.preventDefault();
        vote(deck.cards[idx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me, connected, canControl, revealed, myVote, deck, vote, reveal, reset]);

  // Joining ties the seat to the account (id = user id). If the name or avatar
  // changed, remember it on the profile so it's the default next time too.
  const join = (data: { name: string; role: PlayerRole; avatarSeed: string }) => {
    const identity: Identity = { ...data, id: session.user.id, joinedAt: Date.now() };
    sessionStorage.setItem(`pp:${roomId}`, JSON.stringify(identity));
    setMe(identity);
    if (data.name !== profile.display_name || data.avatarSeed !== profile.avatar_seed) {
      void updateProfile({ display_name: data.name, avatar_seed: data.avatarSeed });
    }
  };

  const room: RoomState = useMemo(
    () => ({ id: roomId, name: displayName, deckId, story, revealed, players }),
    [roomId, displayName, deckId, story, revealed, players]
  );

  if (wrongBrand) return null; // redirecting to the lobby

  return (
    <main className="flex h-[100dvh] flex-col">
      <TopBar
        brand={brand}
        roomName={room.name}
        deckName={deck.name}
        playerCount={players.length}
        connected={connected}
        recapCount={recap.length}
        onShowRecap={() => setRecapOpen(true)}
      />

      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4 pt-6 sm:px-16 sm:pb-10 sm:pt-12">
        <PokerTable
          room={room}
          brand={brand}
          meId={me?.id ?? ""}
          canControl={canControl}
          showResults={showResults}
          animateReveal={animateReveal}
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
          dbError={dbError}
        />
      )}

      {ready && !me && (
        <JoinModal
          roomName={displayName}
          initialName={profile.display_name ?? ""}
          initialAvatarSeed={profile.avatar_seed ?? ""}
          onJoin={join}
        />
      )}

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
