import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sat+ — Весь Сатпаев в одном месте",
    short_name: "Sat+",
    description: "Городская платформа Сатпаева. QaiArzan — где дешевле.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ru",
    categories: ["shopping", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "QaiArzan — цены", short_name: "Цены", url: "/prices" },
      { name: "Корзина", short_name: "Корзина", url: "/prices/basket" },
      { name: "Добавить цену", short_name: "Добавить", url: "/prices/add" },
    ],
  };
}
