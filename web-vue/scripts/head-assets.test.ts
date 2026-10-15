import { describe, expect, test } from "bun:test";

import { removeDuplicateAssetTags } from "./head-assets";

describe("removeDuplicateAssetTags", () => {
  test("drops links for assets an earlier tag already loads", () => {
    const html = [
      '<script type="module" crossorigin="" src="/assets/main.js"></script>',
      '<link rel="stylesheet" crossorigin="" href="/assets/main.css">',
      '<link rel="modulepreload" crossorigin="" href="/assets/main.js">',
      '<link rel="stylesheet" href="/assets/main.css">'
    ].join("");
    expect(removeDuplicateAssetTags(html)).toBe(
      '<script type="module" crossorigin="" src="/assets/main.js"></script>' +
        '<link rel="stylesheet" crossorigin="" href="/assets/main.css">'
    );
  });

  test("keeps unrelated links and distinct assets", () => {
    const html = [
      '<link rel="icon" href="/favicon.svg">',
      '<link rel="canonical" href="https://app.example/">',
      '<link rel="modulepreload" href="/assets/chunk.js">',
      '<script type="module" src="/assets/main.js"></script>'
    ].join("");
    expect(removeDuplicateAssetTags(html)).toBe(html);
  });
});
