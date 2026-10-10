import { property as p } from "@/lib/property";
import InquiryForm from "@/components/InquiryForm";

const facts = [
  ["Check-in", p.checkIn], ["Check-out", p.checkOut],
  ["Max guests", p.maxGuests], ["Rate", p.rate],
].filter(([, v]) => v);

export default function Page() {
  const { lat, lng } = p.coords;
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
      <header>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Staycation rental</p>
        <h1 className="mt-3 font-display text-5xl font-semibold sm:text-7xl">{p.name}</h1>
        {p.tagline && <p className="mt-4 max-w-xl text-lg text-muted">{p.tagline}</p>}
        <a href="#inquire" className="mt-8 inline-block rounded-md bg-accent px-6 py-3 font-semibold text-white">Check availability</a>
      </header>

      {p.photos.length > 0 && (
        <section aria-label="Photos" className="mt-12 grid gap-3 sm:grid-cols-2">
          {p.photos.map((ph) => (
            <img key={ph.src} src={ph.src} alt={ph.alt} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
          ))}
        </section>
      )}

      {facts.length > 0 && (
        <dl className="mt-12 grid grid-cols-2 gap-6 border-y border-line py-6 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="mt-1 font-display text-xl">{v}</dd></div>
          ))}
        </dl>
      )}

      {(p.amenities.length > 0 || p.rules.length > 0) && (
        <section className="mt-12 grid gap-10 sm:grid-cols-2">
          {p.amenities.length > 0 && <div><h2 className="font-display text-2xl">What's included</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">{p.amenities.map((a) => <li key={a}>{a}</li>)}</ul></div>}
          {p.rules.length > 0 && <div><h2 className="font-display text-2xl">House rules</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">{p.rules.map((r) => <li key={r}>{r}</li>)}</ul></div>}
        </section>
      )}

      <section className="mt-14" aria-labelledby="loc">
        <h2 id="loc" className="font-display text-2xl">Location</h2>
        {p.address && <p className="mt-2 text-muted">{p.address}</p>}
        <iframe title={`Map showing ${p.name}`} loading="lazy" className="mt-4 h-80 w-full rounded-lg border border-line"
          src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`} />
        <a href={p.mapsLink} className="mt-3 inline-block font-medium text-accent underline underline-offset-4">Open in Google Maps for directions</a>
      </section>

      <section id="inquire" className="mt-14 scroll-mt-6" aria-labelledby="inq">
        <h2 id="inq" className="font-display text-2xl">Check availability</h2>
        <div className="mt-4"><InquiryForm name={p.name} phone={p.contact.phone} maxGuests={p.maxGuests} /></div>
        {p.contact.messengerUrl && <p className="mt-4"><a className="font-medium text-accent underline underline-offset-4" href={p.contact.messengerUrl}>Or message on Messenger</a></p>}
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">{p.name}</footer>
    </main>
  );
}
