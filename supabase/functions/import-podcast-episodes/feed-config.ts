export type FeedFormat = "rss" | "radio4_json" | "dr_lyd_next_data" | "apple_podcasts_html";

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
  apple_show_id?: string;
};

export type FeedConfigMap = Record<string, FeedConfig>;

export const FEED_CONFIGS: FeedConfigMap = {
  "apple_1575533784": {
    podcast_key: "mads og a holdet",
    source: "apple_podcasts_1575533784",
    format: "apple_podcasts_html",
    feed_url: "https://podcasts.apple.com/dk/podcast/id1575533784",
    apple_show_id: "1575533784",
    enabled: false
  },
  "genstart": {
    podcast_key: "genstart",
    source: "dr_genstart_rss",
    format: "dr_lyd_next_data",
    feed_url: "https://www.dr.dk/lyd/special-radio/genstart-2642056922000"
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
    podcast_key: "jagten pa det evige liv",
    source: "dr_jagten_paa_det_evige_liv_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/jagten-paa-det-evige-liv.xml?format=podcast"
  },

  "hva_saa": {
    podcast_key: "hva sa",
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
    podcast_key: "sagen genabnet",
    source: "simplecast_sagen_genaabnet_rss",
    feed_url: "https://feeds.simplecast.com/a9oRWwkE"
  },

  "vi_ser_paa_det": {
    podcast_key: "vi ser pa det",
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
    podcast_key: "vagn lidt op",
    source: "omny_vaagn_lidt_op_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/0103ecf3-d5d8-4b67-92a0-b1f700db1986/3a07fb86-54b1-4b71-86c2-b1f700ddc7b4/podcast.rss"
  },

  // BEGIN GENERATED SHEET FEEDS
  // Generated by scripts/generate-feed-config-from-podcasts.mjs. Do not edit by hand.
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
  "du_lytter_til_politiken": {
    podcast_key: "du lytter til politiken",
    source: "sheet_du_lytter_til_politiken_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/8ebf283e-6f42-4edd-83fa-b17f00f7df44/34df3ad1-08b4-4095-90fc-b17f00f7e069/podcast.rss",
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
  "sørine_og_livskraften": {
    podcast_key: "sørine og livskraften",
    source: "sheet_sørine_og_livskraften_rss",
    feed_url: "https://audioboom.com/channels/5115932.rss",
    generated_from_sheet: true
  },
  "borgenudenfilter": {
    podcast_key: "borgenudenfilter",
    source: "sheet_borgenudenfilter_rss",
    feed_url: "https://feeds.simplecast.com/OvoXT1qQ",
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
  "bøvlede_mænd": {
    podcast_key: "bøvlede mænd",
    source: "sheet_bøvlede_mænd_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/504fd940-e457-44cf-9019-abca00be97ea/9573e445-b7d7-47af-aee1-b448009f4a90/20e88c16-511c-4876-b945-b448009f50a0/podcast.rss%20[1]",
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
  "ludvigs_podcast": {
    podcast_key: "ludvigs podcast",
    source: "sheet_ludvigs_podcast_rss",
    feed_url: "https://feeds.simplecast.com/bNBKSjgq",
    generated_from_sheet: true
  },
  "absalons_radio": {
    podcast_key: "absalons radio",
    source: "sheet_absalons_radio_rss",
    feed_url: "https://rss.buzzsprout.com/883612.rss",
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
  "fries_before_guys": {
    podcast_key: "fries before guys",
    source: "sheet_fries_before_guys_rss",
    feed_url: "https://rss.libsyn.com/shows/108204/destinations/587954.xml",
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
  "fodboldlisten": {
    podcast_key: "fodboldlisten",
    source: "sheet_fodboldlisten_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/fodboldlisten",
    generated_from_sheet: true
  },
  "bernstein_cigaretetui": {
    podcast_key: "bernstein cigaretetui",
    source: "sheet_bernstein_cigaretetui_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/504fd940-e457-44cf-9019-abca00be97ea/d5214b28-0234-40b2-bfad-b0f300c8f317/241f965e-0d7b-4262-babc-b0f300c9f366/podcast.rss?type=ApplePremium&accessToken=eyJhbGciOiJIUzI1NiIsImtpZCI6Im40Sk1JTVFQV2tpU3pyRHpBTXBwMVEiLCJ0eXAiOiJKV1QifQ.eyJwbGF5bGlzdCI6IjI0MWY5NjVlLTBkN2ItNDI2Mi1iYWJjLWIwZjMwMGM5ZjM2NiIsImtleSI6IioifQ.AMW7bAqhVc0lP1NpGv_M-sM0qVcH_Adpsjz09ecXVvY",
    generated_from_sheet: true
  },
  "p1_morgen": {
    podcast_key: "p1 morgen",
    source: "sheet_p1_morgen_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/p1-morgen",
    generated_from_sheet: true
  },
  "i_selskab_med_q": {
    podcast_key: "i selskab med q",
    source: "sheet_i_selskab_med_q_rss",
    feed_url: "https://feeds.simplecast.com/GYgQi89q",
    generated_from_sheet: true
  },
  "friis_diplomatpost": {
    podcast_key: "friis diplomatpost",
    source: "sheet_friis_diplomatpost_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/88c335ba-6520-4de0-97b0-ad3a00d192cf/ecc6d888-f515-4503-b845-ad3d01309f8d/87ba21bb-905f-4fc1-bcf3-ae470110fd21/podcast.rss",
    generated_from_sheet: true
  },
  "tal_til_mig": {
    podcast_key: "tal til mig",
    source: "sheet_tal_til_mig_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/tal-til-mig-2",
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
  "morgensutterne": {
    podcast_key: "morgensutterne",
    source: "sheet_morgensutterne_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/504fd940-e457-44cf-9019-abca00be97ea/db118a2e-3dbb-49a3-885c-afee006b4c45/fd30f5a6-7014-4670-a35c-afee006d2c1b/podcast.rss?type=ApplePremium&accessToken=eyJhbGciOiJIUzI1NiIsImtpZCI6IlZqN0FTYVJxdWs2ZWxhX3VBRzR2b3ciLCJ0eXAiOiJKV1QifQ.eyJwbGF5bGlzdCI6ImZkMzBmNWE2LTcwMTQtNDY3MC1hMzVjLWFmZWUwMDZkMmMxYiIsImtleSI6IioifQ.4Q8k8KSVlZ1PIez1w7kUgoy175IeXlXIovLE0SzIR4w",
    generated_from_sheet: true
  },
  "munkens_efterfølger": {
    podcast_key: "munkens efterfølger",
    source: "sheet_munkens_efterfølger_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/504fd940-e457-44cf-9019-abca00be97ea/0def6762-8931-4ed6-930c-b436009bca14/5afa106c-b405-4f0a-9171-b436009bce59/podcast.rss",
    generated_from_sheet: true
  },
  "bag_om_forbrydelsen": {
    podcast_key: "bag om forbrydelsen",
    source: "sheet_bag_om_forbrydelsen_rss",
    feed_url: "https://feeds.acast.com/public/shows/bag-om-forbrydelsen",
    generated_from_sheet: true
  },
  "sara_og_monopolet": {
    podcast_key: "sara og monopolet",
    source: "sheet_sara_og_monopolet_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/mads-monopolet-podcast.xml?format=podcast",
    generated_from_sheet: true
  },
  "det_sidste_maltid": {
    podcast_key: "det sidste maltid",
    source: "sheet_det_sidste_maltid_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/det-sidste-maaltid",
    generated_from_sheet: true
  },
  "børsen_morgenbriefing": {
    podcast_key: "børsen morgenbriefing",
    source: "sheet_børsen_morgenbriefing_rss",
    feed_url: "https://feed.pod.space/borsenmorgenbriefing",
    generated_from_sheet: true
  },
  "dybt_go_nat_dk": {
    podcast_key: "dybt go nat dk",
    source: "sheet_dybt_go_nat_dk_rss",
    feed_url: "https://feeds.simplecast.com/BHMUcDf_",
    generated_from_sheet: true
  },
  "du_kender_typen": {
    podcast_key: "du kender typen",
    source: "sheet_du_kender_typen_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/du-kender-typen",
    generated_from_sheet: true
  },
  "ubegribeligt": {
    podcast_key: "ubegribeligt",
    source: "sheet_ubegribeligt_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/ubegribeligt",
    generated_from_sheet: true
  },
  "flyvende_tallerken": {
    podcast_key: "flyvende tallerken",
    source: "sheet_flyvende_tallerken_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/flyvende-tallerken",
    generated_from_sheet: true
  },
  "elskovspony": {
    podcast_key: "elskovspony",
    source: "sheet_elskovspony_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/hjerteflimmer-for-voksne",
    generated_from_sheet: true
  },
  "første_række": {
    podcast_key: "første række",
    source: "sheet_første_række_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/4-division",
    generated_from_sheet: true
  },
  "anmelderne": {
    podcast_key: "anmelderne",
    source: "sheet_anmelderne_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/anmelderne",
    generated_from_sheet: true
  },
  "k_live": {
    podcast_key: "k live",
    source: "sheet_k_live_rss",
    feed_url: "https://drpodcast.nu/kulturen-pa-p1/feed.xml",
    generated_from_sheet: true
  },
  "bibelen_leth_fortalt": {
    podcast_key: "bibelen leth fortalt",
    source: "sheet_bibelen_leth_fortalt_rss",
    feed_url: "https://drpodcast.nu/bibelen-leth-fortalt/feed.xml",
    generated_from_sheet: true
  },
  "skønlitteratur": {
    podcast_key: "skønlitteratur",
    source: "sheet_skønlitteratur_rss",
    feed_url: "https://drpodcast.nu/skoenlitteratur/feed.xml",
    generated_from_sheet: true
  },
  "parnasset": {
    podcast_key: "parnasset",
    source: "sheet_parnasset_rss",
    feed_url: "https://drpodcast.nu/parnasset/feed.xml",
    generated_from_sheet: true
  },
  "verdens_bedste_film": {
    podcast_key: "verdens bedste film",
    source: "sheet_verdens_bedste_film_rss",
    feed_url: "https://drpodcast.nu/verdens-bedste-film/feed.xml",
    generated_from_sheet: true
  },
  "norsken_svensken_og_dansken": {
    podcast_key: "norsken svensken og dansken",
    source: "sheet_norsken_svensken_og_dansken_rss",
    feed_url: "https://drpodcast.nu/norsken-svensken-og-dansken/feed.xml",
    generated_from_sheet: true
  },
  "popsmart": {
    podcast_key: "popsmart",
    source: "sheet_popsmart_rss",
    feed_url: "https://drpodcast.nu/popsmart/feed.xml",
    generated_from_sheet: true
  },
  "sort_søndag": {
    podcast_key: "sort søndag",
    source: "sheet_sort_søndag_rss",
    feed_url: "https://drpodcast.nu/sort-soendag/feed.xml",
    generated_from_sheet: true
  },
  "10_20_30": {
    podcast_key: "10 20 30",
    source: "sheet_10_20_30_rss",
    feed_url: "https://drpodcast.nu/10-20-30/feed.xml",
    generated_from_sheet: true
  },
  "musikquizzen": {
    podcast_key: "musikquizzen",
    source: "sheet_musikquizzen_rss",
    feed_url: "https://drpodcast.nu/musikquizzen/feed.xml",
    generated_from_sheet: true
  },
  "hvem_er_anton_westerlin": {
    podcast_key: "hvem er anton westerlin",
    source: "sheet_hvem_er_anton_westerlin_rss",
    feed_url: "https://drpodcast.nu/hvem-er-anton-westerlin/feed.xml",
    generated_from_sheet: true
  },
  "langefredag": {
    podcast_key: "langefredag",
    source: "sheet_langefredag_rss",
    feed_url: "https://drpodcast.nu/langefredag/feed.xml",
    generated_from_sheet: true
  },
  "fonk_det_er_podcast": {
    podcast_key: "fonk det er podcast",
    source: "sheet_fonk_det_er_podcast_rss",
    feed_url: "https://drpodcast.nu/fonk-det-er-podcast/feed.xml",
    generated_from_sheet: true
  },
  "formiddag_med_simpson": {
    podcast_key: "formiddag med simpson",
    source: "sheet_formiddag_med_simpson_rss",
    feed_url: "https://drpodcast.nu/formiddag-med-simpson/feed.xml",
    generated_from_sheet: true
  },
  "bangers_med_ena": {
    podcast_key: "bangers med ena",
    source: "sheet_bangers_med_ena_rss",
    feed_url: "https://drpodcast.nu/bangers-med-ena/feed.xml",
    generated_from_sheet: true
  },
  "døde_forældres_klub": {
    podcast_key: "døde forældres klub",
    source: "sheet_døde_forældres_klub_rss",
    feed_url: "https://drpodcast.nu/doede-foraeldres-klub/feed.xml",
    generated_from_sheet: true
  },
  "tættere_pa_himlen": {
    podcast_key: "tættere pa himlen",
    source: "sheet_tættere_pa_himlen_rss",
    feed_url: "https://drpodcast.nu/taettere-paa-himlen/feed.xml",
    generated_from_sheet: true
  },
  "torsdagskoncerten": {
    podcast_key: "torsdagskoncerten",
    source: "sheet_torsdagskoncerten_rss",
    feed_url: "https://drpodcast.nu/torsdagskoncerten/feed.xml",
    generated_from_sheet: true
  },
  "hvem_er_simon_kvamm": {
    podcast_key: "hvem er simon kvamm",
    source: "sheet_hvem_er_simon_kvamm_rss",
    feed_url: "https://drpodcast.nu/hvem-er-simon-kvamm/feed.xml",
    generated_from_sheet: true
  },
  "tyvstart": {
    podcast_key: "tyvstart",
    source: "sheet_tyvstart_rss",
    feed_url: "https://drpodcast.nu/tyvstart/feed.xml",
    generated_from_sheet: true
  },
  "kejserens_nye_klub": {
    podcast_key: "kejserens nye klub",
    source: "sheet_kejserens_nye_klub_rss",
    feed_url: "https://drpodcast.nu/kejserens-nye-klub/feed.xml",
    generated_from_sheet: true
  },
  "sommeren_21": {
    podcast_key: "sommeren 21",
    source: "sheet_sommeren_21_rss",
    feed_url: "https://drpodcast.nu/sommeren-21/feed.xml",
    generated_from_sheet: true
  },
  "forført_af_fart": {
    podcast_key: "forført af fart",
    source: "sheet_forført_af_fart_rss",
    feed_url: "https://drpodcast.nu/forfoert-af-fart/feed.xml",
    generated_from_sheet: true
  },
  "giganterne": {
    podcast_key: "giganterne",
    source: "sheet_giganterne_rss",
    feed_url: "https://drpodcast.nu/giganterne/feed.xml",
    generated_from_sheet: true
  },
  "rolf_er_rørt": {
    podcast_key: "rolf er rørt",
    source: "sheet_rolf_er_rørt_rss",
    feed_url: "https://drpodcast.nu/rolf-er-roert/feed.xml",
    generated_from_sheet: true
  },
  "liga": {
    podcast_key: "liga",
    source: "sheet_liga_rss",
    feed_url: "https://drpodcast.nu/liga/feed.xml",
    generated_from_sheet: true
  },
  "hjulmand_mennesket_lederen_landstræneren": {
    podcast_key: "hjulmand mennesket lederen landstræneren",
    source: "sheet_hjulmand_mennesket_lederen_landstræneren_rss",
    feed_url: "https://drpodcast.nu/hjulmand-mennesket-lederen-landstraeneren/feed.xml",
    generated_from_sheet: true
  },
  "gyldne_generationer_burgaard_mortensen_og_tanderup": {
    podcast_key: "gyldne generationer burgaard mortensen og tanderup",
    source: "sheet_gyldne_generationer_burgaard_mortensen_og_tanderup_rss",
    feed_url: "https://drpodcast.nu/gyldne-generationer-burgaard-mortensen-og-tanderup/feed.xml",
    generated_from_sheet: true
  },
  "ministermord": {
    podcast_key: "ministermord",
    source: "sheet_ministermord_rss",
    feed_url: "https://drpodcast.nu/ministermord/feed.xml",
    generated_from_sheet: true
  },
  "hollywood_hacket": {
    podcast_key: "hollywood hacket",
    source: "sheet_hollywood_hacket_rss",
    feed_url: "https://drpodcast.nu/kup-hollywood-hacket/feed.xml",
    generated_from_sheet: true
  },
  "klatretyven_i_paris": {
    podcast_key: "klatretyven i paris",
    source: "sheet_klatretyven_i_paris_rss",
    feed_url: "https://drpodcast.nu/kup-klatretyven-i-paris/feed.xml",
    generated_from_sheet: true
  },
  "piger_pa_piller": {
    podcast_key: "piger pa piller",
    source: "sheet_piger_pa_piller_rss",
    feed_url: "https://drpodcast.nu/piger-paa-piller/feed.xml",
    generated_from_sheet: true
  },
  "huller_i_historien": {
    podcast_key: "huller i historien",
    source: "sheet_huller_i_historien_rss",
    feed_url: "https://drpodcast.nu/huller-i-historien/feed.xml",
    generated_from_sheet: true
  },
  "verdens_navle": {
    podcast_key: "verdens navle",
    source: "sheet_verdens_navle_rss",
    feed_url: "https://drpodcast.nu/verdens-navle/feed.xml",
    generated_from_sheet: true
  },
  "ring_til_trine": {
    podcast_key: "ring til trine",
    source: "sheet_ring_til_trine_rss",
    feed_url: "https://drpodcast.nu/ring-til-trine/feed.xml",
    generated_from_sheet: true
  },
  "mikies_ni_liv": {
    podcast_key: "mikies ni liv",
    source: "sheet_mikies_ni_liv_rss",
    feed_url: "https://drpodcast.nu/mikies-ni-liv/feed.xml",
    generated_from_sheet: true
  },
  "hvad_tænder_os_to": {
    podcast_key: "hvad tænder os to",
    source: "sheet_hvad_tænder_os_to_rss",
    feed_url: "https://drpodcast.nu/hvad-taender-os-to/feed.xml",
    generated_from_sheet: true
  },
  "fantasier": {
    podcast_key: "fantasier",
    source: "sheet_fantasier_rss",
    feed_url: "https://drpodcast.nu/fantasier/feed.xml",
    generated_from_sheet: true
  },
  "sex_med_p3": {
    podcast_key: "sex med p3",
    source: "sheet_sex_med_p3_rss",
    feed_url: "https://drpodcast.nu/sex-med-p3-2/feed.xml",
    generated_from_sheet: true
  },
  "hvorfor_har_jeg_ikke_en_kæreste": {
    podcast_key: "hvorfor har jeg ikke en kæreste",
    source: "sheet_hvorfor_har_jeg_ikke_en_kæreste_rss",
    feed_url: "https://drpodcast.nu/hvorfor-har-jeg-ikke-en-kaereste/feed.xml",
    generated_from_sheet: true
  },
  "er_der_liv_pa_venus": {
    podcast_key: "er der liv pa venus",
    source: "sheet_er_der_liv_pa_venus_rss",
    feed_url: "https://drpodcast.nu/er-der-liv-pa-venus/feed.xml",
    generated_from_sheet: true
  },
  "mohammed_og_julie": {
    podcast_key: "mohammed og julie",
    source: "sheet_mohammed_og_julie_rss",
    feed_url: "https://drpodcast.nu/mohammed-og-julie/feed.xml",
    generated_from_sheet: true
  },
  "signes_have": {
    podcast_key: "signes have",
    source: "sheet_signes_have_rss",
    feed_url: "https://drpodcast.nu/signes-have/feed.xml",
    generated_from_sheet: true
  },
  "hvad_ville_jesus_have_sagt": {
    podcast_key: "hvad ville jesus have sagt",
    source: "sheet_hvad_ville_jesus_have_sagt_rss",
    feed_url: "https://drpodcast.nu/hvad-ville-jesus-have-sagt/feed.xml",
    generated_from_sheet: true
  },
  "ibens_harem_18_ar_efter": {
    podcast_key: "ibens harem 18 ar efter",
    source: "sheet_ibens_harem_18_ar_efter_rss",
    feed_url: "https://drpodcast.nu/ibens-harem-18-aar-efter/feed.xml",
    generated_from_sheet: true
  },
  "supertanker": {
    podcast_key: "supertanker",
    source: "sheet_supertanker_rss",
    feed_url: "https://drpodcast.nu/supertanker/feed.xml",
    generated_from_sheet: true
  },
  "pilgrim_pa_rejse_i_troens_univers": {
    podcast_key: "pilgrim pa rejse i troens univers",
    source: "sheet_pilgrim_pa_rejse_i_troens_univers_rss",
    feed_url: "https://drpodcast.nu/pilgrim-pa-rejse-i-troens-univers/feed.xml",
    generated_from_sheet: true
  },
  "sagnfolket": {
    podcast_key: "sagnfolket",
    source: "sheet_sagnfolket_rss",
    feed_url: "https://drpodcast.nu/sagnfolket/feed.xml",
    generated_from_sheet: true
  },
  "søster_elsker_elsker_ikke": {
    podcast_key: "søster elsker elsker ikke",
    source: "sheet_søster_elsker_elsker_ikke_rss",
    feed_url: "https://drpodcast.nu/soester-elsker-elsker-ikke/feed.xml",
    generated_from_sheet: true
  },
  "gemt_i_mørket": {
    podcast_key: "gemt i mørket",
    source: "sheet_gemt_i_mørket_rss",
    feed_url: "https://drpodcast.nu/gemt-i-moerket/feed.xml",
    generated_from_sheet: true
  },
  "troldspejlet_podcast": {
    podcast_key: "troldspejlet podcast",
    source: "sheet_troldspejlet_podcast_rss",
    feed_url: "https://drpodcast.nu/troldspejlet-podcast/feed.xml",
    generated_from_sheet: true
  },
  "weekend_med_k": {
    podcast_key: "weekend med k",
    source: "sheet_weekend_med_k_rss",
    feed_url: "https://drpodcast.nu/weekend-med-k/feed.xml",
    generated_from_sheet: true
  },
  "søvnudsigten": {
    podcast_key: "søvnudsigten",
    source: "sheet_søvnudsigten_rss",
    feed_url: "https://drpodcast.nu/soevnudsigten/feed.xml",
    generated_from_sheet: true
  },
  "ro_pa_recept": {
    podcast_key: "ro pa recept",
    source: "sheet_ro_pa_recept_rss",
    feed_url: "https://drpodcast.nu/ro-paa-recept/feed.xml",
    generated_from_sheet: true
  },
  "musik_og_meditation": {
    podcast_key: "musik og meditation",
    source: "sheet_musik_og_meditation_rss",
    feed_url: "https://drpodcast.nu/musik-og-meditation/feed.xml",
    generated_from_sheet: true
  },
  "en_helvedes_fortid": {
    podcast_key: "en helvedes fortid",
    source: "sheet_en_helvedes_fortid_rss",
    feed_url: "https://drpodcast.nu/helvedes-fortid/feed.xml",
    generated_from_sheet: true
  },
  "det_perfekte_offer_iii": {
    podcast_key: "det perfekte offer iii",
    source: "sheet_det_perfekte_offer_iii_rss",
    feed_url: "https://drpodcast.nu/det-perfekte-offer-iii/feed.xml",
    generated_from_sheet: true
  },
  "pausen": {
    podcast_key: "pausen",
    source: "sheet_pausen_rss",
    feed_url: "https://drpodcast.nu/pausen/feed.xml",
    generated_from_sheet: true
  },
  "jeg_skammer_mig": {
    podcast_key: "jeg skammer mig",
    source: "sheet_jeg_skammer_mig_rss",
    feed_url: "https://drpodcast.nu/jeg-skammer-mig/feed.xml",
    generated_from_sheet: true
  },
  "vildt_naturligt": {
    podcast_key: "vildt naturligt",
    source: "sheet_vildt_naturligt_rss",
    feed_url: "https://drpodcast.nu/vildt-naturligt/feed.xml",
    generated_from_sheet: true
  },
  "vores_vejr_podcast": {
    podcast_key: "vores vejr podcast",
    source: "sheet_vores_vejr_podcast_rss",
    feed_url: "https://drpodcast.nu/vores-vejr-podcast/feed.xml",
    generated_from_sheet: true
  },
  "lægens_bord": {
    podcast_key: "lægens bord",
    source: "sheet_lægens_bord_rss",
    feed_url: "https://drpodcast.nu/laegens-bord-podcast/feed.xml",
    generated_from_sheet: true
  },
  "den_sidste_modstandsmand": {
    podcast_key: "den sidste modstandsmand",
    source: "sheet_den_sidste_modstandsmand_rss",
    feed_url: "https://drpodcast.nu/den-sidste-modstandsmand/feed.xml",
    generated_from_sheet: true
  },
  "far_har_været_i_krig": {
    podcast_key: "far har været i krig",
    source: "sheet_far_har_været_i_krig_rss",
    feed_url: "https://drpodcast.nu/radiofortaellinger/feed.xml",
    generated_from_sheet: true
  },
  "den_sandsynlige_morder": {
    podcast_key: "den sandsynlige morder",
    source: "sheet_den_sandsynlige_morder_rss",
    feed_url: "https://drpodcast.nu/den-sandsynlige-morder/feed.xml",
    generated_from_sheet: true
  },
  "sig_noget_sjovt_historien_om_dansk_stand_up": {
    podcast_key: "sig noget sjovt historien om dansk stand up",
    source: "sheet_sig_noget_sjovt_historien_om_dansk_stand_up_rss",
    feed_url: "https://drpodcast.nu/sig-noget-sjovt-historien-om-dansk-stand-up/feed.xml",
    generated_from_sheet: true
  },
  "undskyld_vi_roder": {
    podcast_key: "undskyld vi roder",
    source: "sheet_undskyld_vi_roder_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/504fd940-e457-44cf-9019-abca00be97ea/aa9b1acb-fc7d-48f6-b067-abca00beaa16/6af053db-da47-47dc-aee5-abca00c013d7/podcast.rss",
    generated_from_sheet: true
  },
  "det_vilde_vesten": {
    podcast_key: "det vilde vesten",
    source: "sheet_det_vilde_vesten_rss",
    feed_url: "https://drpodcast.nu/det-vilde-vesten/feed.xml",
    generated_from_sheet: true
  },
  "fantino_og_bonde": {
    podcast_key: "fantino og bonde",
    source: "sheet_fantino_og_bonde_rss",
    feed_url: "https://rss.podplaystudio.com/1130.xml",
    generated_from_sheet: true
  },
  "nationens_mareridt": {
    podcast_key: "nationens mareridt",
    source: "sheet_nationens_mareridt_rss",
    feed_url: "https://rss.podplaystudio.com/1134.xml",
    generated_from_sheet: true
  },
  "børsen_investor": {
    podcast_key: "børsen investor",
    source: "sheet_børsen_investor_rss",
    feed_url: "https://borsen.dk/rss/investor",
    generated_from_sheet: true
  },
  "akkurat_med_clement": {
    podcast_key: "akkurat med clement",
    source: "sheet_akkurat_med_clement_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/akkurat-med-clement.xml?format=podcast",
    generated_from_sheet: true
  },
  "sorte_tal": {
    podcast_key: "sorte tal",
    source: "sheet_sorte_tal_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/foelg-pengene.xml?format=podcast",
    generated_from_sheet: true
  },
  "hard_fork": {
    podcast_key: "hard fork",
    source: "sheet_hard_fork_rss",
    feed_url: "https://feeds.simplecast.com/6HKOhNgS",
    generated_from_sheet: true
  },
  "opkald_til_fronten": {
    podcast_key: "opkald til fronten",
    source: "sheet_opkald_til_fronten_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/genstart-dox.xml?format=podcast",
    generated_from_sheet: true
  },
  "svingdøren": {
    podcast_key: "svingdøren",
    source: "sheet_svingdøren_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/svingdoeren.xml?format=podcast",
    generated_from_sheet: true
  },
  "mord_down_under": {
    podcast_key: "mord down under",
    source: "sheet_mord_down_under_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:998126356/sounds.rss",
    generated_from_sheet: true
  },
  "udsyn": {
    podcast_key: "udsyn",
    source: "sheet_udsyn_rss",
    feed_url: "https://api.dr.dk/podcasts/v1/feeds/orientering.xml?format=podcast&limit=100",
    generated_from_sheet: true
  },
  "den_hvide_dame": {
    podcast_key: "den hvide dame",
    source: "sheet_den_hvide_dame_rss",
    feed_url: "https://feeds.acast.com/public/shows/den-hvide-dame",
    generated_from_sheet: true
  },
  "børssnak": {
    podcast_key: "børssnak",
    source: "sheet_børssnak_rss",
    feed_url: "https://feed.podbean.com/borssnak/feed.xml",
    generated_from_sheet: true
  },
  "det_hemmeligste_af_det_hemmelige": {
    podcast_key: "det hemmeligste af det hemmelige",
    source: "sheet_det_hemmeligste_af_det_hemmelige_rss",
    feed_url: "https://www.spreaker.com/show/5326314/episodes/feed",
    generated_from_sheet: true
  },
  "ingen_dumme_spørgsmal": {
    podcast_key: "ingen dumme spørgsmal",
    source: "sheet_ingen_dumme_spørgsmal_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/1ea4b534-d8fa-4976-a620-ad4800e69157/3f3433ec-8d39-4501-b0b8-ad4800e69161/podcast.rss",
    generated_from_sheet: true
  },
  "bliv_fri_af_psykisk_vold": {
    podcast_key: "bliv fri af psykisk vold",
    source: "sheet_bliv_fri_af_psykisk_vold_rss",
    feed_url: "https://www.spreaker.com/show/5510156/episodes/feed",
    generated_from_sheet: true
  },
  "sort_snak": {
    podcast_key: "sort snak",
    source: "sheet_sort_snak_rss",
    feed_url: "https://feeds.soundcloud.com/users/soundcloud:users:353182352/sounds.rss",
    generated_from_sheet: true
  },
  "englevingen": {
    podcast_key: "englevingen",
    source: "sheet_englevingen_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/53699e57-2829-4c09-b2d7-b17f00e847cd/193f965b-eccd-4ea5-b8c0-b17f00e84a35/podcast.rss",
    generated_from_sheet: true
  },
  "kongerækken_hos_politiken_historie": {
    podcast_key: "kongerækken hos politiken historie",
    source: "sheet_kongerækken_hos_politiken_historie_rss",
    feed_url: "https://www.omnycontent.com/d/playlist/87e48115-d0ce-4e9b-83f0-ae5b01244e0a/da273c02-f19e-4846-9fa3-b17f00c0aff9/ebd1a02b-81d7-4da2-b08f-b17f00c0b286/podcast.rss",
    generated_from_sheet: true
  },
  "saas_købmænd": {
    podcast_key: "saas købmænd",
    source: "sheet_saas_købmænd_rss",
    feed_url: "https://anchor.fm/s/10eb99934/podcast/rss",
    generated_from_sheet: true
  },
  "sa_ma_du_have_held_og_lykke_med_det": {
    podcast_key: "sa ma du have held og lykke med det",
    source: "sheet_sa_ma_du_have_held_og_lykke_med_det_rss",
    feed_url: "https://www.spreaker.com/show/6715011/episodes/feed",
    generated_from_sheet: true
  },
  "thorborgs_dagbog": {
    podcast_key: "thorborgs dagbog",
    source: "sheet_thorborgs_dagbog_rss",
    feed_url: "https://rss.buzzsprout.com/2144473.rss",
    generated_from_sheet: true
  },
  "celebkebab": {
    podcast_key: "celebkebab",
    source: "sheet_celebkebab_rss",
    feed_url: "https://feeds.acast.com/public/shows/celebkebab",
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
