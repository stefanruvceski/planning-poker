/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode double-invokes effects in dev only. For a realtime app
  // that opens a WebSocket in an effect, that second invoke opens a second
  // socket to the same room, which splits a player's presence and drops their
  // revealed card. Production never double-invokes; turning this off makes dev
  // behave the same - one socket, one presence.
  reactStrictMode: false,
};
export default nextConfig;
