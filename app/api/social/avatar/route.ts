import { NextRequest, NextResponse } from "next/server";

// Per-platform fetch strategies tried in order.
// All run server-side so there are no CORS restrictions.
async function fetchAvatar(platform: string, handle: string): Promise<Response | null> {
  const enc = encodeURIComponent(handle);

  const strategies: (() => Promise<Response>)[] = [];

  if (platform === "instagram") {
    // Instagram's internal web profile endpoint — works without auth in many regions
    strategies.push(() =>
      fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${enc}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/314.0.0.0.28",
          "x-ig-app-id": "936619743392459",
          "Accept": "application/json",
        },
      }).then(async (r) => {
        if (!r.ok) throw new Error("ig_api_fail");
        const json = await r.json();
        const picUrl: string | undefined = json?.data?.user?.profile_pic_url_hd ?? json?.data?.user?.profile_pic_url;
        if (!picUrl) throw new Error("no_pic");
        return fetch(picUrl);
      })
    );
    // Fallback: unavatar (server-side, no CORS issue)
    strategies.push(() => fetch(`https://unavatar.io/instagram/${enc}`));
  } else if (platform === "facebook" || platform === "messenger") {
    // Facebook Graph public picture endpoint
    strategies.push(() =>
      fetch(`https://graph.facebook.com/${enc}/picture?type=large&width=200&height=200&redirect=false`)
        .then(async (r) => {
          if (!r.ok) throw new Error("fb_fail");
          const json = await r.json();
          const url: string | undefined = json?.data?.url;
          if (!url) throw new Error("no_url");
          return fetch(url);
        })
    );
    strategies.push(() => fetch(`https://unavatar.io/facebook/${enc}`));
  } else if (platform === "twitter") {
    strategies.push(() => fetch(`https://unavatar.io/x/${enc}`));
    strategies.push(() => fetch(`https://unavatar.io/twitter/${enc}`));
  } else if (platform === "linkedin") {
    strategies.push(() => fetch(`https://unavatar.io/linkedin/${enc}`));
  } else {
    // whatsapp or unknown — no public avatar source
    return null;
  }

  for (const strategy of strategies) {
    try {
      const res = await strategy();
      if (res.ok && res.headers.get("content-type")?.startsWith("image/")) return res;
    } catch {
      // try next
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const platform = searchParams.get("platform") ?? "";
  const handle = searchParams.get("handle") ?? "";

  if (!platform || !handle || handle.length < 2) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const img = await fetchAvatar(platform, handle);
    if (!img) return new NextResponse(null, { status: 404 });

    const contentType = img.headers.get("content-type") ?? "image/jpeg";
    const buffer = await img.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
