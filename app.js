function renderPodcastCard(podcast) {
  const review = getReviewForPodcast(podcast);
  const key = getPodcastKey(podcast);

  if (review && state.openReviewKeys.has(key)) {
    return renderPodcastReviewCard(podcast, review, key);
  }

  const fragment = elements.podcastTemplate.content.cloneNode(true);

  const placement = fragment.querySelector(".podcast-card__placement");
  const rating = fragment.querySelector(".podcast-card__rating");
  const media = fragment.querySelector(".podcast-card__media");
  const title = fragment.querySelector(".podcast-card__title");
  const host = fragment.querySelector(".podcast-card__host");
  const description = fragment.querySelector(".podcast-card__description");
  const linkButton = fragment.querySelector(".podcast-card__link");
  const reviewButton = fragment.querySelector(".podcast-card__review");
  const chips = fragment.querySelector(".podcast-card__chips");

  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

  rating.textContent = podcast.ratingLabel || "Ikke vurderet";
  setImage(media, podcast.image, podcast.title);

  title.textContent = podcast.title;
  host.textContent = podcast.host || "";
  description.textContent = podcast.description || "";

  if (podcast.link) {
    linkButton.classList.remove("is-hidden");
    linkButton.addEventListener("click", () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  if (review) {
    reviewButton.classList.remove("is-hidden");
    reviewButton.addEventListener("click", (event) => {
      state.openReviewKeys.add(key);

      const currentCard = event.currentTarget.closest(".podcast-card");
      if (currentCard) {
        currentCard.replaceWith(renderPodcastReviewCard(podcast, review, key));
      } else {
        renderPodcastGrid();
      }
    });
  } else {
    reviewButton.classList.add("is-hidden");
  }

  const publisherChip = document.createElement("button");
  publisherChip.type = "button";
  publisherChip.className = "podcast-chip";
  publisherChip.textContent = podcast.publisher || "Ukendt";
  publisherChip.title = `Vis podcasts fra ${podcast.publisher || "Ukendt"}`;
  publisherChip.addEventListener("click", () => {
    if (podcast.publisher) {
      setActiveFilter("publisher", podcast.publisher);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  const genreChip = document.createElement("button");
  genreChip.type = "button";
  genreChip.className = "podcast-chip";
  genreChip.textContent = podcast.genre || "Dokumentar";
  genreChip.title = `Vis podcasts i genren ${podcast.genre || "Dokumentar"}`;
  genreChip.addEventListener("click", () => {
    if (podcast.genre) {
      setActiveFilter("genre", podcast.genre);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  const episodesChip = document.createElement("span");
  episodesChip.className = "podcast-chip podcast-chip--episodes";
  episodesChip.textContent = podcast.episodes || "—";

  chips.append(publisherChip, genreChip, episodesChip);

  return fragment;
}

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

  const mediaColumn = document.createElement("div");
  mediaColumn.className = "podcast-card__media-column";

  const media = document.createElement("div");
  media.className = "podcast-card__media cover-wrap";
  media.innerHTML = `
    <img class="podcast-image" alt="" loading="lazy" />
    <div class="image-placeholder" aria-hidden="true">
      <span class="image-placeholder-icon">▢</span>
      <span class="image-placeholder-label">Billede mangler</span>
    </div>
  `;
  setImage(media, review.image || podcast.image, review.title || podcast.title);

  const actions = document.createElement("div");
  actions.className = "podcast-card__actions";

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
  mediaColumn.append(media, actions);

  const content = document.createElement("div");
  content.className = "podcast-card__content";

  const meta = [review.publisher, review.genre].filter(Boolean).join(" / ");
  const hostLine = review.host || podcast.host || "";

  content.innerHTML = `
    <p class="review-card__eyebrow">Mads anmelder</p>
    <h3 class="review-card__title">${escapeHtml(review.title || podcast.title)}</h3>
    <p class="review-card__host">${escapeHtml(hostLine)}</p>
    <p class="review-card__meta">${escapeHtml(meta)}</p>
    <p class="review-card__date">${escapeHtml(review.reviewDateLabel || "")}</p>
    <p class="review-card__text">${escapeHtml(review.review || "")}</p>
    <p class="review-card__heading">Vurderet på parametre</p>
    <div class="review-card__params"></div>
  `;

  const params = content.querySelector(".review-card__params");

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

  body.append(mediaColumn, content);

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

function createReviewFilterChip(value, type) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "podcast-chip";
  chip.textContent = value || "Ukendt";

  chip.addEventListener("click", () => {
    if (!value || value === "Ukendt") return;

    if (type === "publisher") {
      setActiveFilter("publisher", value);
    }

    if (type === "genre") {
      setActiveFilter("genre", value);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  return chip;
}