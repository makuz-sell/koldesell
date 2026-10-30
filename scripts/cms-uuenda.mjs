// Kirjutab Decap CMS-is muudetavad andmed (content/seaded/*.json) HTML-failidesse.
//
// HTML-is hallatakse kolme liiki kohti:
//   <!-- cms:seo --> ... <!-- /cms:seo -->        lehe pealkiri, kirjeldus, canonical ja Open Graph
//   <!-- cms:jsonld --> ... <!-- /cms:jsonld -->  Schema.org LocalBusiness struktureeritud andmed
//   data-cms="võti"                                elemendi tekst = ettevote.json väli
//   data-cms-link="telefon" | "email"              lingi href = tel: / mailto:
//
// Kasutus:  node scripts/cms-uuenda.mjs           uuendab failid
//           node scripts/cms-uuenda.mjs --check   ainult kontrollib (exit 1, kui HTML on aegunud)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

const ettevote = readJson('content/seaded/ettevote.json');
const seo = readJson('content/seaded/seo.json');

const LEHED = [
  { fail: 'index.html', seo: 'avaleht', tee: '/' },
  { fail: 'hinnakiri.html', seo: 'hinnakiri', tee: '/hinnakiri.html' },
  { fail: 'galerii.html', seo: 'galerii', tee: '/galerii.html' },
  { fail: 'edukas.html' },
];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sait = String(ettevote.veebileht).replace(/\/+$/, '');
const absoluutne = (tee) => /^https?:\/\//.test(tee) ? tee : sait + '/' + String(tee).replace(/^\/+/, '');
const telefonLink = 'tel:' + String(ettevote.telefon).replace(/[^\d+]/g, '');

function seoPlokk(leht) {
  const s = seo[leht.seo];
  const url = sait + leht.tee;
  const rida = (html) => `    ${html}`;
  return [
    rida('<!-- cms:seo -->'),
    rida(`<title>${escapeHtml(s.pealkiri)}</title>`),
    rida(`<meta name="description" content="${escapeHtml(s.kirjeldus)}">`),
    rida(`<link rel="canonical" href="${escapeHtml(url)}">`),
    rida('<meta property="og:type" content="website">'),
    rida('<meta property="og:locale" content="et_EE">'),
    rida(`<meta property="og:site_name" content="${escapeHtml(ettevote.nimi)}">`),
    rida(`<meta property="og:title" content="${escapeHtml(s.og_pealkiri || s.pealkiri)}">`),
    rida(`<meta property="og:description" content="${escapeHtml(s.og_kirjeldus || s.kirjeldus)}">`),
    rida(`<meta property="og:url" content="${escapeHtml(url)}">`),
    rida(`<meta property="og:image" content="${escapeHtml(absoluutne(seo.og_pilt))}">`),
    rida(`<meta property="og:image:alt" content="${escapeHtml(ettevote.nimi)}">`),
    rida('<meta name="twitter:card" content="summary">'),
    rida('<!-- /cms:seo -->'),
  ].join('\n');
}

