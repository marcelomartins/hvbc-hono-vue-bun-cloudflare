import { useHead } from "@unhead/vue";
import { useRoute } from "vue-router";

const SITE_NAME = "HVBC";

interface PublicHead {
  title: string;
  description: string;
  /** False for pages that must stay out of search results, such as the 404 page. */
  indexable?: boolean;
}

export function usePublicHead({ title, description, indexable = true }: PublicHead): void {
  if (!indexable) {
    useHead({
      title,
      meta: [
        { name: "description", content: description },
        { name: "robots", content: "noindex" }
      ]
    });
    return;
  }
  const url = `${import.meta.env.APP_ORIGIN}${useRoute().path}`;
  useHead({
    title,
    link: [{ rel: "canonical", href: url }],
    meta: [
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:url", content: url },
      { property: "og:title", content: title },
      { property: "og:description", content: description }
    ]
  });
}
