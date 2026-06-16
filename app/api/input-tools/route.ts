export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") ?? "";
  const itc = searchParams.get("itc") ?? "";

  if (!text || !itc) return Response.json([]);

  try {
    const res = await fetch(
      `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${encodeURIComponent(itc)}&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://www.google.com/",
        },
      }
    );
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json([]);
  }
}
