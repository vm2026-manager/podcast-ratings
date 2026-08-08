export type FeedFormat = "rss" | "radio4_json";

export type FeedConfig = {
  podcast_key: string;
  source: string;
  feed_url: string;
  format?: FeedFormat;
  // New feeds are scheduled by default. Set this to false only when a feed
  // should remain configured but must be excluded from the shared importer.
  enabled?: boolean;
  // Generated sheet entries are replaced from PODCASTS_JSON_URL at runtime.
  generated_from_sheet?: boolean;
};

export type FeedConfigMap = Record<string, FeedConfig>;

export const FEED_CONFIGS: FeedConfigMap = {
  "genstart": {
    podcast_key: "genstart",
    source: "dr_genstart_rss",
    format: "radio4_json",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/genstart.xml?format=podcast"
  },

  "det_vi_taler_om": {
    podcast_key: "det vi taler om",
    source: "radio4_det_vi_taler_om_rss",
    format: "radio4_json",
    feed_url: "https://radio4.dk/api/programs/1569c4cf-003d-492d-945b-b39800d86f5d/episodes?orderBy=published&order=desc&limit=25"
  },

  "morkeland": {
    podcast_key: "mørkeland",
    source: "podplay_morkeland_rss",
    feed_url: "https://rss.podplaystudio.com/1032.xml"
  },

  "verdens_klogeste_land": {
    podcast_key: "verdens klogeste land",
    source: "simplecast_verdens_klogeste_land_rss",
    feed_url: "https://feeds.simplecast.com/0iCvEZ1r"
  },

  "borgen_unplugged_2_0": {
    podcast_key: "borgen unplugged 2 0",
    source: "soundcloud_borgen_unplugged_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss"
  },

  "jagten_paa_det_evige_liv": {
    podcast_key: "jagten på det evige liv",
    source: "dr_jagten_paa_det_evige_liv_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/jagten-paa-det-evige-liv.xml?format=podcast"
  },

  "hva_saa": {
    podcast_key: "hva så",
    source: "simplecast_hva_saa_rss",
    feed_url: "https://feeds.simplecast.com/Sx_KSW_a"
  },

  "112_for_knuste_hjerter": {
    podcast_key: "112 for knuste hjerter",
    source: "spreaker_112_for_knuste_hjerter_rss",
    feed_url: "https://www.spreaker.com/show/4961180/episodes/feed"
  },

  "langt_fra_lognen": {
    podcast_key: "langt fra løgnen",
    source: "radio4_langt_fra_lognen_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/ef4988a6-bd27-432c-af66-b39900b38278/7d5c52ff-2f88-45c2-a2e8-b39900b38693/podcast.rss"
  },

  "dkpol": {
    podcast_key: "dkpol",
    source: "acast_dkpol_rss",
    feed_url: "https://feeds.acast.com/public/shows/61a5eeac54ee100013a59fc1"
  },

  "millionaerklubben": {
    podcast_key: "millionærklubben",
    source: "omny_millionaerklubben_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/1283f5f4-2508-4981-a99f-acb500e64dcf/27dfeb66-f61a-4fcc-aa6d-ad0800b05139/dc61232c-7e07-438e-981a-ad0800b05142/podcast.rss"
  },

  "sagen_genaabnet": {
    podcast_key: "sagen genåbnet",
    source: "simplecast_sagen_genaabnet_rss",
    feed_url: "https://feeds.simplecast.com/a9oRWwkE"
  },

  "vi_ser_paa_det": {
    podcast_key: "vi ser på det",
    source: "radio4_vi_ser_paa_det_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/e44b8d36-d752-41df-81f5-b2eb00b5cd69/60cece64-81a0-4758-b200-b2eb00b5d2b9/podcast.rss"
  },

  "marcus_og_realitypanelet": {
    podcast_key: "marcus og realitypanelet",
    source: "spreaker_marcus_og_realitypanelet_rss",
    feed_url: "https://www.spreaker.com/show/5669466/episodes/feed"
  },

  "borgerlig_tabloid": {
    podcast_key: "borgerlig tabloid",
    source: "omny_borgerlig_tabloid_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/1283f5f4-2508-4981-a99f-acb500e64dcf/a8df889a-1ef0-40fd-94bb-af1e00cff416/89869564-4bca-4df0-bca3-af1e00d05284/podcast.rss"
  },

  "magten": {
    podcast_key: "magten",
    source: "dr_magten_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/slotsholmen"
  },

  "frontlinjen": {
    podcast_key: "frontlinjen",
    source: "omny_frontlinjen_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/26a394b6-bb29-44cb-86ae-ad4800e68f25/53456d7d-3279-4ec3-916e-ad4800e68f2e/podcast.rss"
  },

  "sig_det_loegn": {
    podcast_key: "sig det løgn",
    source: "omny_sig_det_loegn_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/5dc13326-10a9-4001-a42a-ae89005d1415/ec5db2e9-c7c2-4115-b6a7-ae89005efd15/podcast.rss"
  },

  "aegte_par": {
    podcast_key: "ægte par",
    source: "omny_aegte_par_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/2ea14cbf-00be-4ae3-b533-b43200757bdf/a02ea517-5ab2-40ee-aadd-b43200758166/podcast.rss"
  },

  "aftalt_spil": {
    podcast_key: "aftalt spil",
    source: "omny_aftalt_spil_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/6c770d83-49db-4a52-8c1c-b4630072714a/c841749c-e2b8-4d8c-a0f6-b46300727593/podcast.rss"
  },

  "alt_det_vi_arver": {
    podcast_key: "alt det vi arver",
    source: "omny_alt_det_vi_arver_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/07431c6a-28a1-4961-987a-b47200d1be71/3a38300d-b692-4cf5-8a6e-b47200d1c322/podcast.rss"
  },

  "boernefri": {
    podcast_key: "børnefri",
    source: "omny_boernefri_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/262c3b36-6d2a-46cc-b4ff-b1c6008964f3/2383e53e-c396-4a36-bbb7-b1c6008c379a/podcast.rss"
  },

  "boersen_braender": {
    podcast_key: "børsen brænder",
    source: "omny_boersen_braender_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/a9a80167-49ec-4598-9ec5-ad4800e693e3/33f428b7-2f95-4d9d-92a8-ad4800e693e8/podcast.rss"
  },

  "du_er_ikke_alene": {
    podcast_key: "du er ikke alene",
    source: "omny_du_er_ikke_alene_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/77739099-b0ae-439a-ba42-ad4800b0bb89/7c2ff43c-f90b-4198-b81a-ad4800b0bb8e/podcast.rss"
  },

  "epstein_filerne": {
    podcast_key: "epstein filerne",
    source: "omny_epstein_filerne_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/871f2ea3-7923-4eb9-82c9-b3fd0095b10e/b7de45d1-fea4-4d85-9c75-b3fd0095b988/podcast.rss"
  },

  "europa_i_krig": {
    podcast_key: "europa i krig",
    source: "omny_europa_i_krig_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/a7be809e-e8eb-4b1d-96c6-b33000d86d0e/2f907f30-3c9b-4688-84ad-b33000d872a6/podcast.rss"
  },

  "fixerummet": {
    podcast_key: "fixerummet",
    source: "omny_fixerummet_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/d7a20df2-5d54-424f-bf7b-b1cb007ee4e6/4d0f2750-bc5d-4e70-ade2-b1cb00808e08/podcast.rss"
  },

  "har_du_hoert": {
    podcast_key: "har du hørt",
    source: "omny_har_du_hoert_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/27e90989-ce53-4ba3-ae6a-ad4800e68fc9/b0a50925-4c9f-47f5-81b7-ad4800e68fd2/podcast.rss"
  },

  "hvis_du_vil_vide_mere": {
    podcast_key: "hvis du vil vide mere",
    source: "omny_hvis_du_vil_vide_mere_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/d2ccda6d-5d3f-49a5-93b3-b1c000a80c9b/f383b6b9-68d4-4aba-ac9c-b1c000a9c06e/podcast.rss"
  },

  "loegn_og_morfin": {
    podcast_key: "løgn og morfin",
    source: "omny_loegn_og_morfin_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/46fcf984-bb68-4608-9842-ae6a00e09400/22bdbf38-0046-47cd-90a7-ae6a00e21e6f/podcast.rss"
  },

  "mathias_helts_talkshow": {
    podcast_key: "mathias helts talkshow",
    source: "omny_mathias_helts_talkshow_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/ad004ce7-93d5-4253-814d-b0de00e4c9e5/5ce4dab5-d3b0-4199-b796-b0de00ed4d57/podcast.rss"
  },

  "only_in_america": {
    podcast_key: "only in america",
    source: "omny_only_in_america_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/b672af00-1456-4b2e-b3c2-afbe0083aba4/e0d94ab6-e7d9-4aaa-94dd-afbe008b0d0a/podcast.rss"
  },

  "portraetalbum": {
    podcast_key: "portrætalbum",
    source: "omny_portraetalbum_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/d32c8e84-d488-459e-982c-ae1900df1a62/19111071-6b3e-469e-a67f-ae1900dfd1f2/podcast.rss"
  },

  "skytsenglen": {
    podcast_key: "skytsenglen",
    source: "omny_skytsenglen_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/c586c92c-b5ea-42ec-baf6-b2ea00b687d8/f88d9d88-9a5e-453f-afeb-b2ea00b68d19/podcast.rss"
  },

  "vaagn_lidt_op": {
    podcast_key: "vågn lidt op",
    source: "omny_vaagn_lidt_op_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/0103ecf3-d5d8-4b67-92a0-b1f700db1986/3a07fb86-54b1-4b71-86c2-b1f700ddc7b4/podcast.rss"
  },

  // BEGIN GENERATED SHEET FEEDS
  // Generated by scripts/generate-feed-config-from-podcasts.mjs. Do not edit by hand.
  "den_korte_podcast": {
    podcast_key: "den korte podcast",
    source: "sheet_den_korte_podcast_rss",
    feed_url: "https://fourble.co.uk/dkr2024-260805-7.rss",
    generated_from_sheet: true
  },
  "guld_og_grønne_skove": {
    podcast_key: "guld og grønne skove",
    source: "sheet_guld_og_grønne_skove_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/guld-og-groenne-skove",
    generated_from_sheet: true
  },
  "brinkmanns_briks": {
    podcast_key: "brinkmanns briks",
    source: "sheet_brinkmanns_briks_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/brinkmanns-briks",
    generated_from_sheet: true
  },
  "adfærd": {
    podcast_key: "adfærd",
    source: "sheet_adfærd_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:154832827/sounds.rss",
    generated_from_sheet: true
  },
  "tabloid": {
    podcast_key: "tabloid",
    source: "sheet_tabloid_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/tabloid-3",
    generated_from_sheet: true
  },
  "tiden": {
    podcast_key: "tiden",
    source: "sheet_tiden_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/tiden",
    generated_from_sheet: true
  },
  "prompt": {
    podcast_key: "prompt",
    source: "sheet_prompt_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/prompt",
    generated_from_sheet: true
  },
  "livet_ifølge_emil_og_thomas": {
    podcast_key: "livet ifølge emil og thomas",
    source: "sheet_livet_ifølge_emil_og_thomas_rss",
    feed_url: "https://feeds.simplecast.com/TBCuWUyN",
    generated_from_sheet: true
  },
  "station_llll": {
    podcast_key: "station llll",
    source: "sheet_station_llll_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/ba817502-00ef-4a30-a661-b1e000d86d41/2db04a75-66a0-46a3-a869-b1e000dfe1ad/podcast.rss",
    generated_from_sheet: true
  },
  "altinget_ajour": {
    podcast_key: "altinget ajour",
    source: "sheet_altinget_ajour_rss",
    feed_url: "https://feeds.acast.com/public/shows/e0a05b05-4086-405c-9edd-1ebce8ec89b6",
    generated_from_sheet: true
  },
  "kvart_i_bold": {
    podcast_key: "kvart i bold",
    source: "sheet_kvart_i_bold_rss",
    feed_url: "https://feeds.acast.com/public/shows/60360b096386dc3ac1a645a5",
    generated_from_sheet: true
  },
  "nu_snakker_vi_om_det": {
    podcast_key: "nu snakker vi om det",
    source: "sheet_nu_snakker_vi_om_det_rss",
    feed_url: "https://rss.libsyn.com/shows/249365/destinations/1877210.xml",
    generated_from_sheet: true
  },
  "lyssky": {
    podcast_key: "lyssky",
    source: "sheet_lyssky_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/lyssky",
    generated_from_sheet: true
  },
  "ikke_et_ord_om_politik": {
    podcast_key: "ikke et ord om politik",
    source: "sheet_ikke_et_ord_om_politik_rss",
    feed_url: "https://www.spreaker.com/show/5968966/episodes/feed",
    generated_from_sheet: true
  },
  "ugens_suppe": {
    podcast_key: "ugens suppe",
    source: "sheet_ugens_suppe_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/6805c8af-abba-4e80-9e1b-b13f00dd44af/4025528b-a7eb-49f7-a261-b13f00de1e25/podcast.rss",
    generated_from_sheet: true
  },
  "damerne_først": {
    podcast_key: "damerne først",
    source: "sheet_damerne_først_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/damerne-foerst",
    generated_from_sheet: true
  },
  "fodboldlisten": {
    podcast_key: "fodboldlisten",
    source: "sheet_fodboldlisten_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/fodboldlisten",
    generated_from_sheet: true
  },
  "f_c_københavns_fanradio": {
    podcast_key: "f c københavns fanradio",
    source: "sheet_f_c_københavns_fanradio_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:135167893/sounds.rss",
    generated_from_sheet: true
  },
  "primus_optimus_det_irrationelle_menneske": {
    podcast_key: "primus optimus det irrationelle menneske",
    source: "sheet_primus_optimus_det_irrationelle_menneske_rss",
    feed_url: "https://rss.podplaystudio.com/1091.xml",
    generated_from_sheet: true
  },
  "magtindsigt_visbys_verden": {
    podcast_key: "magtindsigt visbys verden",
    source: "sheet_magtindsigt_visbys_verden_rss",
    feed_url: "https://rss.buzzsprout.com/245087.rss",
    generated_from_sheet: true
  },
  "panser": {
    podcast_key: "panser",
    source: "sheet_panser_rss",
    feed_url: "https://rss.art19.com/panser",
    generated_from_sheet: true
  },
  "darlig_stemning": {
    podcast_key: "darlig stemning",
    source: "sheet_darlig_stemning_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/daarlig-stemning",
    generated_from_sheet: true
  },
  "bagstiv_sidste_censurfri_zone": {
    podcast_key: "bagstiv sidste censurfri zone",
    source: "sheet_bagstiv_sidste_censurfri_zone_rss",
    feed_url: "https://feeds.simplecast.com/7bDXOWbk",
    generated_from_sheet: true
  },
  "b_t_valgkamp": {
    podcast_key: "b t valgkamp",
    source: "sheet_b_t_valgkamp_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/1283f5f4-2508-4981-a99f-acb500e64dcf/9bb41e53-28fa-4a3d-899b-ad0800ae3d37/00ad7c08-8a51-46d7-8e8f-ad0800ae3d41/podcast.rss",
    generated_from_sheet: true
  },
  "reality_tjek": {
    podcast_key: "reality tjek",
    source: "sheet_reality_tjek_rss",
    feed_url: "https://feeds.acast.com/public/shows/reality-tjek",
    generated_from_sheet: true
  },
  "følsom_tonser": {
    podcast_key: "følsom tonser",
    source: "sheet_følsom_tonser_rss",
    feed_url: "https://anchor.fm/s/f5931188/podcast/rss",
    generated_from_sheet: true
  },
  "absalons_radio": {
    podcast_key: "absalons radio",
    source: "sheet_absalons_radio_rss",
    feed_url: "https://rss.buzzsprout.com/883612.rss",
    generated_from_sheet: true
  },
  "fries_before_guys": {
    podcast_key: "fries before guys",
    source: "sheet_fries_before_guys_rss",
    feed_url: "https://rss.libsyn.com/shows/108204/destinations/587954.xml",
    generated_from_sheet: true
  },
  "voksendating": {
    podcast_key: "voksendating",
    source: "sheet_voksendating_rss",
    feed_url: "https://feeds.simplecast.com/xQXpgwsc",
    generated_from_sheet: true
  },
  "momkind_podcast": {
    podcast_key: "momkind podcast",
    source: "sheet_momkind_podcast_rss",
    feed_url: "https://feeds.simplecast.com/ngIW0Sme",
    generated_from_sheet: true
  },
  "store_penge": {
    podcast_key: "store penge",
    source: "sheet_store_penge_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/3fbe8edc-3bc4-464e-9bcf-b11100854baf/077d3658-064a-4a8d-8f3d-b11100854dff/podcast.rss",
    generated_from_sheet: true
  },
  "avistid": {
    podcast_key: "avistid",
    source: "sheet_avistid_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/1283f5f4-2508-4981-a99f-acb500e64dcf/fb3a977a-4990-43b8-a721-ad0800b112ce/e0860d64-3c50-4ea3-8817-ad0800b112e1/podcast.rss",
    generated_from_sheet: true
  },
  "historien_om_alt": {
    podcast_key: "historien om alt",
    source: "sheet_historien_om_alt_rss",
    feed_url: "https://rss.art19.com/historien-om-alt",
    generated_from_sheet: true
  },
  "friis_diplomatpost": {
    podcast_key: "friis diplomatpost",
    source: "sheet_friis_diplomatpost_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/88c335ba-6520-4de0-97b0-ad3a00d192cf/ecc6d888-f515-4503-b845-ad3d01309f8d/87ba21bb-905f-4fc1-bcf3-ae470110fd21/podcast.rss",
    generated_from_sheet: true
  },
  "single": {
    podcast_key: "single",
    source: "sheet_single_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/ffb9c298-61e2-4ef9-bf96-b3a000f53480/7c14ad4f-a266-4547-b0d4-b3a000f5390c/podcast.rss",
    generated_from_sheet: true
  },
  "hemmeligheder": {
    podcast_key: "hemmeligheder",
    source: "sheet_hemmeligheder_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/hemmeligheder-2",
    generated_from_sheet: true
  },
  "stjerner_og_striber": {
    podcast_key: "stjerner og striber",
    source: "sheet_stjerner_og_striber_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/stjerner-og-striber-podcast",
    generated_from_sheet: true
  },
  "bag_om_forbrydelsen": {
    podcast_key: "bag om forbrydelsen",
    source: "sheet_bag_om_forbrydelsen_rss",
    feed_url: "https://feeds.acast.com/public/shows/bag-om-forbrydelsen",
    generated_from_sheet: true
  },
  "mord_down_under": {
    podcast_key: "mord down under",
    source: "sheet_mord_down_under_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:998126356/sounds.rss",
    generated_from_sheet: true
  },
  // END GENERATED SHEET FEEDS
};

// The shared scheduled import reads this list at runtime, so adding a feed
// configuration automatically includes it unless it is explicitly disabled.
export function getEnabledFeedKeys(): string[] {
  return Object.entries(FEED_CONFIGS)
    .filter(([, config]) => config.enabled !== false)
    .map(([feedKey]) => feedKey);
}
