import { redirect } from "next/navigation";

/** MVP: a single table. The route is already parameterised, so a lobby fits here later. */
export default function Home() {
  redirect("/room/default");
}
