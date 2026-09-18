import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getAccess, listModels, type CatalogSort } from "@/lib/queries";

const SORTS: CatalogSort[] = ["featured", "price-asc", "price-desc", "newest", "rating"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort") as CatalogSort | null;

  const result = listModels({
    page: Number(url.searchParams.get("page") ?? 1) || 1,
    pageSize: Number(url.searchParams.get("pageSize") ?? 9) || 9,
    search: url.searchParams.get("q") ?? undefined,
    sort: sortParam && SORTS.includes(sortParam) ? sortParam : "featured",
    onlineOnly: url.searchParams.get("online") === "1",
  });

  const user = await getSessionUser();
  const items =
    user?.role === "user"
      ? result.items.map((item) => ({ ...item, access: getAccess(user.id, item.id).status }))
      : result.items;

  return json({ ...result, items });
}
