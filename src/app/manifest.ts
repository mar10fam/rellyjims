import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rellyjims",
    short_name: "rellyjims",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    // TODO: add 192px and 512px icons in public/icons/
    icons: [],
  };
}
