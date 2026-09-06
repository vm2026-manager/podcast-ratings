-- Generated from the current catalogue. Backfills manual episodes added after the
-- initial canonical migration without changing any existing episode or rating.
begin;

create temporary table manual_catalogue_mapping_delta (
  manual_episode_key text primary key,
  podcast_key text not null,
  episode_id uuid not null,
  title text not null,
  external_guid text not null
) on commit drop;

insert into manual_catalogue_mapping_delta (
  manual_episode_key, podcast_key, episode_id, title, external_guid
) values
  ('manual-catalogue-v1:91bcdfc5-4176-5a96-b791-bfa3799edfac', 'satankulten', '91bcdfc5-4176-5a96-b791-bfa3799edfac'::uuid, 'Ta'' til Anholt, for Satan!', 'manual_catalogue_v1:91bcdfc5-4176-5a96-b791-bfa3799edfac'),
  ('manual-catalogue-v1:aa85fa3f-380e-552a-a097-605d4deedeb8', 'satankulten', 'aa85fa3f-380e-552a-a097-605d4deedeb8'::uuid, 'Satanist i Guds hus', 'manual_catalogue_v1:aa85fa3f-380e-552a-a097-605d4deedeb8'),
  ('manual-catalogue-v1:e996d53f-864c-5312-b602-78a1d1fc4d74', 'satankulten', 'e996d53f-864c-5312-b602-78a1d1fc4d74'::uuid, 'Satanmønter og identitetstyve', 'manual_catalogue_v1:e996d53f-864c-5312-b602-78a1d1fc4d74'),
  ('manual-catalogue-v1:39fd14d9-0bc0-5990-88b5-018b8e38f492', 'satankulten', '39fd14d9-0bc0-5990-88b5-018b8e38f492'::uuid, 'Hvem er Knud Langkow?', 'manual_catalogue_v1:39fd14d9-0bc0-5990-88b5-018b8e38f492'),
  ('manual-catalogue-v1:b93d7207-cf1a-5810-a0b3-bb59eb54fdba', 'satankulten', 'b93d7207-cf1a-5810-a0b3-bb59eb54fdba'::uuid, 'Under overfladen', 'manual_catalogue_v1:b93d7207-cf1a-5810-a0b3-bb59eb54fdba'),
  ('manual-catalogue-v1:bc2c0133-15d8-5e50-b757-b925b8ef65c2', 'satankulten', 'bc2c0133-15d8-5e50-b757-b925b8ef65c2'::uuid, 'Afskeden', 'manual_catalogue_v1:bc2c0133-15d8-5e50-b757-b925b8ef65c2'),
  ('manual-catalogue-v1:e1cf8c0a-8d01-54ab-abb3-216862d62ef1', 'agent samsam', 'e1cf8c0a-8d01-54ab-abb3-216862d62ef1'::uuid, 'Den farligste jihadist', 'manual_catalogue_v1:e1cf8c0a-8d01-54ab-abb3-216862d62ef1'),
  ('manual-catalogue-v1:79b229fc-0069-51df-afde-41aa2fa46bad', 'agent samsam', '79b229fc-0069-51df-afde-41aa2fa46bad'::uuid, 'Besøg fra PET', 'manual_catalogue_v1:79b229fc-0069-51df-afde-41aa2fa46bad'),
  ('manual-catalogue-v1:b24d2fcd-2388-5acc-91db-b1c3d7e315ca', 'agent samsam', 'b24d2fcd-2388-5acc-91db-b1c3d7e315ca'::uuid, 'Kriger med en hemmelig mission', 'manual_catalogue_v1:b24d2fcd-2388-5acc-91db-b1c3d7e315ca'),
  ('manual-catalogue-v1:04b7d9c3-348d-5f98-9a63-c21d403bea62', 'agent samsam', '04b7d9c3-348d-5f98-9a63-c21d403bea62'::uuid, 'Otte års fængsel for terror', 'manual_catalogue_v1:04b7d9c3-348d-5f98-9a63-c21d403bea62'),
  ('manual-catalogue-v1:cde2a189-f9ad-5fe8-aeb2-c7db44b41772', 'agent samsam', 'cde2a189-f9ad-5fe8-aeb2-c7db44b41772'::uuid, 'Familiens kamp', 'manual_catalogue_v1:cde2a189-f9ad-5fe8-aeb2-c7db44b41772'),
  ('manual-catalogue-v1:fd3e7b28-2bf6-5f1b-b01d-b446cb32f101', 'agent samsam', 'fd3e7b28-2bf6-5f1b-b01d-b446cb32f101'::uuid, 'Forhandlingen', 'manual_catalogue_v1:fd3e7b28-2bf6-5f1b-b01d-b446cb32f101'),
  ('manual-catalogue-v1:5a59d1f5-2b77-5d8a-9d19-d333eb044960', 'agent samsam', '5a59d1f5-2b77-5d8a-9d19-d333eb044960'::uuid, 'De mærkelige svar', 'manual_catalogue_v1:5a59d1f5-2b77-5d8a-9d19-d333eb044960'),
  ('manual-catalogue-v1:d250cd30-c7cd-539f-9925-7d0a14a744b9', 'agent samsam', 'd250cd30-c7cd-539f-9925-7d0a14a744b9'::uuid, 'Mændene i skyggerne', 'manual_catalogue_v1:d250cd30-c7cd-539f-9925-7d0a14a744b9'),
  ('manual-catalogue-v1:6fb2512c-40ba-5883-9787-bdb2f7494cd9', 'agent samsam', '6fb2512c-40ba-5883-9787-bdb2f7494cd9'::uuid, 'Ahmeds svar', 'manual_catalogue_v1:6fb2512c-40ba-5883-9787-bdb2f7494cd9'),
  ('manual-catalogue-v1:76c88542-b5fc-5923-9c23-ae88f41feff9', 'agent samsam', '76c88542-b5fc-5923-9c23-ae88f41feff9'::uuid, 'Tomrum af fakta', 'manual_catalogue_v1:76c88542-b5fc-5923-9c23-ae88f41feff9'),
  ('manual-catalogue-v1:14e283e0-ae59-5811-af2e-0bd66dd511a7', 'agent samsam', '14e283e0-ae59-5811-af2e-0bd66dd511a7'::uuid, 'Retsopgøret', 'manual_catalogue_v1:14e283e0-ae59-5811-af2e-0bd66dd511a7'),
  ('manual-catalogue-v1:82fcbbfc-7fb9-5485-9d7c-8a028174b693', 'agent samsam', '82fcbbfc-7fb9-5485-9d7c-8a028174b693'::uuid, 'Chefredaktørens bombe', 'manual_catalogue_v1:82fcbbfc-7fb9-5485-9d7c-8a028174b693'),
  ('manual-catalogue-v1:9abd529b-72ad-571e-8df9-9559a4f2a9f4', 'agent samsam', '9abd529b-72ad-571e-8df9-9559a4f2a9f4'::uuid, 'The Wayback Machine', 'manual_catalogue_v1:9abd529b-72ad-571e-8df9-9559a4f2a9f4'),
  ('manual-catalogue-v1:0feeeb6e-c69f-5b0b-80ba-31107bce44ad', 'agent samsam', '0feeeb6e-c69f-5b0b-80ba-31107bce44ad'::uuid, 'Fra hestens egen mund', 'manual_catalogue_v1:0feeeb6e-c69f-5b0b-80ba-31107bce44ad'),
  ('manual-catalogue-v1:a599b1f0-0c42-52e7-bf2c-3e92b8e775e9', 'agent samsam', 'a599b1f0-0c42-52e7-bf2c-3e92b8e775e9'::uuid, 'Proceduren', 'manual_catalogue_v1:a599b1f0-0c42-52e7-bf2c-3e92b8e775e9'),
  ('manual-catalogue-v1:efd7c542-187d-5b9d-82e7-10bcabc685bf', 'agent samsam', 'efd7c542-187d-5b9d-82e7-10bcabc685bf'::uuid, 'Dommen', 'manual_catalogue_v1:efd7c542-187d-5b9d-82e7-10bcabc685bf'),
  ('manual-catalogue-v1:9f6e3482-2250-5cd5-aa29-d178d8d004eb', 'agent samsam', '9f6e3482-2250-5cd5-aa29-d178d8d004eb'::uuid, 'Blotlagt', 'manual_catalogue_v1:9f6e3482-2250-5cd5-aa29-d178d8d004eb'),
  ('manual-catalogue-v1:82395514-f5df-5567-b137-97f221851e8d', 'dronekrigeren', '82395514-f5df-5567-b137-97f221851e8d'::uuid, 'Terrordroner', 'manual_catalogue_v1:82395514-f5df-5567-b137-97f221851e8d'),
  ('manual-catalogue-v1:8d430b0a-dffe-5fb7-bcc4-86108ce28255', 'dronekrigeren', '8d430b0a-dffe-5fb7-bcc4-86108ce28255'::uuid, 'På hemmelig mission for PET', 'manual_catalogue_v1:8d430b0a-dffe-5fb7-bcc4-86108ce28255'),
  ('manual-catalogue-v1:7bd5a76a-5b46-5f31-9079-df084b019aaf', 'dronekrigeren', '7bd5a76a-5b46-5f31-9079-df084b019aaf'::uuid, 'Danmarks farligste terrorist', 'manual_catalogue_v1:7bd5a76a-5b46-5f31-9079-df084b019aaf'),
  ('manual-catalogue-v1:8fcebedc-05b8-5575-8212-96c6c57b495f', 'dronekrigeren', '8fcebedc-05b8-5575-8212-96c6c57b495f'::uuid, 'Bombemålet Basil Hassan', 'manual_catalogue_v1:8fcebedc-05b8-5575-8212-96c6c57b495f'),
  ('manual-catalogue-v1:bc2ec095-29c2-5146-a1de-b36f6d0b34f0', 'dronekrigeren', 'bc2ec095-29c2-5146-a1de-b36f6d0b34f0'::uuid, 'Krigsfangerne i Basils hus', 'manual_catalogue_v1:bc2ec095-29c2-5146-a1de-b36f6d0b34f0'),
  ('manual-catalogue-v1:b48f3ef9-6497-5838-a401-54afbe3e2c36', 'dronekrigeren', 'b48f3ef9-6497-5838-a401-54afbe3e2c36'::uuid, 'Forklædt som Basil Hassan', 'manual_catalogue_v1:b48f3ef9-6497-5838-a401-54afbe3e2c36'),
  ('manual-catalogue-v1:b6e24d26-3c4b-5931-80f7-81343b90feaf', 'dronekrigeren', 'b6e24d26-3c4b-5931-80f7-81343b90feaf'::uuid, 'Anholdt på arbejde', 'manual_catalogue_v1:b6e24d26-3c4b-5931-80f7-81343b90feaf'),
  ('manual-catalogue-v1:7a3fadef-5fdc-5442-adc8-81f5294eaf00', 'dronekrigeren', '7a3fadef-5fdc-5442-adc8-81f5294eaf00'::uuid, 'Bilvaskeren i Bursa', 'manual_catalogue_v1:7a3fadef-5fdc-5442-adc8-81f5294eaf00'),
  ('manual-catalogue-v1:738f026e-426d-5d8d-a46a-71802c474eb7', 'dronekrigeren', '738f026e-426d-5d8d-a46a-71802c474eb7'::uuid, 'Bomben i kødhakkeren', 'manual_catalogue_v1:738f026e-426d-5d8d-a46a-71802c474eb7'),
  ('manual-catalogue-v1:c951803c-a22f-5527-ae82-234674a4d7c9', 'dronekrigeren', 'c951803c-a22f-5527-ae82-234674a4d7c9'::uuid, 'Et USB-Stik, to danske kameraer og 27 dræbte soldater', 'manual_catalogue_v1:c951803c-a22f-5527-ae82-234674a4d7c9'),
  ('manual-catalogue-v1:a3a48015-1f2e-5a78-b11b-710787ad704a', 'dronekrigeren', 'a3a48015-1f2e-5a78-b11b-710787ad704a'::uuid, 'Droner til et grønt formål', 'manual_catalogue_v1:a3a48015-1f2e-5a78-b11b-710787ad704a'),
  ('manual-catalogue-v1:ddc550ef-4667-5d78-9092-6939339ac652', 'dronekrigeren', 'ddc550ef-4667-5d78-9092-6939339ac652'::uuid, 'Dronedele, flødeboller og chips til "B"', 'manual_catalogue_v1:ddc550ef-4667-5d78-9092-6939339ac652'),
  ('manual-catalogue-v1:0dcb5f84-1ec9-53f7-b5bb-e176fed9fdc1', 'dronekrigeren', '0dcb5f84-1ec9-53f7-b5bb-e176fed9fdc1'::uuid, '"Post" river sig i håret!', 'manual_catalogue_v1:0dcb5f84-1ec9-53f7-b5bb-e176fed9fdc1'),
  ('manual-catalogue-v1:a1b3c949-8f7d-5474-832e-bbabf0f1fbd6', 'dronekrigeren', 'a1b3c949-8f7d-5474-832e-bbabf0f1fbd6'::uuid, '"Et slagtilbud, han ikke kan sige nej til"', 'manual_catalogue_v1:a1b3c949-8f7d-5474-832e-bbabf0f1fbd6'),
  ('manual-catalogue-v1:c302d843-0390-5faa-9e0f-19ddd85ff1dc', 'dronekrigeren', 'c302d843-0390-5faa-9e0f-19ddd85ff1dc'::uuid, 'Den dræbende bombe', 'manual_catalogue_v1:c302d843-0390-5faa-9e0f-19ddd85ff1dc'),
  ('manual-catalogue-v1:732a8f1c-af48-5c35-a2cd-ebea2d7ab4db', 'dronekrigeren', '732a8f1c-af48-5c35-a2cd-ebea2d7ab4db'::uuid, 'Dommen', 'manual_catalogue_v1:732a8f1c-af48-5c35-a2cd-ebea2d7ab4db'),
  ('manual-catalogue-v1:d9377482-6add-512b-9826-55384104ed59', 'den endeløse krig', 'd9377482-6add-512b-9826-55384104ed59'::uuid, 'Danskeren på Guantánamo', 'manual_catalogue_v1:d9377482-6add-512b-9826-55384104ed59'),
  ('manual-catalogue-v1:a21739db-8d74-5f50-b448-b9c18a605546', 'den endeløse krig', 'a21739db-8d74-5f50-b448-b9c18a605546'::uuid, 'Den nye fjende', 'manual_catalogue_v1:a21739db-8d74-5f50-b448-b9c18a605546'),
  ('manual-catalogue-v1:ad9f949e-dee2-5df3-8a75-248838f6389d', 'den endeløse krig', 'ad9f949e-dee2-5df3-8a75-248838f6389d'::uuid, 'Danmark som terrormål', 'manual_catalogue_v1:ad9f949e-dee2-5df3-8a75-248838f6389d'),
  ('manual-catalogue-v1:72e16716-4fb6-5da9-b3cd-d370011819a3', 'den endeløse krig', '72e16716-4fb6-5da9-b3cd-d370011819a3'::uuid, 'Krigens tabere', 'manual_catalogue_v1:72e16716-4fb6-5da9-b3cd-d370011819a3'),
  ('manual-catalogue-v1:d13ceec0-7a96-5fab-b9ce-f32a3cd7facd', 'en ven af familien', 'd13ceec0-7a96-5fab-b9ce-f32a3cd7facd'::uuid, 'En ulykkelig hændelse', 'manual_catalogue_v1:d13ceec0-7a96-5fab-b9ce-f32a3cd7facd'),
  ('manual-catalogue-v1:5949d3ed-1b6a-5f34-a15e-deb326424f8a', 'en ven af familien', '5949d3ed-1b6a-5f34-a15e-deb326424f8a'::uuid, 'En, to... flere?', 'manual_catalogue_v1:5949d3ed-1b6a-5f34-a15e-deb326424f8a'),
  ('manual-catalogue-v1:b4153a82-0bea-5d83-a2df-70f81488b721', 'en ven af familien', 'b4153a82-0bea-5d83-a2df-70f81488b721'::uuid, '172? livsråd ingen har bedt om', 'manual_catalogue_v1:b4153a82-0bea-5d83-a2df-70f81488b721'),
  ('manual-catalogue-v1:eea19388-9c79-5a7d-9093-699ec3e5c073', 'en ven af familien', 'eea19388-9c79-5a7d-9093-699ec3e5c073'::uuid, 'Ravnemor', 'manual_catalogue_v1:eea19388-9c79-5a7d-9093-699ec3e5c073'),
  ('manual-catalogue-v1:2971727d-9d7b-5f24-9bcb-752b48aac02a', 'en ven af familien', '2971727d-9d7b-5f24-9bcb-752b48aac02a'::uuid, 'Interventionen', 'manual_catalogue_v1:2971727d-9d7b-5f24-9bcb-752b48aac02a'),
  ('manual-catalogue-v1:3c836335-fc18-5f52-a005-aa8bcf1038b0', 'en ven af familien', '3c836335-fc18-5f52-a005-aa8bcf1038b0'::uuid, 'Røde flag', 'manual_catalogue_v1:3c836335-fc18-5f52-a005-aa8bcf1038b0'),
  ('manual-catalogue-v1:1717fcf4-410f-5329-800b-b61299a0f4ef', 'en ven af familien', '1717fcf4-410f-5329-800b-b61299a0f4ef'::uuid, 'En datter siger farvel', 'manual_catalogue_v1:1717fcf4-410f-5329-800b-b61299a0f4ef'),
  ('manual-catalogue-v1:552dc0ec-1da8-5a79-b244-921eeaa667db', 'tvunget i krig', '552dc0ec-1da8-5a79-b244-921eeaa667db'::uuid, '1:3 - Tvunget i krig', 'manual_catalogue_v1:552dc0ec-1da8-5a79-b244-921eeaa667db'),
  ('manual-catalogue-v1:45b90154-a32c-5729-afae-f76e28995b93', 'tvunget i krig', '45b90154-a32c-5729-afae-f76e28995b93'::uuid, '2:3 - Tvunget i krig', 'manual_catalogue_v1:45b90154-a32c-5729-afae-f76e28995b93'),
  ('manual-catalogue-v1:39c52464-baca-5099-8b45-72a63b5e833b', 'tvunget i krig', '39c52464-baca-5099-8b45-72a63b5e833b'::uuid, '3:3 - Tvunget i krig', 'manual_catalogue_v1:39c52464-baca-5099-8b45-72a63b5e833b'),
  ('manual-catalogue-v1:a9e6c37b-67ce-554e-beeb-55c5384234a8', 'fluggers forbudte farver', 'a9e6c37b-67ce-554e-beeb-55c5384234a8'::uuid, '1:3 - Flüggers forbudte farver', 'manual_catalogue_v1:a9e6c37b-67ce-554e-beeb-55c5384234a8'),
  ('manual-catalogue-v1:f0919443-777b-55de-b746-b1f5f1d3b340', 'fluggers forbudte farver', 'f0919443-777b-55de-b746-b1f5f1d3b340'::uuid, '2:3 - Flüggers forbudte farver', 'manual_catalogue_v1:f0919443-777b-55de-b746-b1f5f1d3b340'),
  ('manual-catalogue-v1:4c7229db-e726-5626-8ed9-1665b3326c50', 'fluggers forbudte farver', '4c7229db-e726-5626-8ed9-1665b3326c50'::uuid, '3:3 - Flüggers forbudte farver', 'manual_catalogue_v1:4c7229db-e726-5626-8ed9-1665b3326c50'),
  ('manual-catalogue-v1:e51db2e6-3edb-5117-b21c-e590e130bd09', 'politiets beskidte sager', 'e51db2e6-3edb-5117-b21c-e590e130bd09'::uuid, '1:3 - Politiets beskidte sager', 'manual_catalogue_v1:e51db2e6-3edb-5117-b21c-e590e130bd09'),
  ('manual-catalogue-v1:aa1818de-850b-5007-a422-5b20c7a0e091', 'politiets beskidte sager', 'aa1818de-850b-5007-a422-5b20c7a0e091'::uuid, '2:3 - Politiets beskidte sager', 'manual_catalogue_v1:aa1818de-850b-5007-a422-5b20c7a0e091'),
  ('manual-catalogue-v1:8822a8c6-aa92-5cbf-a977-0330e216ce41', 'politiets beskidte sager', '8822a8c6-aa92-5cbf-a977-0330e216ce41'::uuid, '3:3 - Politiets beskidte sager', 'manual_catalogue_v1:8822a8c6-aa92-5cbf-a977-0330e216ce41'),
  ('manual-catalogue-v1:243a25bf-8a76-5d56-9b63-0ed5cd5d5594', 'stemplet som psykopat', '243a25bf-8a76-5d56-9b63-0ed5cd5d5594'::uuid, 'Er du psykopat?', 'manual_catalogue_v1:243a25bf-8a76-5d56-9b63-0ed5cd5d5594'),
  ('manual-catalogue-v1:a015aba4-ce3e-5ded-876c-7626fec142e7', 'stemplet som psykopat', 'a015aba4-ce3e-5ded-876c-7626fec142e7'::uuid, 'Børn ændrer alt', 'manual_catalogue_v1:a015aba4-ce3e-5ded-876c-7626fec142e7'),
  ('manual-catalogue-v1:16884847-053e-508e-99c7-3755a71d608c', 'stemplet som psykopat', '16884847-053e-508e-99c7-3755a71d608c'::uuid, 'Kan man hjælpe en psykopat?', 'manual_catalogue_v1:16884847-053e-508e-99c7-3755a71d608c'),
  ('manual-catalogue-v1:b9842e0b-18d1-5602-be65-9df9256145f8', 'mord i gruppechatten', 'b9842e0b-18d1-5602-be65-9df9256145f8'::uuid, 'Loyal til Familien', 'manual_catalogue_v1:b9842e0b-18d1-5602-be65-9df9256145f8'),
  ('manual-catalogue-v1:31eb80ab-f86a-526a-96f9-0ead27849974', 'mord i gruppechatten', '31eb80ab-f86a-526a-96f9-0ead27849974'::uuid, 'Mord på Meny', 'manual_catalogue_v1:31eb80ab-f86a-526a-96f9-0ead27849974'),
  ('manual-catalogue-v1:e70c7017-39e7-54a4-aa38-3e1521a45272', 'mord i gruppechatten', 'e70c7017-39e7-54a4-aa38-3e1521a45272'::uuid, 'Hvem er Batman?', 'manual_catalogue_v1:e70c7017-39e7-54a4-aa38-3e1521a45272'),
  ('manual-catalogue-v1:ed81b86f-6afc-5d96-91cc-0a35c12bcdfc', 'tyrannens fald', 'ed81b86f-6afc-5d96-91cc-0a35c12bcdfc'::uuid, 'I oprørets ildspor', 'manual_catalogue_v1:ed81b86f-6afc-5d96-91cc-0a35c12bcdfc'),
  ('manual-catalogue-v1:c06958af-31b6-56ca-be75-59fdbc711008', 'tyrannens fald', 'c06958af-31b6-56ca-be75-59fdbc711008'::uuid, 'Skriften på væggen', 'manual_catalogue_v1:c06958af-31b6-56ca-be75-59fdbc711008'),
  ('manual-catalogue-v1:c2d2fec5-c63d-561c-a80b-fe8bf9d349ca', 'tyrannens fald', 'c2d2fec5-c63d-561c-a80b-fe8bf9d349ca'::uuid, 'Diktatorens torturkammer', 'manual_catalogue_v1:c2d2fec5-c63d-561c-a80b-fe8bf9d349ca'),
  ('manual-catalogue-v1:4c7b83aa-eb5f-5b19-8c33-21b415c10d13', 'opror i oregon', '4c7b83aa-eb5f-5b19-8c33-21b415c10d13'::uuid, 'Truth and untruth', 'manual_catalogue_v1:4c7b83aa-eb5f-5b19-8c33-21b415c10d13'),
  ('manual-catalogue-v1:fec52443-d683-50e2-8748-01018b346138', 'opror i oregon', 'fec52443-d683-50e2-8748-01018b346138'::uuid, 'Kernefamilien eller Kaos', 'manual_catalogue_v1:fec52443-d683-50e2-8748-01018b346138'),
  ('manual-catalogue-v1:8824a24c-7ba2-5e99-9427-3a9e6e7b5873', 'opror i oregon', '8824a24c-7ba2-5e99-9427-3a9e6e7b5873'::uuid, 'Kyllinger og dæmoner', 'manual_catalogue_v1:8824a24c-7ba2-5e99-9427-3a9e6e7b5873'),
  ('manual-catalogue-v1:b18ccf92-250a-582b-abd8-5ae48ca29035', 'et giftigt hensyn', 'b18ccf92-250a-582b-abd8-5ae48ca29035'::uuid, '1:3 - Et giftigt hensyn', 'manual_catalogue_v1:b18ccf92-250a-582b-abd8-5ae48ca29035'),
  ('manual-catalogue-v1:4a6e7e22-94e8-5c1b-ad2c-dc8c13da086d', 'et giftigt hensyn', '4a6e7e22-94e8-5c1b-ad2c-dc8c13da086d'::uuid, '2:3 - Et giftigt hensyn', 'manual_catalogue_v1:4a6e7e22-94e8-5c1b-ad2c-dc8c13da086d'),
  ('manual-catalogue-v1:931bd232-654b-5103-bfe3-5344c5ff2e1d', 'et giftigt hensyn', '931bd232-654b-5103-bfe3-5344c5ff2e1d'::uuid, '3:3 - Et giftigt hensyn', 'manual_catalogue_v1:931bd232-654b-5103-bfe3-5344c5ff2e1d'),
  ('manual-catalogue-v1:5bb717bc-e7b0-5c0f-b569-05162f37bbc1', 'dagmar overby', '5bb717bc-e7b0-5c0f-b569-05162f37bbc1'::uuid, 'Et spind af børneoverdragelser', 'manual_catalogue_v1:5bb717bc-e7b0-5c0f-b569-05162f37bbc1'),
  ('manual-catalogue-v1:febeb15a-8f37-52d1-b68d-d3a0b70469ef', 'dagmar overby', 'febeb15a-8f37-52d1-b68d-d3a0b70469ef'::uuid, 'Portræt af en særlig seriemorder', 'manual_catalogue_v1:febeb15a-8f37-52d1-b68d-d3a0b70469ef'),
  ('manual-catalogue-v1:977f6187-17a0-5d9c-876a-5591a2104f7e', 'dagmar overby', '977f6187-17a0-5d9c-876a-5591a2104f7e'::uuid, 'Benstumper i brændeovnen', 'manual_catalogue_v1:977f6187-17a0-5d9c-876a-5591a2104f7e'),
  ('manual-catalogue-v1:290d271e-e143-5557-96d9-2c7c084bf2a5', 'graenselos', '290d271e-e143-5557-96d9-2c7c084bf2a5'::uuid, 'Jeg troede, sex skulle gøre ondt', 'manual_catalogue_v1:290d271e-e143-5557-96d9-2c7c084bf2a5'),
  ('manual-catalogue-v1:73aa8a45-8d53-535c-a04f-6ce358e401ca', 'graenselos', '73aa8a45-8d53-535c-a04f-6ce358e401ca'::uuid, 'Jeg føler, at jeg skylder alle sex', 'manual_catalogue_v1:73aa8a45-8d53-535c-a04f-6ce358e401ca'),
  ('manual-catalogue-v1:2a4e2bcc-f5d2-599f-9841-6d1ae89a284d', 'graenselos', '2a4e2bcc-f5d2-599f-9841-6d1ae89a284d'::uuid, 'Det samme fucking mønster', 'manual_catalogue_v1:2a4e2bcc-f5d2-599f-9841-6d1ae89a284d'),
  ('manual-catalogue-v1:61587dc0-8b7f-548f-a40a-4e1699a4bc6d', 'forfulgt af danmarks storste stalker', '61587dc0-8b7f-548f-a40a-4e1699a4bc6d'::uuid, 'Prolog – Vreden ulmer på Facebook', 'manual_catalogue_v1:61587dc0-8b7f-548f-a40a-4e1699a4bc6d'),
  ('manual-catalogue-v1:737decdd-d7f0-544e-babd-d35b12755c6c', 'forfulgt af danmarks storste stalker', '737decdd-d7f0-544e-babd-d35b12755c6c'::uuid, '1:4 - Marie møder sin stalker', 'manual_catalogue_v1:737decdd-d7f0-544e-babd-d35b12755c6c'),
  ('manual-catalogue-v1:b8b74c00-e6e5-5679-bd7c-b6be5f686667', 'forfulgt af danmarks storste stalker', 'b8b74c00-e6e5-5679-bd7c-b6be5f686667'::uuid, '2:4 - Powerparrets bagside', 'manual_catalogue_v1:b8b74c00-e6e5-5679-bd7c-b6be5f686667'),
  ('manual-catalogue-v1:7af41614-6d75-50bb-8580-41d22cfb8099', 'forfulgt af danmarks storste stalker', '7af41614-6d75-50bb-8580-41d22cfb8099'::uuid, '3:4 - Vanviddet', 'manual_catalogue_v1:7af41614-6d75-50bb-8580-41d22cfb8099'),
  ('manual-catalogue-v1:857d2192-ab08-5fc7-b4d0-677084b1a84d', 'forfulgt af danmarks storste stalker', '857d2192-ab08-5fc7-b4d0-677084b1a84d'::uuid, '4:4 - Bliver der fred?', 'manual_catalogue_v1:857d2192-ab08-5fc7-b4d0-677084b1a84d'),
  ('manual-catalogue-v1:865e7a83-e29b-5dea-b07f-c4112b30dd40', 'forfulgt af danmarks storste stalker', '865e7a83-e29b-5dea-b07f-c4112b30dd40'::uuid, '5:4 - Dommen', 'manual_catalogue_v1:865e7a83-e29b-5dea-b07f-c4112b30dd40'),
  ('manual-catalogue-v1:9c3f67cd-7fbc-5b5a-a852-d13b38243048', 'attentater pa amerikanske praesidenter', '9c3f67cd-7fbc-5b5a-a852-d13b38243048'::uuid, 'Fra Lincoln til Roosevelt', 'manual_catalogue_v1:9c3f67cd-7fbc-5b5a-a852-d13b38243048'),
  ('manual-catalogue-v1:c02cc96c-8c2a-57af-8241-97eabfd7334d', 'attentater pa amerikanske praesidenter', 'c02cc96c-8c2a-57af-8241-97eabfd7334d'::uuid, 'Reagan i skudlinjen', 'manual_catalogue_v1:c02cc96c-8c2a-57af-8241-97eabfd7334d'),
  ('manual-catalogue-v1:ffd8c0ed-7442-547c-98e2-1beb73af3eea', 'i skyggen af solkongen spies', 'ffd8c0ed-7442-547c-98e2-1beb73af3eea'::uuid, 'Morgenbolledamerne', 'manual_catalogue_v1:ffd8c0ed-7442-547c-98e2-1beb73af3eea'),
  ('manual-catalogue-v1:eda90c4a-f74d-597b-ba11-2d544263f8c5', 'i skyggen af solkongen spies', 'eda90c4a-f74d-597b-ba11-2d544263f8c5'::uuid, 'Formandens sekretariat', 'manual_catalogue_v1:eda90c4a-f74d-597b-ba11-2d544263f8c5'),
  ('manual-catalogue-v1:7721a276-1f6f-5aab-af1e-f1a0a6231ff5', 'i skyggen af solkongen spies', '7721a276-1f6f-5aab-af1e-f1a0a6231ff5'::uuid, 'Brækket arm og 14 årig', 'manual_catalogue_v1:7721a276-1f6f-5aab-af1e-f1a0a6231ff5'),
  ('manual-catalogue-v1:75117571-e568-5d1e-88ca-699b8c0877d0', 'i skyggen af solkongen spies', '75117571-e568-5d1e-88ca-699b8c0877d0'::uuid, 'Simon spøger stadig', 'manual_catalogue_v1:75117571-e568-5d1e-88ca-699b8c0877d0'),
  ('manual-catalogue-v1:0fe87c55-9fc9-526a-b3d2-cafbed1d0f70', 'liss tonerne af en afsked', '0fe87c55-9fc9-526a-b3d2-cafbed1d0f70'::uuid, 'Bandet Liss opstår', 'manual_catalogue_v1:0fe87c55-9fc9-526a-b3d2-cafbed1d0f70'),
  ('manual-catalogue-v1:b1648b47-7523-505c-8223-207df480778a', 'liss tonerne af en afsked', 'b1648b47-7523-505c-8223-207df480778a'::uuid, 'Det store gennembrud', 'manual_catalogue_v1:b1648b47-7523-505c-8223-207df480778a'),
  ('manual-catalogue-v1:12f79789-d3c3-599e-a246-d39b02781a60', 'liss tonerne af en afsked', '12f79789-d3c3-599e-a246-d39b02781a60'::uuid, 'Et tog man ikke kan stå af', 'manual_catalogue_v1:12f79789-d3c3-599e-a246-d39b02781a60'),
  ('manual-catalogue-v1:7c4501b7-2d77-546c-b282-de397286b40e', 'liss tonerne af en afsked', '7c4501b7-2d77-546c-b282-de397286b40e'::uuid, 'Ingen afsked', 'manual_catalogue_v1:7c4501b7-2d77-546c-b282-de397286b40e'),
  ('manual-catalogue-v1:60503d86-b37d-5a1b-a86a-34f8593e2475', 'liss tonerne af en afsked', '60503d86-b37d-5a1b-a86a-34f8593e2475'::uuid, 'Sorg og debut', 'manual_catalogue_v1:60503d86-b37d-5a1b-a86a-34f8593e2475'),
  ('manual-catalogue-v1:5b5c5996-6ef9-5fad-a9cc-5fdc894b2033', 'puks to maend', '5b5c5996-6ef9-5fad-a9cc-5fdc894b2033'::uuid, 'Hjertestop', 'manual_catalogue_v1:5b5c5996-6ef9-5fad-a9cc-5fdc894b2033'),
  ('manual-catalogue-v1:d969da60-7a28-5609-8790-c12a16a805a3', 'puks to maend', 'd969da60-7a28-5609-8790-c12a16a805a3'::uuid, 'Små motorer', 'manual_catalogue_v1:d969da60-7a28-5609-8790-c12a16a805a3'),
  ('manual-catalogue-v1:9efd35c6-3a93-5091-9e8a-ca90a48dcdbb', 'puks to maend', '9efd35c6-3a93-5091-9e8a-ca90a48dcdbb'::uuid, 'Kroppen vågner', 'manual_catalogue_v1:9efd35c6-3a93-5091-9e8a-ca90a48dcdbb'),
  ('manual-catalogue-v1:c812a546-f839-5bc1-b750-2f14ce099a27', 'puks to maend', 'c812a546-f839-5bc1-b750-2f14ce099a27'::uuid, 'Familien', 'manual_catalogue_v1:c812a546-f839-5bc1-b750-2f14ce099a27'),
  ('manual-catalogue-v1:fe9924b2-8f7d-5543-bb1e-a14403469175', 'rockerne mod fiskerne', 'fe9924b2-8f7d-5543-bb1e-a14403469175'::uuid, 'Rockerne mod fiskerne 1:2', 'manual_catalogue_v1:fe9924b2-8f7d-5543-bb1e-a14403469175'),
  ('manual-catalogue-v1:5dcdd2fa-fa93-5ddb-b02e-ce8cb59cb4ad', 'rockerne mod fiskerne', '5dcdd2fa-fa93-5ddb-b02e-ce8cb59cb4ad'::uuid, 'Rockerne mod fiskerne 2:2', 'manual_catalogue_v1:5dcdd2fa-fa93-5ddb-b02e-ce8cb59cb4ad');

