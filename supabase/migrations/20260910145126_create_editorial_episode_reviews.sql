-- Review-only migration. It is intentionally not applied by this change.
-- Public rows contain only display-safe editorial review fields. Complete legacy
-- snapshots and operational identity evidence remain in the non-exposed private schema.

create schema if not exists private;

create table public.editorial_episode_reviews (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid null references public.podcast_episodes(id) on delete set null,
  canonical_podcast_key text null,
  parent_label text null,
  parent_status text not null check (
    parent_status in ('approved', 'approved_pending_catalogue', 'pending_editorial')
  ),
  publisher_label text not null,
  canonical_episode_title text not null,
  canonical_content_url text null,
  published_on date null,
  editorial_rating numeric(3,1) not null check (editorial_rating >= 0 and editorial_rating <= 10),
  editorial_review_date date null,
  editorial_review_text text null,
  reviewer_byline text null,
  legacy_catalogue_podcast_id text null,
  identity_status text not null default 'staged' check (identity_status in ('staged', 'bound')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (identity_status = 'staged' and episode_id is null)
    or (identity_status = 'bound' and episode_id is not null)
  ),
  check (
    (parent_status = 'pending_editorial' and canonical_podcast_key is null)
    or (parent_status in ('approved', 'approved_pending_catalogue') and canonical_podcast_key is not null)
  )
);

create unique index editorial_episode_reviews_episode_id_unique
  on public.editorial_episode_reviews (episode_id)
  where episode_id is not null;
create unique index editorial_episode_reviews_legacy_catalogue_id_unique
  on public.editorial_episode_reviews (legacy_catalogue_podcast_id)
  where legacy_catalogue_podcast_id is not null;
create unique index editorial_episode_reviews_content_url_unique
  on public.editorial_episode_reviews (canonical_content_url)
  where canonical_content_url is not null;
create index editorial_episode_reviews_canonical_podcast_key_idx
  on public.editorial_episode_reviews (canonical_podcast_key)
  where canonical_podcast_key is not null;

drop trigger if exists editorial_episode_reviews_set_updated_at on public.editorial_episode_reviews;
create trigger editorial_episode_reviews_set_updated_at
before update on public.editorial_episode_reviews
for each row execute function public.set_updated_at();

alter table public.editorial_episode_reviews enable row level security;
grant select on public.editorial_episode_reviews to anon, authenticated;
create policy "Editorial episode reviews are publicly readable"
on public.editorial_episode_reviews for select to anon, authenticated using (true);

create table private.editorial_episode_review_provenance (
  editorial_episode_review_id uuid primary key
    references public.editorial_episode_reviews(id) on delete cascade,
  legacy_catalogue_snapshot jsonb not null,
  identity_evidence jsonb not null,
  captured_at timestamptz not null default now()
);

alter table private.editorial_episode_review_provenance enable row level security;
revoke all on schema private from anon, authenticated;
revoke all on table private.editorial_episode_review_provenance from anon, authenticated;

