"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { randomSeed } from "@/config/avatars";
import { supabase } from "./supabase";

/** A tenant: one company's brand, straight from the `brands` table. */
export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  teams: string[];
}

/** The signed-in user's profile row. */
export interface Profile {
  user_id: string;
  brand_id: string | null;
  display_name: string | null;
  avatar_seed: string | null;
}

interface TenantValue {
  session: Session;
  brand: Brand;
  profile: Profile;
  /** Update my display name / avatar (persists to the profiles table). */
  updateProfile: (patch: { display_name?: string; avatar_seed?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<TenantValue | null>(null);

/** Read the resolved tenant inside anything the provider wraps. */
export function useTenant(): TenantValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}

type Phase =
  | { step: "loading" }
  | { step: "signedOut" }
  | { step: "notInvited"; email: string }
  | { step: "ready"; brand: Brand; profile: Profile };

/**
 * Gates the whole app behind a magic-link login and resolves the caller's brand.
 * Renders the login screen, a "not invited" notice, or - once a brand is known -
 * its children with the tenant in context. Login is required for everyone; the
 * brand comes from the account (the email's invite), never from the URL.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ step: "loading" });

  // Track the auth session (and the magic-link one detected on the URL).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Once signed in, make sure a profile exists (binding the email to its brand)
  // and load that brand.
  useEffect(() => {
    if (session === undefined) return; // still checking
    if (session === null) {
      setPhase({ step: "signedOut" });
      return;
    }
    let cancelled = false;
    (async () => {
      const email = session.user.email ?? "";
      const fallbackName = email.split("@")[0] || "Player";
      const { data: brandId, error } = await supabase.rpc("bootstrap_profile", {
        p_display_name: fallbackName,
        p_avatar_seed: randomSeed(),
      });
      if (cancelled) return;
      if (error || !brandId) {
        setPhase({ step: "notInvited", email });
        return;
      }
      const [{ data: brand }, { data: profile }] = await Promise.all([
        supabase.from("brands").select("id, name, logo_url, teams").eq("id", brandId).maybeSingle(),
        supabase.from("profiles").select("user_id, brand_id, display_name, avatar_seed").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (!brand || !profile) {
        setPhase({ step: "notInvited", email });
        return;
      }
      setPhase({ step: "ready", brand: brand as Brand, profile: profile as Profile });
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar_seed?: string }) => {
      if (!session) return;
      await supabase.from("profiles").update(patch).eq("user_id", session.user.id);
      setPhase((p) => (p.step === "ready" ? { ...p, profile: { ...p.profile, ...patch } } : p));
    },
    [session]
  );

  if (phase.step === "loading") return <Splash>Loading…</Splash>;
  if (phase.step === "signedOut") return <LoginScreen />;
  if (phase.step === "notInvited") return <NotInvited email={phase.email} onSignOut={signOut} />;

  return (
    <Ctx.Provider value={{ session: session!, brand: phase.brand, profile: phase.profile, updateProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-[100dvh] items-center justify-center text-sm text-white/50">{children}</main>
  );
}

/**
 * Login: enter an email, then either click the link OR type the 6-digit code
 * from the same email. The code path matters because corporate mail scanners
 * (Outlook / Microsoft Safe Links) pre-open the magic link and burn the
 * one-time token before the user clicks - a typed code can't be consumed that
 * way, so it works where the link doesn't.
 */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    setBusy(true);
    setError(null);
    // On success onAuthStateChange fires and the provider takes over.
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <main className="flex h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] p-6 text-center shadow-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="text-red-500">planning</span>
          <span className="text-white">poker</span>
        </h1>
        {sent ? (
          <>
            <p className="mt-6 text-sm text-white/70">
              We sent a link and a 6-digit code to <span className="font-semibold text-white">{email}</span>.
              Click the link, or enter the code:
            </p>
            <form onSubmit={verify} className="mt-4 flex flex-col gap-3">
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-gold"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="w-full rounded-lg bg-gold py-3 font-extrabold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                {busy ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                onClick={() => { setSent(false); setCode(""); setError(null); }}
                className="text-xs text-white/45 underline transition hover:text-white"
              >
                use a different email
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={send} className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-white/50">Sign in with your work email.</p>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center outline-none focus:border-gold"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full rounded-lg bg-gold py-3 font-extrabold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send sign-in email"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

/** Signed in, but the email isn't on any brand's invite list. */
function NotInvited({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] p-6 shadow-2xl">
        <h2 className="text-lg font-extrabold">No table yet</h2>
        <p className="mt-2 text-sm text-white/60">
          <span className="text-white">{email}</span> isn&rsquo;t on a team&rsquo;s invite list. Ask
          your admin to add you, then sign in again.
        </p>
        <button
          onClick={onSignOut}
          className="mt-5 rounded-lg bg-black/40 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-black/60"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
