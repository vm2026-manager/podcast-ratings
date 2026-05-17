function renderPodcastReviewCard(podcast, review, key) {
  const article = document.createElement("article");
  article.className = "podcast-card podcast-card--review";

  const placement = document.createElement("div");
  placement.className = "podcast-card__placement";
  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

  const rating = document.createElement("div");
  rating.className = "podcast-card__rating";
  rating.textContent = review.scoreLabel || podcast.ratingLabel || "Ikke vurderet";

  const body = document.createElement("div");
  body.className = "podcast-card__body";

  const head = document.createElement("div");
  head.className = "review-card__head";

  const cover = document.createElement("div");
  cover.className = "review-card__cover";
  cover.innerHTML = `<img alt="" loading="lazy" />`;

  const coverImg = cover.querySelector("img");
  coverImg.src = review.image || podcast.image || "";
  coverImg.alt = review.title || podcast.title || "";

  const headCopy = document.createElement("div");
  headCopy.className = "review-card__head-copy";

  headCopy.innerHTML = `
    <p class="review-card__eyebrow">Mads anmelder</p>
    <h3 class="review-card__title">${escapeHtml(review.title || podcast.title)}</h3>
    <p class="review-card__host">${escapeHtml(review.host || podcast.host || "")}</p>
    <p class="review-card__date">${escapeHtml(review.reviewDateLabel || "")}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "review-card__actions";

  const linkButton = document.createElement("button");
  linkButton.className = "podcast-card__link";
  linkButton.type = "button";
  linkButton.textContent = "Åbn link";

  if (review.link || podcast.link) {
    linkButton.addEventListener("click", () => {
      window.open(review.link || podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  const backButton = document.createElement("button");
  backButton.className = "review-card__back";
  backButton.type = "button";
  backButton.textContent = "Tilbage";
  backButton.addEventListener("click", (event) => {
    state.openReviewKeys.delete(key);

    const currentCard = event.currentTarget.closest(".podcast-card");
    if (currentCard) {
      currentCard.replaceWith(renderPodcastCard(podcast));
    } else {
      renderPodcastGrid();
    }
  });

  actions.append(linkButton, backButton);
  headCopy.appendChild(actions);

  head.append(cover, headCopy);

  const text = document.createElement("p");
  text.className = "review-card__text";
  text.textContent = review.review || "";

  const heading = document.createElement("p");
  heading.className = "review-card__heading";
  heading.textContent = "Vurderet på parametre";

  const params = document.createElement("div");
  params.className = "review-card__params";

  review.params.forEach((param) => {
    const rawValue = normalizeText(param.value);
    if (!rawValue) return;

    const number = parseNumber(rawValue);
    const row = document.createElement("div");
    row.className = "review-card__param";

    const label = document.createElement("span");
    label.className = "review-card__param-name";
    label.textContent = param.label;

    if (number === null) {
      row.classList.add("is-na");

      const value = document.createElement("span");
      value.className = "review-card__param-value";
      value.textContent = rawValue;

      row.append(label, value);
    } else {
      const bar = document.createElement("div");
      bar.className = "review-card__param-bar";

      const fill = document.createElement("span");
      fill.className = "review-card__param-fill";
      fill.style.width = `${Math.max(0, Math.min(100, number * 10))}%`;

      const value = document.createElement("span");
      value.className = "review-card__param-value";
      value.textContent = formatRating(rawValue);

      bar.appendChild(fill);
      row.append(label, bar, value);
    }

    params.appendChild(row);
  });

  body.append(head, text, heading, params);

  const footer = document.createElement("div");
  footer.className = "podcast-card__footer";

  const chips = document.createElement("div");
  chips.className = "podcast-card__chips";

  const publisherChip = createReviewFilterChip(
    review.publisher || podcast.publisher || "Ukendt",
    "publisher"
  );

  const genreChip = createReviewFilterChip(
    review.genre || podcast.genre || "Dokumentar",
    "genre"
  );

  const episodesChip = document.createElement("span");
  episodesChip.className = "podcast-chip podcast-chip--episodes";
  episodesChip.textContent = podcast.episodes || "—";

  chips.append(publisherChip, genreChip, episodesChip);
  footer.appendChild(chips);

  article.append(placement, rating, body, footer);

  return article;
}
