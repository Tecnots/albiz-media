import { describe, it, expect } from "vitest";
import { looksLikeHtml } from "./html-sanitize";

// looksLikeHtml() is what fixed the Post-translation regression: Post.content
// is plain text from the compose textarea unless a post was later edited
// through the contenteditable rich-text editor. Content was previously
// always treated as HTML, so plain-text characters like "<3" or a bare "&"
// were sent to Azure with textType=html and could get mangled/rejected.

describe("looksLikeHtml", () => {
  it("returns false for empty/falsy input", () => {
    expect(looksLikeHtml("")).toBe(false);
  });

  it("returns false for plain text with no markup", () => {
    expect(looksLikeHtml("just a normal post with no markup at all")).toBe(false);
  });

  it("returns false for plain text containing '<3', '&', hashtags, mentions, and emoji — the exact regression case", () => {
    const text = "Loving the new roadmap update <3 great work by R&D team!\nExcited for whats next #ProductLaunch @albizmedia 🎉";
    expect(looksLikeHtml(text)).toBe(false);
  });

  it("returns true for a single allowlisted tag", () => {
    expect(looksLikeHtml("<p>hello</p>")).toBe(true);
    expect(looksLikeHtml("plain text with a <b>bold</b> word")).toBe(true);
    expect(looksLikeHtml('<a href="https://example.com">link</a>')).toBe(true);
    expect(looksLikeHtml("<ul><li>item one</li><li>item two</li></ul>")).toBe(true);
  });

  it("returns false for a tag-like sequence that isn't a real allowlisted tag (no false positive on stray '<')", () => {
    expect(looksLikeHtml("5 < 10 and 20 > 15")).toBe(false);
    expect(looksLikeHtml("<random>not a real tag</random>")).toBe(false);
  });
});