insert into public.podcast_episodes (
  id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
)
select
  episode_id, podcast_key, 'manual_catalogue_v1', external_guid, manual_episode_key, title, true,
  jsonb_build_object('manual_catalogue', true, 'manual_episode_key', manual_episode_key, 'identity_version', 'manual_catalogue_v1', 'rateable', true)
from manual_catalogue_mapping_delta
on conflict (source, external_guid) do nothing;

insert into public.manual_catalogue_episode_map (
  manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
)
select
  manual_episode_key, podcast_key, episode_id, 'manual_catalogue_v1', '{}'::text[], title, true
from manual_catalogue_mapping_delta
on conflict (manual_episode_key) do nothing;

do $$
begin
  if exists (
    select 1
    from manual_catalogue_mapping_delta expected
    left join public.manual_catalogue_episode_map mapping
      on mapping.manual_episode_key = expected.manual_episode_key
    left join public.podcast_episodes episode
      on episode.id = mapping.episode_id
    where mapping.episode_id is distinct from expected.episode_id
       or mapping.podcast_key is distinct from expected.podcast_key
       or mapping.canonical_source <> 'manual_catalogue_v1'
       or mapping.is_active is not true
       or episode.id is null
       or episode.podcast_key is distinct from expected.podcast_key
       or episode.source <> 'manual_catalogue_v1'
       or episode.external_guid is distinct from expected.external_guid
       or episode.is_active is not true
  ) then
    raise exception 'Manual catalogue mapping delta contains a missing or conflicting canonical identity';
  end if;
end $$;

commit;
