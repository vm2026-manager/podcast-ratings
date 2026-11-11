// Synthetic, metadata-only structural snapshots matching the two public card
// layouts observed on the official Fri Mads overview. Number ranges and #172
// metadata were verified from the public listing on 11 November 2026; all other
// labels are neutral test data, not asserted editorial titles.

function card(number, { legacy = false, title, url } = {}) {
  const heading = title || `Fri Mads #${number}: Testpost ${number}`;
  const permalink = url || (number === 140
    ? "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/"
    : `https://frihedsbrevet.dk/fri-mads-${number}-testpost-${number}/`);
  if (legacy) {
    return `<a href="${permalink}" class="post-card-link"><figure></figure><div>
      <div class="post-card-category--wrap"><p class="post-card-category--title">Fri Mads</p></div>
      <h3 class="post-card-headline">${heading}</h3>
      <div class="post-card-meta"><span>Af Mads Brügger</span><span>8. november 2026 kl. 06:00</span></div>
    </div></a>`;
  }
  return `<a draggable="false" class="post-card c-post-card slide text-black" href="${permalink}">
    <div class="post-card-content"><p class="c-post-card__category__title">Fri Mads</p>
      <h3 class="c-post-card__title">${heading}</h3>
      <div class="article-meta"><span>Af Mads Brügger</span><span>8. november 2026 kl. 06:00</span></div>
    </div></a>`;
}

function overview(numbers, { pagination = "" } = {}) {
  const cards = numbers.map((number) => card(number, {
    legacy: number === 146 || number === 119,
    ...(number === 172 ? {
      title: "Fri Mads #172: Alle elsker Mette",
      url: "https://frihedsbrevet.dk/fri-mads-172-alle-elsker-mette/"
    } : {})
  })).join("\n");
  return `<!doctype html><html><head><title>Fri Mads</title></head><body><main>${cards}${pagination}</main></body></html>`;
}

export const FRI_MADS_OVERVIEW_172_TO_146_HTML = overview(Array.from({ length: 27 }, (_, index) => 172 - index), {
  pagination: '<a href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=2">Næste</a>'
});

export const FRI_MADS_OVERVIEW_145_TO_119_HTML = overview(Array.from({ length: 27 }, (_, index) => 145 - index), {
  pagination: '<a href="https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=3">Næste</a>'
});

export const FRI_MADS_OVERVIEW_173_TO_147_HTML = overview(Array.from({ length: 27 }, (_, index) => 173 - index));

export function makeFriMadsOverview(numbers, overrides = {}) {
  return `<!doctype html><html><head><title>Fri Mads</title></head><body><main>${numbers.map((number) => card(number, overrides[number] || {})).join("\n")}</main></body></html>`;
}
