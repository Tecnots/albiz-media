import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser, unauthorized } from "@/app/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const limit = await rateLimit(`ai:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many AI requests. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured — add ANTHROPIC_API_KEY to .env" }, { status: 503 });
  }

  const { action, title, content, selectedText, tone } = await req.json();

  const plain = (html: string) =>
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  try {
    let prompt = "";

    if (action === "suggest-titles") {
      const preview = plain(content ?? "").substring(0, 600) || title || "";
      prompt = `You are an expert headline writer for a media publication. Based on the article below, generate exactly 5 compelling, distinct headline options. Vary the styles: one question, one how-to or numbered, one bold statement, one curiosity gap, one SEO-optimized. Return ONLY a JSON array of 5 strings with no other text.

Article: ${preview}`;
    } else if (action === "generate-meta") {
      const preview = plain(content ?? "").substring(0, 1200) || title || "";
      prompt = `Write a concise SEO meta description for this article. Requirements: 130–155 characters, includes main keyword naturally, clearly states value to the reader, avoids clickbait. Return ONLY the meta description text, nothing else.

Title: ${title}
Content: ${preview}`;
    } else if (action === "generate-slug") {
      prompt = `Generate a clean, SEO-optimized URL slug for this article title. Rules: all lowercase, hyphens only (no underscores), remove stop words (a, an, the, is, in, of, to, and, for, with), max 6 words, highly descriptive. Return ONLY the slug, nothing else.

Title: ${title}`;
    } else if (action === "improve-text") {
      const instruction =
        tone === "shorten"
          ? "Rewrite this text to be more concise. Cut at least 30% of the word count while keeping every key idea. No filler phrases."
          : tone === "grammar"
          ? "Fix all grammar, spelling, punctuation, and sentence structure issues. Keep the original voice and meaning as close as possible."
          : tone === "professional"
          ? "Rewrite this in a polished, authoritative, professional tone. Elevate word choice without becoming stiff or jargon-heavy."
          : "Rewrite this in a friendly, conversational tone. Make it feel natural and approachable without losing substance.";

      prompt = `${instruction} Return ONLY the improved text — no explanation, no quotes, no preamble.

Text: ${selectedText}`;
    } else if (action === "suggest-tags") {
      const preview = plain(content ?? "").substring(0, 500) || "";
      prompt = `Suggest exactly 5 relevant article tags. Each tag must be 1–2 words that readers would search for. Focus on topic, industry, and key concepts. Return ONLY a JSON array of 5 strings, no other text.

Title: ${title}
Content: ${preview}`;
    } else if (action === "generate-outline") {
      prompt = `You are an expert content strategist. Generate a detailed article outline for the given title. Return ONLY a valid JSON array — no markdown, no explanation, no code fences. Each item must have "level" (2 for H2, 3 for H3) and "text" (the heading). Rules: start with 1-2 H2 context sections, then 3-5 main H2 sections each with 2-3 H3 subsections, end with a Conclusion H2. Max 20 items total.

Example format: [{"level":2,"text":"Introduction"},{"level":3,"text":"Why this matters"},{"level":2,"text":"Main Topic"}]

Title: ${title}`;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (action === "generate-outline") {
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ result: Array.isArray(parsed) ? parsed : [] });
      } catch {
        return NextResponse.json({ result: [] });
      }
    }

    if (action === "suggest-titles" || action === "suggest-tags") {
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ result: Array.isArray(parsed) ? parsed : [] });
      } catch {
        const lines = text
          .split("\n")
          .map(l => l.replace(/^[\d\.\-\*\"\s]+/, "").replace(/["\,]+$/, "").trim())
          .filter(Boolean)
          .slice(0, 5);
        return NextResponse.json({ result: lines });
      }
    }

    return NextResponse.json({ result: text });
  } catch (err: any) {
    console.error("[AI route error]", err);
    const msg = err?.error?.message ?? err?.message ?? "AI request failed";
    const isBalance = msg.toLowerCase().includes("credit balance");
    return NextResponse.json(
      { error: isBalance ? "Add billing at console.anthropic.com to use AI features." : "AI request failed" },
      { status: 500 }
    );
  }
}
