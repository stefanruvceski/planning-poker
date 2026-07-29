import Lobby from "@/components/Lobby";

/**
 * Rendered on demand, not prerendered at build: the lobby subscribes to Supabase
 * for its live head counts, and the Supabase client refuses to load without its
 * env vars - which a static build step does not have. The room route is dynamic
 * for the same reason.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  return <Lobby />;
}
