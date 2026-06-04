import { NextResponse } from "next/server";

const STEAM_STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(STEAM_STORE_SEARCH_URL);
  url.searchParams.set("term", q);
  url.searchParams.set("cc", "br");
  url.searchParams.set("l", "brazilian");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DLC-Radar-Web/0.1",
      },
      next: {
        revalidate: 60 * 60,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Steam Store respondeu com status ${response.status}` },
        { status: 502 }
      );
    }

    const payload = await response.json();

    const results = (payload.items || [])
      .filter((item) => item?.id && item?.name && (!item.type || item.type === "app"))
      .slice(0, 30)
      .map((item) => ({
        appid: Number(item.id),
        name: item.name,
        tinyImage: item.tiny_image || null,
        price: item.price?.final || item.price?.final_formatted || null,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao buscar na Steam Store.", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
