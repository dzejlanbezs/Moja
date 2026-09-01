import { HeaderBar } from "@/components/header-bar";
import { getSessionUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getSessionUser();
  return <HeaderBar user={user} />;
}
