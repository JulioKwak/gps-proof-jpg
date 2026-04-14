export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");

    const clientId = context.env.NAVER_CLIENT_ID;
    const clientSecret = context.env.NAVER_CLIENT_SECRET;

    if (!lat || !lng) {
      return json({ ok: false, error: "lat and lng are required" }, 400);
    }

    if (!clientId || !clientSecret) {
      return json({ ok: false, error: "NAVER credentials are missing" }, 500);
    }

    const coords = `${lng},${lat}`;
    const upstreamUrl =
      `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${encodeURIComponent(coords)}&output=json&orders=roadaddr,addr`;

    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return json({
        ok: false,
        error: "reverse geocode upstream error",
        detail: data,
      }, response.status);
    }

    const results = Array.isArray(data.results) ? data.results : [];

    const road = results.find((item) => item.name === "roadaddr");
    const jibun = results.find((item) => item.name === "addr");

    return json({
      ok: true,
      roadAddress: formatRoadAddress(road),
      jibunAddress: formatJibunAddress(jibun),
    });
  } catch (error) {
    return json({
      ok: false,
      error: "function crashed",
      detail: error?.message || String(error),
    }, 500);
  }
}

function formatRoadAddress(item) {
  if (!item) return "";

  const region = item.region || {};
  const land = item.land || {};

  return [
    region.area1?.name,
    region.area2?.name,
    region.area3?.name,
    region.area4?.name,
    land.name,
    land.number1,
    land.number2 ? `-${land.number2}` : "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatJibunAddress(item) {
  if (!item) return "";

  const region = item.region || {};
  const land = item.land || {};

  return [
    region.area1?.name,
    region.area2?.name,
    region.area3?.name,
    region.area4?.name,
    land.number1,
    land.number2 ? `-${land.number2}` : "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
