export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) return Response.json({ title: "", image: "", description: "" });

  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return Response.json({ title: q, image: "", description: "" });
    const data = await res.json();

    // DuckDuckGo Image is a relative path like /i/abc.jpg
    const image = data.Image
      ? data.Image.startsWith("http")
        ? data.Image
        : `https://duckduckgo.com${data.Image}`
      : "";

    return Response.json({
      title: data.Heading || q,
      image,
      description: data.AbstractText || "",
    });
  } catch {
    return Response.json({ title: q, image: "", description: "" });
  }
}
