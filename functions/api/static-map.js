export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("mode");

  const clientId = context.env.NAVER_CLIENT_ID;
  const clientSecret = context.env.NAVER_CLIENT_SECRET;

  if (!clientId) {
    return json({ ok: false, error: "NAVER_CLIENT_ID is missing" }, 500);
  }

  if (mode === "config") {
    return json({
      ok: true,
      clientId,
    });
  }

  if (!clientSecret) {
    return json({ ok: false, error: "NAVER_CLIENT_SECRET is missing" }, 500);
  }

  const allowed = new Set(["center", "level", "w", "h", "maptype", "format", "scale", "markers"]);
  const upstreamParams = new URLSearchParams();

  for (const [key, value] of url.searchParams.entries()) {
    if (allowed.has(key)) {
      upstreamParams.set(key, value);
    }
  }

  if (!upstreamParams.get("center")) {
    return json({ ok: false, error: "center is required" }, 400);
  }

  if (!upstreamParams.get("w")) upstreamParams.set("w", "1080");
  if (!upstreamParams.get("h")) upstreamParams.set("h", "720");
  if (!upstreamParams.get("format")) upstreamParams.set("format", "jpg");
  if (!upstreamParams.get("level")) upstreamParams.set("level", "16");
  if (!upstreamParams.get("maptype")) upstreamParams.set("maptype", "basic");
  if (!upstreamParams.get("scale")) upstreamParams.set("scale", "2");

  const upstreamUrl = `https://maps.apigw.ntruss.com/map-static/v2/raster?${upstreamParams.toString()}`;

  const response = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return json(
      {
        ok: false,
        error: "static map upstream error",
        status: response.status,
        detail: text,
      },
      response.status
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=60");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: 200,
    headers,
  });
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
