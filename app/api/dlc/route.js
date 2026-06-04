import { NextResponse } from "next/server";

const STEAM_APP_DETAILS_URL = "https://store.steampowered.com/api/appdetails";

async function fetchAppDetails(appid) {
  const url = new URL(STEAM_APP_DETAILS_URL);
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("cc", "br");
  url.searchParams.set("l", "brazilian");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "DLC-Radar-Web/0.1",
    },
    next: {
      revalidate: 60 * 60,
    },
  });

  if (!response.ok) {
    throw new Error(`Steam appdetails status ${response.status}`);
  }

  const payload = await response.json();
  const item = payload[String(appid)];

  if (!item || !item.success) {
    return null;
  }

  return item.data || null;
}

function normalizeDlc(appid, details) {
  const priceOverview = details?.price_overview || {};
  const release = details?.release_date || {};

  return {
    appid: Number(appid),
    name: details?.name || `DLC ${appid}`,
    releaseDate: release?.date || null,
    comingSoon: Boolean(release?.coming_soon),
    isFree: typeof details?.is_free === "boolean" ? details.is_free : null,
    price: priceOverview?.final_formatted || priceOverview?.initial_formatted || null,
    steamUrl: `https://store.steampowered.com/app/${appid}`,
    headerImage: details?.header_image || null,
  };
}

async function fetchInBatches(ids, batchSize = 8) {
  const output = [];

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const details = await fetchAppDetails(id);
        return normalizeDlc(id, details);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        output.push(result.value);
      }
    }
  }

  return output;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const appid = Number(searchParams.get("appid"));

  if (!appid || Number.isNaN(appid)) {
    return NextResponse.json({ error: "AppID inválido." }, { status: 400 });
  }

  try {
    const parentDetails = await fetchAppDetails(appid);

    if (!parentDetails) {
      return NextResponse.json({ error: "Jogo não encontrado na Steam." }, { status: 404 });
    }

    const rawDlcIds = Array.isArray(parentDetails.dlc) ? parentDetails.dlc : [];
    const dlcIds = [...new Set(rawDlcIds.map(Number).filter(Boolean))];

    // Evita timeout em jogos com quantidade absurda de DLCs.
    // Dá para aumentar depois, dependendo do provedor de deploy.
    const maxDlcDetails = 100;
    const limitedIds = dlcIds.slice(0, maxDlcDetails);

    const dlcs = await fetchInBatches(limitedIds);

    return NextResponse.json({
      game: {
        appid,
        name: parentDetails.name || `Jogo ${appid}`,
        steamUrl: `https://store.steampowered.com/app/${appid}`,
        headerImage: parentDetails.header_image || null,
      },
      totalDlcIds: dlcIds.length,
      returnedDlcCount: dlcs.length,
      truncated: dlcIds.length > maxDlcDetails,
      dlcs,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao consultar DLCs na Steam.", details: String(error?.message || error) },
      { status: 500 }
    );
  }
}
