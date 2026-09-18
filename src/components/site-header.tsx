import { HeaderBar } from "@/components/header-bar";
import { getSessionUser } from "@/lib/auth";
import { brandAssets } from "@/lib/brand";

export async function SiteHeader() {
  const user = await getSessionUser();
  const { logoUrl } = brandAssets();
  return <HeaderBar user={user} logoUrl={logoUrl} />;
}