insert into public.editorial_episode_reviews (
  id, canonical_podcast_key, parent_label, parent_status, publisher_label,
  canonical_episode_title, canonical_content_url, published_on, editorial_rating,
  editorial_review_date, editorial_review_text, reviewer_byline,
  legacy_catalogue_podcast_id, identity_status
) values
  ('04a7a98b-3406-4010-9d2c-656f0c65c90d', 'der var engang et mal', 'Der var engang et mål', 'approved_pending_catalogue', 'Mediano', 'Der var engang et mål...af Peter Møller mod Farum', 'https://www.mediano.nu/oversigt/2025/6/27/der-var-engang-et-mlaf-peter-mller-mod-farum', null, 7.3, '2025-08-13', null, null, 'der var engang et mal af peter møller mod farum', 'staged'),
  ('6132116a-81b9-4a13-a798-a8b489cdec78', null, 'Transfer Special', 'pending_editorial', 'Mediano', 'Transfer Special - Her er vores bud på de ti spillere, der har været de største transfersucceser i Superligaen', 'https://www.mediano.nu/oversigt/2023/1/27/transfer-special-her-er-vores-bud-p-de-ti-spillere-der-har-vret-de-strste-transfersucceser-i-superligaen', null, 7.3, null, null, null, 'her er vores bud pa de ti spillere har været de største transfersucceser i superligaen', 'staged'),
  ('dffb49f6-7945-4910-aeb7-3a927721e2c6', 'magasinet jennings', 'Magasinet Jennings', 'approved_pending_catalogue', 'Mediano', 'Ciao, Gianni', 'https://www.mediano.nu/oversigt/2026/8/1/ciao-gianni', '2026-08-01', 7.0, '2026-08-02', null, null, 'ciao gianni', 'staged'),
  ('17f9eb71-ee8a-4d43-8410-e7ce5decd0da', 'klub mediano', 'Klub Mediano', 'approved', 'Mediano', 'Klub Mediano: Vi præsenterer Erik Skjærbæk - Et portræt af FC Københavns stærke mand', 'https://www.mediano.nu/oversigt/2025/1/1/klub-mediano-vi-prsenterer-erik-skjrbk-et-portrt-af-fc-kbenhavns-strke-mand', null, 6.7, null, null, null, 'vi præsenterer erik skjærbæk', 'staged'),
  ('815a6b88-4d0a-46d4-b707-ba2add556eb6', 'klub mediano', 'Klub Mediano', 'approved', 'Mediano', 'Klub Mediano: Sådan blev han Victor Froholdt', 'https://www.mediano.nu/oversigt/2025/5/30/klub-mediano-viktor-froholdt', null, 6.7, '2025-06-23', null, null, 'sadan blev han victor froholdt', 'staged'),
  ('2b3ea8b9-947d-4ec6-934f-be84085ab28e', null, 'Mediano Special', 'pending_editorial', 'Mediano', 'Mediano Special - sagen om de 15 point, der forsvandt fra inderlommen af Den Gamle Dame', 'https://www.mediano.nu/oversigt/2023/1/26/mediano-special-om-de-15-point-der-forsvandt-fra-inderlommen-af-den-gamle-dame', null, 6.7, null, null, null, 'sagen om de 15 point forsvandt fra i lommen af den gamle dame', 'staged'),
  ('96da10ec-c07d-4e27-9579-8492155e9a96', 'bruchmann ringer til', 'Brüchmann ringer til', 'approved_pending_catalogue', 'Mediano', 'Brüchmann ringer til #7: Kristjaan Speakmann, FC København', 'https://www.mediano.nu/oversigt/bruchmann-ringer-til-7-speakmann', null, 5.8, '2026-07-17', null, null, 'kristjaan speakmann', 'staged');