function jsonLdPlokk() {
  const piirkond = 'Lõuna-Eesti';
  const andmed = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    additionalType: 'http://www.productontology.org/id/Chimney_sweep',
    '@id': sait + '/#business',
    name: ettevote.nimi,
    legalName: ettevote.arinimi,
    url: sait + '/',
    logo: sait + '/logo.png',
    image: sait + '/logo.png',
    description: ettevote.kirjeldus,
    telephone: telefonLink.slice(4),
    email: ettevote.email,
    priceRange: '€€',
    identifier: { '@type': 'PropertyValue', propertyID: 'Äriregistri kood', value: ettevote.registrikood },
    address: {
      '@type': 'PostalAddress',
      addressLocality: ettevote.linn,
      addressRegion: ettevote.maakond,
      addressCountry: 'EE',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 57.8462, longitude: 27.0019 },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: telefonLink.slice(4),
      email: ettevote.email,
      areaServed: 'EE',
      availableLanguage: ['et'],
    },
    areaServed: (ettevote.teeninduspiirkonnad || []).map((p) => ({ '@type': p.tyyp || 'Place', name: p.nimi })),
    knowsAbout: ['korstnapühkimine', 'ahju remont', 'pottsepatööd', 'küttesüsteemide kontroll'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${ettevote.nimi} – teenused`,
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Korstnapühkimine',
            description: 'Korstnate, ahjude, pliitide ja kaminate puhastamine koos ametliku aktiga Päästeametile ja Küttesüsteemide portaali.',
            serviceType: 'Korstnapühkimine',
            areaServed: piirkond,
          },
          price: String(ettevote.baashind),
          priceCurrency: 'EUR',
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Väiksemad ahju remonditööd',
            description: 'Ahjude ja pliitide pisiremont: kividetailide vahetus, uste ja siibrite paigaldus, vuukimine.',
            serviceType: 'Ahju remont',
            areaServed: piirkond,
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Küttesüsteemide kontroll',
            serviceType: 'Küttesüsteemide kontroll',
            areaServed: piirkond,
          },
        },
      ],
    },
  };
  // "<" kodeeritakse, et väärtus ei saaks <script> plokki sulgeda
  const json = JSON.stringify(andmed, null, 2).replace(/</g, '\\u003c').replace(/^/gm, '    ');
  return `    <!-- cms:jsonld -->\n    <script type="application/ld+json">\n${json}\n    </script>\n    <!-- /cms:jsonld -->`;
}

const tekstid = {
  telefon: ettevote.telefon,
  email: ettevote.email,
  registrikood: ettevote.registrikood,
  kutse_korstnapuhkija: ettevote.kutse_korstnapuhkija,
  kutse_pottsepp: ettevote.kutse_pottsepp,
  piirkond: ettevote.piirkond,
  piirkond_lyhike: ettevote.piirkond_lyhike,
  baashind: ettevote.baashind,
};
const lingid = { telefon: telefonLink, email: 'mailto:' + ettevote.email };

function asendaPlokk(html, nimi, uus, fail) {
  const muster = new RegExp(`[ \\t]*<!-- cms:${nimi} -->[\\s\\S]*?<!-- /cms:${nimi} -->`);
  if (!muster.test(html)) throw new Error(`${fail}: puudub <!-- cms:${nimi} --> plokk`);
  return html.replace(muster, () => uus);
}

function uuenda(leht) {
  let html = readFileSync(join(root, leht.fail), 'utf8');
  if (leht.seo) {
    html = asendaPlokk(html, 'seo', seoPlokk(leht), leht.fail);
    html = asendaPlokk(html, 'jsonld', jsonLdPlokk(), leht.fail);
  }
  html = html.replace(/<(\w+)([^>]*?\sdata-cms="(\w+)"[^>]*)>[^<]*<\/\1>/g, (match, tag, attrs, voti) => {
    if (!(voti in tekstid)) throw new Error(`${leht.fail}: tundmatu data-cms="${voti}"`);
    return `<${tag}${attrs}>${escapeHtml(tekstid[voti])}</${tag}>`;
  });
  html = html.replace(/<a\b[^>]*\sdata-cms-link="(\w+)"[^>]*>/g, (tag, voti) => {
    if (!(voti in lingid)) throw new Error(`${leht.fail}: tundmatu data-cms-link="${voti}"`);
    return tag.replace(/href="[^"]*"/, `href="${escapeHtml(lingid[voti])}"`);
  });
  return html;
}

const kontroll = process.argv.includes('--check');
const aegunud = [];
for (const leht of LEHED) {
  const tee = join(root, leht.fail);
  const uus = uuenda(leht);
  if (uus === readFileSync(tee, 'utf8')) continue;
  aegunud.push(leht.fail);
  if (!kontroll) writeFileSync(tee, uus);
}

if (kontroll && aegunud.length) {
  console.error(`HTML ei vasta failidele content/seaded/*.json: ${aegunud.join(', ')}\nKäivita: node scripts/cms-uuenda.mjs`);
  process.exit(1);
}
console.log(aegunud.length ? `Uuendatud: ${aegunud.join(', ')}` : 'Kõik failid on ajakohased.');
