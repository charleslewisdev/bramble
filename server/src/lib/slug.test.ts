import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips punctuation", () => {
    expect(slugify("What's up, Doc?!")).toBe("whats-up-doc");
  });

  it("collapses whitespace and hyphens", () => {
    expect(slugify("  Too   many    spaces  ")).toBe("too-many-spaces");
    expect(slugify("a---b")).toBe("a-b");
  });

  it("strips diacritics", () => {
    expect(slugify("Naïve Café")).toBe("naive-cafe");
  });

  it("falls back to 'untitled' for empty input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
  });

  it("preserves existing hyphens", () => {
    expect(slugify("compost-guide")).toBe("compost-guide");
  });
});

describe("uniqueSlug", () => {
  it("returns desired when free", () => {
    expect(uniqueSlug("foo", () => false)).toBe("foo");
  });

  it("appends -2 on first collision", () => {
    const taken = new Set(["foo"]);
    expect(uniqueSlug("foo", (c) => taken.has(c))).toBe("foo-2");
  });

  it("increments until free", () => {
    const taken = new Set(["foo", "foo-2", "foo-3"]);
    expect(uniqueSlug("foo", (c) => taken.has(c))).toBe("foo-4");
  });
});
