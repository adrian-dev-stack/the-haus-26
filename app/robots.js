export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/pay/", "/payment/", "/book/", "/admin", "/api/"],
    },
    sitemap: "https://thehaus26.com/sitemap.xml",
  };
}
