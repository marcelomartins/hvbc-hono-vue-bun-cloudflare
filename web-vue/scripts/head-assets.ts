const ASSET_TAG = /<(script|link)\b[^>]*?\s(?:src|href)="([^"]+)"[^>]*>/gu;
const LOADING_LINK = /\srel="(?:modulepreload|stylesheet)"/u;

/** Drops preload and stylesheet links for assets that an earlier tag already loads. */
export function removeDuplicateAssetTags(html: string): string {
  const loaded = new Set<string>();
  return html.replace(ASSET_TAG, (tag: string, element: string, url: string) => {
    if (element === "link" && !LOADING_LINK.test(tag)) return tag;
    if (!loaded.has(url)) {
      loaded.add(url);
      return tag;
    }
    return element === "link" ? "" : tag;
  });
}
