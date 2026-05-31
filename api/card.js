const https = require("https");

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function wrap(text, width, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length <= width) {
      line = (line + " " + w).trim();
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines[maxLines - 1].length > width - 1)
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, width - 1) + "…";
  return lines;
}

const FAVORITES = [
  { title: "Botan Kamiina Fully Blossoms When Drunk", season: "Spring 2026", accent: "#ff6eb4" },
  { title: "Shiboyugi Playing Death Games to Put Food on the Table", season: "Winter 2026", accent: "#58a6ff" },
];

const CARD_W = 860, CARD_H = 160, IMG_W = 108;

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  let cardsSvg = "";
  let yOffset = 0;

  for (let idx = 0; idx < FAVORITES.length; idx++) {
    const { title, season, accent } = FAVORITES[idx];
    try {
      const q = encodeURIComponent(title);
      const apiData = await fetch(`https://api.jikan.moe/v4/anime?q=${q}&limit=1`);
      const anime = JSON.parse(apiData.toString())["data"][0];

      const imgUrl = anime.images.jpg.large_image_url;
      const imgBuffer = await fetch(imgUrl);
      const imgBase64 = "data:image/jpeg;base64," + imgBuffer.toString("base64");
      const malUrl = anime.url; // MAL page URL from Jikan

      const enTitle = (anime.title_english || anime.title || title).slice(0, 42);
      const score = anime.score || "N/A";
      const episodes = anime.episodes || "?";
      const studio = (anime.studios?.[0]?.name) || "—";
      const genres = (anime.genres || []).slice(0, 3).map(g => g.name);
      const synopsisLines = wrap(anime.synopsis || "", 90, 3);

      let genrePills = "";
      let gx = IMG_W + 16;
      for (const g of genres) {
        const pw = g.length * 7 + 16;
        genrePills += `
          <rect x="${gx}" y="108" width="${pw}" height="18" rx="9" fill="none" stroke="${accent}" stroke-width="1" opacity="0.7"/>
          <text x="${gx + pw / 2}" y="121" text-anchor="middle" font-family="monospace" font-size="10" fill="${accent}" opacity="0.9">${g}</text>`;
        gx += pw + 8;
      }

      const synopsisText = synopsisLines.map((l, i) =>
        `<text x="${IMG_W + 16}" y="${72 + i * 16}" font-family="monospace" font-size="11" fill="#8b949e">${l}</text>`
      ).join("");

      cardsSvg += `
      <a href="${malUrl}" target="_blank">
        <g transform="translate(0,${yOffset})">
          <rect width="${CARD_W}" height="${CARD_H}" rx="12" fill="#161b22" stroke="#30363d" stroke-width="1"/>
          <rect width="3" height="${CARD_H}" rx="1" fill="${accent}"/>
          <clipPath id="clip${idx}"><rect x="12" y="12" width="${IMG_W - 8}" height="${CARD_H - 24}" rx="8"/></clipPath>
          <image href="${imgBase64}" x="12" y="12" width="${IMG_W - 8}" height="${CARD_H - 24}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip${idx})"/>
          <text x="${CARD_W - 16}" y="26" text-anchor="end" font-family="monospace" font-size="10" fill="${accent}" opacity="0.8">${season}</text>
          <text x="${IMG_W + 16}" y="36" font-family="monospace" font-size="15" font-weight="bold" fill="#e6edf3">${enTitle}</text>
          <text x="${IMG_W + 16}" y="54" font-family="monospace" font-size="11" fill="#ffd60a">⭐ ${score}</text>
          <text x="${IMG_W + 72}" y="54" font-family="monospace" font-size="11" fill="#8b949e">· ${studio} · ${episodes} eps</text>
          ${synopsisText}
          ${genrePills}
        </g>
      </a>`;
      yOffset += CARD_H + 12;

      if (idx < FAVORITES.length - 1) await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(e);
    }
  }

  const totalH = yOffset - 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${totalH}" viewBox="0 0 ${CARD_W} ${totalH}">
    <rect width="${CARD_W}" height="${totalH}" fill="#0d1117"/>
    ${cardsSvg}
  </svg>`;

  res.status(200).send(svg);
};