insert into private.editorial_episode_review_provenance (
  editorial_episode_review_id, legacy_catalogue_snapshot, identity_evidence
) values
  ('04a7a98b-3406-4010-9d2c-656f0c65c90d',
   '{"Titel":"Der var engang et mål...af Peter Møller mod Farum","Vært":"Gisle Thorsen & Rasmus Monnerup","Vuring (1-10)":"7,3","Genre":"Fodbold","Udgiver":"Mediano","Antal afsnit":"1","Årstal afspillet":"2025","Link":"https://www.mediano.nu/oversigt/2025/6/27/der-var-engang-et-mlaf-peter-mller-mod-farum","Afgivet vurdering":"13-08-2025","Billedlink":"https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/1734814778696-D3YD9G3CPWE799BSEX4V/sparekassen-kronjylland.jpg","Kort beskrivelse":"Mediano genfortæller Peter Møllers mål mod Farum og historien omkring kampen.","Lang beskrivelse":"Gisle Thorsen og Rasmus Monnerup genbesøger Peter Møllers mindeværdige mål mod Farum. Gennem kampens forløb, samtidens fodboldmiljø og historierne omkring spillerne fortæller de om et øjeblik, der har fået sin egen plads i dansk fodboldhistorie.","Placering":"187","Podcast-ID":"der var engang et mal af peter møller mod farum","catalogue_id":"catalogue-v1-9403a2bc","secondaryGenre":"Historie","topics":["Dansk fodboldhistorie","ikoniske mål","kampfortællinger"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/oversigt/2025/6/27/der-var-engang-et-mlaf-peter-mller-mod-farum","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"mediano superliga; superliga for voksne; f c københavn","supplementarySimilarities":[{"title":"mediano superliga","hostQualifier":null},{"title":"superliga for voksne","hostQualifier":null},{"title":"f c københavn","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page"}'::jsonb),
  ('6132116a-81b9-4a13-a798-a8b489cdec78',
   '{"Titel":"Her er vores bud på de ti spillere,  har været de største transfersucceser i Superligaen","Vært":"Rasmus Monnerup, Gisle Thorsen & Klaus Egelund","Vuring (1-10)":"7,3","Genre":"Fodbold","Udgiver":"Mediano","Hovedserie":"Transfer Special","Antal afsnit":"1","Link":"https://medianomedia.squarespace.com/oversigt/2023/1/27/transfer-special-her-er-vores-bud-p-de-ti-spillere-der-har-vret-de-strste-transfersucceser-i-superligaen","Billedlink":"https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/1674853050658-VB5D8W0XABYMDLCBQWY9/Getty%2BSilhout.jpg","Kort beskrivelse":"Mediano vurderer de største transfersucceser i Superligaen.","Lang beskrivelse":"Medianos eksperter udpeger og diskuterer ti af de mest succesfulde spillerhandler i Superligaens historie. De vurderer spillernes betydning, klubbernes økonomiske gevinst og de sportslige omstændigheder, der gjorde netop disse transfers særligt vellykkede.","Placering":"199","Podcast-ID":"her er vores bud pa de ti spillere har været de største transfersucceser i superligaen","catalogue_id":"catalogue-v1-3bda0c46","secondaryGenre":"Samfund","topics":["Superligaen","transfermarkedet","fodboldøkonomi"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://medianomedia.squarespace.com/oversigt/2023/1/27/transfer-special-her-er-vores-bud-p-de-ti-spillere-der-har-vret-de-strste-transfersucceser-i-superligaen","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"transferguru; transfer talk; mediano transfer; transfervinduet","supplementarySimilarities":[{"title":"transferguru","hostQualifier":null},{"title":"transfer talk","hostQualifier":null},{"title":"mediano transfer","hostQualifier":null},{"title":"transfervinduet","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","parent":"pending_editorial"}'::jsonb),
  ('dffb49f6-7945-4910-aeb7-3a927721e2c6',
   '{"Titel":"Ciao, Gianni","Vært":"Nicklas Degn & Peter Brüchmann","Vuring (1-10)":"7","Genre":"Sport","Udgiver":"Mediano","Hovedserie":"Jennings","Antal afsnit":"1","Årstal afspillet":"2026","Link":"https://www.mediano.nu/oversigt/tag/Jennings","Afgivet vurdering":"02-08-2026","Billedlink":"https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/1785593092893-LBA315BIRIXSZ0V0UVQY/GettyImages-2225126075.jpg?format=1000w","Kort beskrivelse":"Om krisen omkring Gianni Infantino og hans fremtid som FIFA-præsident.","Lang beskrivelse":"Nicklas Degn og Peter Brüchmann undersøger den voksende modstand mod Gianni Infantino og spekulationerne om hans fremtid som FIFA-præsident. Udsendelsen gennemgår hans magtposition, forholdet til UEFA og Donald Trump samt spørgsmålet om, hvem der kan overtage ledelsen af FIFA.","Placering":"243","Podcast-ID":"ciao gianni","catalogue_id":"catalogue-v1-81a24e16","secondaryGenre":"Samfund","topics":["Gianni Infantino","FIFA","fodboldpolitik","sportsledelse"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/oversigt/tag/Jennings","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"gianni infantino; blodbold; aftalt spil; fodboldpolitik; mediano sport og perspektiv","supplementarySimilarities":[{"title":"gianni infantino","hostQualifier":null},{"title":"blodbold","hostQualifier":null},{"title":"aftalt spil","hostQualifier":null},{"title":"fodboldpolitik","hostQualifier":null},{"title":"mediano sport og perspektiv","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","labels":["Magasinet Jennings","Jennings Breaking","Mediano Breaking"]}'::jsonb),
  ('17f9eb71-ee8a-4d43-8410-e7ce5decd0da',
   '{"Titel":"Vi præsenterer Erik Skjærbæk","Vært":"Gisle Thorsen & Thomas Pyndt","Vuring (1-10)":"6,7","Genre":"Fodbold","Udgiver":"Mediano","Hovedserie":"Klub Mediano","Antal afsnit":"1","Årstal afspillet":"2025","Link":"https://www.mediano.nu/oversigt/2025/1/1/klub-mediano-vi-prsenterer-erik-skjrbk-et-portrt-af-fc-kbenhavns-strke-mand","Billedlink":"https://i.scdn.co/image/ab67656300005f1f1bb1ecfb8287fffafd8f9c21","Kort beskrivelse":"Mediano præsenterer Erik Skjærbæk og hans blik på fodboldens verden.","Lang beskrivelse":"Mediano tegner et portræt af Erik Skjærbæk og hans arbejde og erfaringer fra fodboldens verden. Gennem en længere samtale fortæller han om sin karriere, sit syn på sporten og de mennesker og beslutninger, der har formet hans vej.","Placering":"283","Podcast-ID":"vi præsenterer erik skjærbæk","catalogue_id":"catalogue-v1-3987a4b4","secondaryGenre":"Dokumentar","topics":["Fodboldledelse","karriere i fodbold"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/oversigt/2025/1/1/klub-mediano-vi-prsenterer-erik-skjrbk-et-portrt-af-fc-kbenhavns-strke-mand","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"mediano business; mediano moneyball; købmændenes klub; spillet bag spillet","supplementarySimilarities":[{"title":"mediano business","hostQualifier":null},{"title":"mediano moneyball","hostQualifier":null},{"title":"købmændenes klub","hostQualifier":null},{"title":"spillet bag spillet","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","private_rss_binding":"not_yet_available"}'::jsonb),
  ('815a6b88-4d0a-46d4-b707-ba2add556eb6',
   '{"Titel":"Sådan blev han Victor Froholdt","Vært":"Sebastian Stanbury","Vuring (1-10)":"6,7","Genre":"Fodbold","Udgiver":"Mediano","Hovedserie":"Klub Mediano","Antal afsnit":"1","Årstal afspillet":"2025","Link":"https://www.mediano.nu/oversigt/2025/5/30/klub-mediano-viktor-froholdt","Afgivet vurdering":"23-06-2025","Billedlink":"https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/1734814778696-D3YD9G3CPWE799BSEX4V/sparekassen-kronjylland.jpg","Kort beskrivelse":"Portræt af Victor Froholdt og vejen mod gennembruddet i fodbold.","Lang beskrivelse":"Mediano fortæller historien om Victor Froholdt og hans vej fra ungdomsfodbold til gennembruddet på højeste niveau. Gennem samtaler med mennesker omkring ham beskriver podcasten hans udvikling, spillemæssige kvaliteter og de valg, der har formet hans unge karriere.","Placering":"285","Podcast-ID":"sadan blev han victor froholdt","catalogue_id":"catalogue-v1-a955bb7e","secondaryGenre":"Dokumentar","topics":["Talentudvikling","ungdomsfodbold","fodboldgennembrud"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/oversigt/2025/5/30/klub-mediano-viktor-froholdt","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"den store talentserie; nordsjælland dreamin; kristjaan speakmann; indersiden med viktor fischer; spiller til spiller","supplementarySimilarities":[{"title":"den store talentserie","hostQualifier":null},{"title":"nordsjælland dreamin","hostQualifier":null},{"title":"kristjaan speakmann","hostQualifier":null},{"title":"indersiden med viktor fischer","hostQualifier":null},{"title":"spiller til spiller","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","private_rss_binding":"not_yet_available"}'::jsonb),
  ('2b3ea8b9-947d-4ec6-934f-be84085ab28e',
   '{"Titel":"Sagen om de 15 point,  forsvandt fra i lommen af Den Gamle Dame","Vært":"Karsten Krogh, Nicklas Degn, Kenneth Hansen","Vuring (1-10)":"6,7","Genre":"Fodbold","Udgiver":"Mediano","Hovedserie":"Mediano Special","Antal afsnit":"1","Billedlink":"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjh6HZzWNn_zg0UXCy0WpILurOU3gZZ6QmNTWmFPLG55EMKn2MIXzkQF0&s=10","Kort beskrivelse":"Mediano forklarer Juventus-sagen og de 15 point, der forsvandt.","Lang beskrivelse":"Mediano gennemgår sagen, hvor Juventus blev frataget 15 point i den italienske liga. Podcasten forklarer de økonomiske dispositioner, myndighedernes undersøgelse og den sportslige og politiske strid, der opstod omkring en af Italiens største klubber.","Placering":"298","Podcast-ID":"sagen om de 15 point forsvandt fra i lommen af den gamle dame","catalogue_id":"catalogue-v1-ed8aabd1","secondaryGenre":"Samfund","topics":["Juventus","fodboldøkonomi","sportsjura","økonomiske uregelmæssigheder"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/faq","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"aftalt spil; blodbold; fodboldpolitik; mediano business; spillet bag spillet","supplementarySimilarities":[{"title":"aftalt spil","hostQualifier":null},{"title":"blodbold","hostQualifier":null},{"title":"fodboldpolitik","hostQualifier":null},{"title":"mediano business","hostQualifier":null},{"title":"spillet bag spillet","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","parent":"pending_editorial"}'::jsonb),
  ('96da10ec-c07d-4e27-9579-8492155e9a96',
   '{"Titel":"Kristjaan Speakmann","Vært":"Peter Brüchmann","Vuring (1-10)":"5,8","Genre":"Fodbold","Udgiver":"Mediano","Hovedserie":"Brüchmann ringer til","Antal afsnit":"1","Årstal afspillet":"2026","Link":"https://www.mediano.nu/oversigt/bruchmann-ringer-til-7-speakmann","Afgivet vurdering":"17-07-2026","Billedlink":"https://images.squarespace-cdn.com/content/v1/573c1b7d01dbae9b52cd0936/1784138248365-C28VKPODRE3PHRDRSQ2D/GettyImages-2236181604.jpg","Kort beskrivelse":"Peter Brüchmann taler med FC Københavns nye fodbolddirektør Kristjaan Speakmann om klubbens retning, transfers og hans erfaringer fra engelsk fodbold.","Lang beskrivelse":"Peter Brüchmann taler med Kristjaan Speakman om hans nye rolle som fodbolddirektør i F.C. København. Samtalen handler om klubbens retning, transfers, talentudvikling og de erfaringer, han tager med sig fra mange års arbejde i engelsk fodbold.","Placering":"433","Podcast-ID":"kristjaan speakmann","catalogue_id":"catalogue-v1-0b6312bf","secondaryGenre":"Samfund","topics":["F.C. København","sportsledelse","transferstrategi","talentudvikling"],"isEnglish":false,"accessType":"partial","accessEvidenceUrl":"https://www.mediano.nu/oversigt/bruchmann-ringer-til-7-speakmann","accessCheckedAt":"2026-09-04","supplementarySimilaritiesRaw":"f c københavn; troels bech i en samtale; klub mediano; nordsjælland dreamin; landsholdets analytiker mounir akhiat; sadan blev han victor froholdt","supplementarySimilarities":[{"title":"f c københavn","hostQualifier":null},{"title":"troels bech i en samtale","hostQualifier":null},{"title":"klub mediano","hostQualifier":null},{"title":"nordsjælland dreamin","hostQualifier":null},{"title":"landsholdets analytiker mounir akhiat","hostQualifier":null},{"title":"sadan blev han victor froholdt","hostQualifier":null}]}'::jsonb,
   '{"identity":"confirmed_mediano_page","source":"public_mediano_page","private_rss_binding":"not_yet_available"}'::jsonb);
