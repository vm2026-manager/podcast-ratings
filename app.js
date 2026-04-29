resultsText.textContent = `Viser ${count} ${noun} ud af ${total}.`;
}

function setImage(imageElement, wrapperElement, imageUrl, altText) {
  if (imageUrl && wrapperElement && imageElement) {
    imageElement.src = imageUrl;
    imageElement.alt = altText;
    imageElement.style.display = "";
    wrapperElement.style.display = "";

    imageElement.addEventListener(
      "error",
      () => {
        imageElement.style.display = "none";
        wrapperElement.style.display = "none";
      },
      { once: true }
    );
  } else if (wrapperElement) {
    wrapperElement.style.display = "none";
function applyImageState(wrapper, image, placeholder, imageUrl, altText) {
  if (!wrapper || !image || !placeholder) return;

  const showPlaceholder = () => {
    wrapper.classList.add("has-no-image");
    image.removeAttribute("src");
    image.alt = "";
  };

  if (!imageUrl) {
    showPlaceholder();
    return;
}

  wrapper.classList.remove("has-no-image");
  image.src = imageUrl;
  image.alt = altText;
  image.addEventListener("error", showPlaceholder, { once: true });
}

function createRecentCard(podcast) {
const fragment = recentCardTemplate.content.cloneNode(true);
const coverWrap = fragment.querySelector(".recent-cover-wrap");
const cover = fragment.querySelector(".recent-cover");
  const placeholder = fragment.querySelector(".image-placeholder");

  setImage(
    cover,
  applyImageState(
coverWrap,
    cover,
    placeholder,
formatText(podcast.Billedlink, ""),
`Cover til ${formatText(podcast.Titel, "podcast")}`
);
@@ -480,16 +482,18 @@ function createCard(podcast) {
const placementValue = fragment.querySelector(".placement-value");
const coverWrap = fragment.querySelector(".cover-wrap");
const image = fragment.querySelector(".podcast-image");
  const placeholder = fragment.querySelector(".image-placeholder");

placementValue.textContent = `#${formatText(podcast.Placering, "–")}`;

fragment.querySelector(".card-rating").textContent = formatRating(
podcast["Vuring (1-10)"]
);

  setImage(
    image,
  applyImageState(
coverWrap,
    image,
    placeholder,
formatText(podcast.Billedlink, ""),
`Cover til ${formatText(podcast.Titel, "podcast")}`
);
