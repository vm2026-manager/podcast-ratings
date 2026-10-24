// Read-only production audit, 2026-10-24: these rows have existing episodes
// whose canonical podcast_key and metadata.podimo_podcast_id exactly match the
// published Sheet. Their latest public Podimo episode is within 45 days.
// Runtime activation still requires an exact GUID overlap before any writes.
export const PODIMO_ONGOING_HISTORICAL_SOURCES = [
  { podcast_key: "banderelateret", source: "podimo_banderelateret", podcast_id: "075c140c-4c5c-4ccb-8120-8ac47ce0acea" },
  { podcast_key: "lang levetid podcast", source: "podimo_lang_levetid_podcast", podcast_id: "f4ac53b6-2903-4397-aee3-4092d83af25f" },
  { podcast_key: "mandsholdseffekten", source: "podimo_mandsholdseffekten", podcast_id: "c6a15bad-d95b-4122-8939-c4a30e5440fa" },
  { podcast_key: "den man tugter", source: "podimo_den_man_tugter", podcast_id: "0f251684-5cca-43a0-bc0e-1e044adeaa3b" },
  { podcast_key: "her gar det godt", source: "podimo_her_gar_det_godt", podcast_id: "c6ec0b3e-c71b-470c-ac39-f5fda8fee203" },
  { podcast_key: "elastico", source: "podimo_elastico", podcast_id: "80d18496-408b-4242-a731-f141b5474da6" },
  { podcast_key: "vanvittig verdenshistorie med venner", source: "podimo_vanvittig_verdenshistorie_med_venner", podcast_id: "34cdc920-5796-4335-9e3f-834b6a59d215" },
  { podcast_key: "udenrigsministrene podimo seidelin kingo", source: "podimo_udenrigsministrene_podimo_seidelin_kingo", podcast_id: "8e005298-2fdc-45a9-b469-491049b28d38" }
] as const;
