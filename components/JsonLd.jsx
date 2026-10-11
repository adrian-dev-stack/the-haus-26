import { property } from "@/lib/property";

export default function JsonLd() {
  const baseUrl = "https://thehaus26.com";

  const sameAs = [
    property.contact?.messengerUrl,
    property.contact?.instagramUrl,
  ].filter(Boolean);

  const schema = {
    "@context": "https://schema.org",
    "@type": ["VacationRental", "LodgingBusiness"],
    "@id": `${baseUrl}/#rental`,
    name: property.name,
    description: property.tagline,
    url: baseUrl,
    telephone: property.contact.phone,
    ...(property.contact?.email ? { email: property.contact.email } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    priceRange: "₱5,000 - ₱8,000+",
    currenciesAccepted: "PHP",
    checkinTime: "11:00",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Hulo, Alangan",
      addressLocality: "Limay",
      addressRegion: "Bataan",
      addressCountry: "PH",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: property.coords.lat,
      longitude: property.coords.lng,
    },
    hasMap: property.mapsLink,
    image: property.photos.map((p) => `${baseUrl}${p.src}`),
    amenityFeature: property.amenities.map((item) => ({
      "@type": "LocationFeatureSpecification",
      name: item,
      value: true,
    })),
    petsAllowed: true,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
