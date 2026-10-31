// Tehtud tööde laadimine Decap CMS-i kaustast content/galerii (otse GitHubist).
// Kasutus: <div data-galerii data-piirang="3" data-pealkiri="h3" data-peida="sektsiooni-id">
//   data-piirang  – mitu uuemat tööd näidata (vaikimisi kõik)
//   data-pealkiri – kaardi pealkirja tase (vaikimisi h2)
//   data-peida    – kui töid pole või laadimine ebaõnnestub, peidetakse selle id-ga element
(function () {
  const REPO = 'makuz-sell/koldesell';
  const HARU = 'main';

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Loeb Markdowni päise (front matter) väljad, sh mitmerealised (">-" ja "|") väärtused
  function loeFrontMatter(md) {
    const plokk = md.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    const andmed = {};
    if (!plokk) return andmed;
    const read = plokk[1].split(/\r?\n/);
    for (let i = 0; i < read.length; i++) {
      const m = read[i].match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      let vaartus = m[2].trim();
      if (/^[>|]-?$/.test(vaartus)) {
        const jatk = [];
        while (i + 1 < read.length && /^\s+/.test(read[i + 1])) jatk.push(read[++i].trim());
        vaartus = jatk.join(vaartus.startsWith('>') ? ' ' : '\n');
      } else if (/^(["']).*\1$/.test(vaartus)) {
        vaartus = vaartus.slice(1, -1);
      }
      andmed[m[1]] = vaartus;
    }
    return andmed;
  }

  function kaart(kirje, i, tase) {
    const pilt = `https://raw.githubusercontent.com/${REPO}/${HARU}/${kirje.image.replace(/^\/+/, '')}`;
    const pealkiri = escapeHtml(kirje.title || 'Tehtud töö');
    const kuupaev = kirje.date ? new Date(kirje.date) : null;
    const aeg = kuupaev && !isNaN(kuupaev)
      ? `<time datetime="${escapeHtml(kirje.date)}">${kuupaev.toLocaleDateString('et-EE', { month: 'long', year: 'numeric' })}</time>`
      : '';
    return `
      <article class="kl-kaart">
        <a class="kl-kaart-pilt" href="${escapeHtml(pilt)}" target="_blank" rel="noopener" aria-label="Ava pilt: ${pealkiri}">
          <img src="${escapeHtml(pilt)}" alt="${pealkiri}" width="600" height="750" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">
        </a>
        <div class="kl-kaart-sisu">
          ${aeg}
          <${tase}>${pealkiri}</${tase}>
          ${kirje.description ? `<p>${escapeHtml(kirje.description)}</p>` : ''}
        </div>
      </article>`;
  }

  async function laeTood(konteiner) {
    const piirang = Number(konteiner.dataset.piirang) || Infinity;
    const tase = /^h[2-4]$/.test(konteiner.dataset.pealkiri || '') ? konteiner.dataset.pealkiri : 'h2';
    const peida = konteiner.dataset.peida && document.getElementById(konteiner.dataset.peida);
    const teade = (tekst) => {
      if (peida) peida.hidden = true;
      else konteiner.innerHTML = `<p class="kl-galerii-teade">${tekst}</p>`;
    };
    try {
      const vastus = await fetch(`https://api.github.com/repos/${REPO}/contents/content/galerii?ref=${HARU}`);
      if (!vastus.ok) return teade('Hetkel teostatud töid galeriisse lisatud ei ole.');
      const failid = (await vastus.json()).filter((fail) => fail.name.endsWith('.md'));
      // Kõik kirjed laaditakse korraga, mitte ükshaaval järjest
      const kirjed = (await Promise.all(failid.map((fail) => fetch(fail.download_url).then((r) => r.text()))))
        .map(loeFrontMatter)
        .filter((kirje) => kirje.image)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, piirang);
      if (!kirjed.length) return teade('Hetkel teostatud töid galeriisse lisatud ei ole.');
      konteiner.innerHTML = kirjed.map((kirje, i) => kaart(kirje, i, tase)).join('');
    } catch (viga) {
      console.error('Galerii laadimise viga:', viga);
      teade('Töid ei õnnestunud laadida. Proovi hiljem uuesti.');
    } finally {
      konteiner.setAttribute('aria-busy', 'false');
    }
  }

  document.querySelectorAll('[data-galerii]').forEach(laeTood);
})();
