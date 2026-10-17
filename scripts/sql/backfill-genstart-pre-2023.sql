-- Reviewed ONE-TIME DATA BACKFILL; deliberately kept out of supabase/migrations.
-- Source: https://onair.dk/podcast/genstart (metadata index snapshot 2026-10-14).
-- Adds only verified Genstart archive dates BEFORE 2023-07-28; no UPDATE or DELETE.
-- DR Lyd remains the normal importer and canonical source for newer episodes.
-- This single statement is atomic and rerunnable (stable identity plus existing-match guard).
-- Episode links/audio are NULL because the archive does not expose verified episode-specific URLs.
-- Published time is approximate noon in Europe/Copenhagen; original day precision is recorded in metadata.
WITH archive AS (
  SELECT a.title, a.published_date, a.duration_seconds
  FROM jsonb_to_recordset($genstart_history_20261014$
[
  {
    "title": "Ode til tarmen",
    "published_date": "2023-07-17",
    "duration_seconds": 1553
  },
  {
    "title": "Shitstormens ødelæggelser",
    "published_date": "2023-07-10",
    "duration_seconds": 1627
  },
  {
    "title": "Den evige lillesøster",
    "published_date": "2023-07-07",
    "duration_seconds": 1553
  },
  {
    "title": "Børnenes diagnoser",
    "published_date": "2023-07-06",
    "duration_seconds": 1601
  },
  {
    "title": "Forbandede franske forstæder",
    "published_date": "2023-07-05",
    "duration_seconds": 1523
  },
  {
    "title": "Anoreksiens magt",
    "published_date": "2023-07-04",
    "duration_seconds": 1619
  },
  {
    "title": "Putins eget monster",
    "published_date": "2023-07-03",
    "duration_seconds": 1569
  },
  {
    "title": "Et sjældent drab",
    "published_date": "2023-06-30",
    "duration_seconds": 1589
  },
  {
    "title": "Afskedsbrev til posten",
    "published_date": "2023-06-29",
    "duration_seconds": 1472
  },
  {
    "title": "Den sidste rejse til Titanic",
    "published_date": "2023-06-28",
    "duration_seconds": 1597
  },
  {
    "title": "Tørt land",
    "published_date": "2023-06-27",
    "duration_seconds": 1479
  },
  {
    "title": "Mytteri mod Moskva",
    "published_date": "2023-06-26",
    "duration_seconds": 1584
  },
  {
    "title": "Bedste fjender",
    "published_date": "2023-06-23",
    "duration_seconds": 1631
  },
  {
    "title": "En agent i fængslet",
    "published_date": "2023-06-22",
    "duration_seconds": 1458
  },
  {
    "title": "Vokset op på SoMe",
    "published_date": "2023-06-21",
    "duration_seconds": 1611
  },
  {
    "title": "Skyderiet i Field's",
    "published_date": "2023-06-20",
    "duration_seconds": 1487
  },
  {
    "title": "Youtuber i fangedragt",
    "published_date": "2023-06-19",
    "duration_seconds": 1609
  },
  {
    "title": "Loses lod",
    "published_date": "2023-06-16",
    "duration_seconds": 1665
  },
  {
    "title": "Miraklet i regnskoven",
    "published_date": "2023-06-15",
    "duration_seconds": 1495
  },
  {
    "title": "Identitetskrigen",
    "published_date": "2023-06-14",
    "duration_seconds": 1708
  },
  {
    "title": "Turbulens i kontroltårnet",
    "published_date": "2023-06-13",
    "duration_seconds": 1376
  },
  {
    "title": "Johanne og de manipulerede nøgenbilleder",
    "published_date": "2023-06-12",
    "duration_seconds": 1254
  },
  {
    "title": "Katastrofen i Kherson",
    "published_date": "2023-06-09",
    "duration_seconds": 1407
  },
  {
    "title": "Bandlyste Bandidos",
    "published_date": "2023-06-08",
    "duration_seconds": 1551
  },
  {
    "title": "Skærm, skræk og advarsel",
    "published_date": "2023-06-07",
    "duration_seconds": 1427
  },
  {
    "title": "Balkans bare næver",
    "published_date": "2023-06-06",
    "duration_seconds": 1639
  },
  {
    "title": "Forsvarsløs",
    "published_date": "2023-06-05",
    "duration_seconds": 1617
  },
  {
    "title": "To trin frem og et tilbage",
    "published_date": "2023-06-02",
    "duration_seconds": 1416
  },
  {
    "title": "Krise søges",
    "published_date": "2023-06-01",
    "duration_seconds": 1355
  },
  {
    "title": "Kræftanstrengelser",
    "published_date": "2023-05-31",
    "duration_seconds": 1531
  },
  {
    "title": "Gennem ild og vand",
    "published_date": "2023-05-30",
    "duration_seconds": 1496
  },
  {
    "title": "Good old Joe",
    "published_date": "2023-05-26",
    "duration_seconds": 1622
  },
  {
    "title": "Det sidste barn i Syrien",
    "published_date": "2023-05-25",
    "duration_seconds": 1460
  },
  {
    "title": "Fødsler ved fronten",
    "published_date": "2023-05-24",
    "duration_seconds": 1287
  },
  {
    "title": "Ung og udenfor",
    "published_date": "2023-05-23",
    "duration_seconds": 1485
  },
  {
    "title": "Grønlands stemme",
    "published_date": "2023-05-22",
    "duration_seconds": 1742
  },
  {
    "title": "Ukraine mangler mænd",
    "published_date": "2023-05-19",
    "duration_seconds": 1536
  },
  {
    "title": "Ikke for specielle børn",
    "published_date": "2023-05-17",
    "duration_seconds": 1579
  },
  {
    "title": "Søvnløs i Seoul",
    "published_date": "2023-05-16",
    "duration_seconds": 1588
  },
  {
    "title": "Appetit på vægttab",
    "published_date": "2023-05-15",
    "duration_seconds": 1689
  },
  {
    "title": "Erdogans endeligt?",
    "published_date": "2023-05-12",
    "duration_seconds": 1500
  },
  {
    "title": "Guldimunds faderskab",
    "published_date": "2023-05-11",
    "duration_seconds": 1473
  },
  {
    "title": "Ruslands nye militser",
    "published_date": "2023-05-10",
    "duration_seconds": 1326
  },
  {
    "title": "Haster, haster, haster",
    "published_date": "2023-05-09",
    "duration_seconds": 1407
  },
  {
    "title": "Blodig mode",
    "published_date": "2023-05-08",
    "duration_seconds": 1571
  },
  {
    "title": "Mørklagt - Skyggekrigen",
    "published_date": "2023-05-05",
    "duration_seconds": 1698
  },
  {
    "title": "Égly Station 16.29",
    "published_date": "2023-05-04",
    "duration_seconds": 1636
  },
  {
    "title": "Sudans sidste helle",
    "published_date": "2023-05-03",
    "duration_seconds": 1479
  },
  {
    "title": "Lizettes greb om magten",
    "published_date": "2023-05-02",
    "duration_seconds": 1555
  },
  {
    "title": "Færøernes russiske forbindelse",
    "published_date": "2023-05-01",
    "duration_seconds": 1380
  },
  {
    "title": "Forbindelsen til Emilie Meng",
    "published_date": "2023-04-28",
    "duration_seconds": 1509
  },
  {
    "title": "Traumet fra Sankt Croix",
    "published_date": "2023-04-27",
    "duration_seconds": 1436
  },
  {
    "title": "Det forbudte navn",
    "published_date": "2023-04-26",
    "duration_seconds": 1380
  },
  {
    "title": "What the Fox",
    "published_date": "2023-04-25",
    "duration_seconds": 1519
  },
  {
    "title": "Grønlands tabte liv",
    "published_date": "2023-04-24",
    "duration_seconds": 1430
  },
  {
    "title": "Overlægens advarsler",
    "published_date": "2023-04-21",
    "duration_seconds": 1610
  },
  {
    "title": "Mennesker over Middelhavet",
    "published_date": "2023-04-20",
    "duration_seconds": 1256
  },
  {
    "title": "Hemmelig krig på havets bund",
    "published_date": "2023-04-19",
    "duration_seconds": 1606
  },
  {
    "title": "Ned i skyttegraven",
    "published_date": "2023-04-18",
    "duration_seconds": 1534
  },
  {
    "title": "Lamaens tunge",
    "published_date": "2023-04-17",
    "duration_seconds": 1333
  },
  {
    "title": "Den ligegyldige taleskriver",
    "published_date": "2023-04-14",
    "duration_seconds": 1470
  },
  {
    "title": "Grænseløs intelligens",
    "published_date": "2023-04-13",
    "duration_seconds": 1506
  },
  {
    "title": "En stormfuld affære",
    "published_date": "2023-04-12",
    "duration_seconds": 1548
  },
  {
    "title": "En agent i Aalborg",
    "published_date": "2023-04-11",
    "duration_seconds": 1512
  },
  {
    "title": "Albertes overgang",
    "published_date": "2023-04-03",
    "duration_seconds": 1540
  },
  {
    "title": "Israels opgør",
    "published_date": "2023-03-31",
    "duration_seconds": 1591
  },
  {
    "title": "Isdronningen",
    "published_date": "2023-03-30",
    "duration_seconds": 1457
  },
  {
    "title": "I sygehus til halsen",
    "published_date": "2023-03-29",
    "duration_seconds": 1416
  },
  {
    "title": "Mellemøstens dødsfjender",
    "published_date": "2023-03-28",
    "duration_seconds": 1527
  },
  {
    "title": "Ufed forskelsbehandling",
    "published_date": "2023-03-27",
    "duration_seconds": 1478
  },
  {
    "title": "Xi du kan li' mig",
    "published_date": "2023-03-24",
    "duration_seconds": 1288
  },
  {
    "title": "Gåden på havets bund",
    "published_date": "2023-03-23",
    "duration_seconds": 1417
  },
  {
    "title": "Hitler på teenageværelset",
    "published_date": "2023-03-22",
    "duration_seconds": 1443
  },
  {
    "title": "De moralsk defekte kvinder",
    "published_date": "2023-03-21",
    "duration_seconds": 1453
  },
  {
    "title": "BBCs selvmål",
    "published_date": "2023-03-20",
    "duration_seconds": 1509
  },
  {
    "title": "Covid-mysteriet",
    "published_date": "2023-03-17",
    "duration_seconds": 1443
  },
  {
    "title": "Ud af Ruslands skygge",
    "published_date": "2023-03-16",
    "duration_seconds": 1276
  },
  {
    "title": "En kropumulig verden",
    "published_date": "2023-03-15",
    "duration_seconds": 1600
  },
  {
    "title": "Ny borgerlig ballade",
    "published_date": "2023-03-14",
    "duration_seconds": 1529
  },
  {
    "title": "Giftigt gods",
    "published_date": "2023-03-13",
    "duration_seconds": 1365
  },
  {
    "title": "Jon Stephensens signatur",
    "published_date": "2023-03-10",
    "duration_seconds": 1503
  },
  {
    "title": "Farvel og tobak",
    "published_date": "2023-03-09",
    "duration_seconds": 1470
  },
  {
    "title": "De tabte liv",
    "published_date": "2023-03-08",
    "duration_seconds": 1257
  },
  {
    "title": "Nigeria eller kaos",
    "published_date": "2023-03-07",
    "duration_seconds": 1490
  },
  {
    "title": "Krigsskibet er ladet med Dannebrog",
    "published_date": "2023-03-06",
    "duration_seconds": 1321
  },
  {
    "title": "\"En beklagelig fejl\"",
    "published_date": "2023-03-05",
    "duration_seconds": 2047
  },
  {
    "title": "Overlægen og det levende bevis",
    "published_date": "2023-03-03",
    "duration_seconds": 1493
  },
  {
    "title": "Frygten for TikTok",
    "published_date": "2023-03-02",
    "duration_seconds": 1583
  },
  {
    "title": "Nej tak til Tarek",
    "published_date": "2023-03-01",
    "duration_seconds": 1470
  },
  {
    "title": "Skælvet i Syrien",
    "published_date": "2023-02-28",
    "duration_seconds": 1556
  },
  {
    "title": "Mænd uden venner",
    "published_date": "2023-02-27",
    "duration_seconds": 1479
  },
  {
    "title": "Ukraines børn",
    "published_date": "2023-02-24",
    "duration_seconds": 1695
  },
  {
    "title": "Universet på formel",
    "published_date": "2023-02-23",
    "duration_seconds": 1564
  },
  {
    "title": "Stress på Borgen",
    "published_date": "2023-02-22",
    "duration_seconds": 1504
  },
  {
    "title": "Sædceller savnes",
    "published_date": "2023-02-21",
    "duration_seconds": 1576
  },
  {
    "title": "Min knægt er i krig",
    "published_date": "2023-02-20",
    "duration_seconds": 1639
  },
  {
    "title": "Shell i flammer",
    "published_date": "2023-02-17",
    "duration_seconds": 1409
  },
  {
    "title": "Gourmet uden grænser",
    "published_date": "2023-02-16",
    "duration_seconds": 1537
  },
  {
    "title": "Kvinder på kasernen",
    "published_date": "2023-02-15",
    "duration_seconds": 1252
  },
  {
    "title": "En bismag af gift",
    "published_date": "2023-02-14",
    "duration_seconds": 1414
  },
  {
    "title": "Jorden ryster under Erdogan",
    "published_date": "2023-02-13",
    "duration_seconds": 1324
  },
  {
    "title": "I Faderhusets hænder",
    "published_date": "2023-02-10",
    "duration_seconds": 1448
  },
  {
    "title": "Zieglers sidste chance",
    "published_date": "2023-02-09",
    "duration_seconds": 1327
  },
  {
    "title": "Afmagtens røde faner",
    "published_date": "2023-02-08",
    "duration_seconds": 1474
  },
  {
    "title": "Pamela og Katja",
    "published_date": "2023-02-07",
    "duration_seconds": 1344
  },
  {
    "title": "Mord i Memphis",
    "published_date": "2023-02-06",
    "duration_seconds": 1623
  },
  {
    "title": "Kødkonkurs",
    "published_date": "2023-02-03",
    "duration_seconds": 1620
  },
  {
    "title": "Kulturelitens lort på dåse",
    "published_date": "2023-02-02",
    "duration_seconds": 1596
  },
  {
    "title": "Leoparder i Ukraine",
    "published_date": "2023-02-01",
    "duration_seconds": 1373
  },
  {
    "title": "Jävla Paludan",
    "published_date": "2023-01-31",
    "duration_seconds": 1516
  },
  {
    "title": "Hævn over henrettelser",
    "published_date": "2023-01-30",
    "duration_seconds": 1603
  },
  {
    "title": "Skærm børnene",
    "published_date": "2023-01-27",
    "duration_seconds": 1507
  },
  {
    "title": "Puk på helvedes hovedvej",
    "published_date": "2023-01-26",
    "duration_seconds": 1687
  },
  {
    "title": "Adopteret på en løgn",
    "published_date": "2023-01-25",
    "duration_seconds": 1660
  },
  {
    "title": "Akut kaos",
    "published_date": "2023-01-24",
    "duration_seconds": 1492
  },
  {
    "title": "Anker kom aldrig hjem",
    "published_date": "2023-01-23",
    "duration_seconds": 1371
  },
  {
    "title": "Døden ved Bakhmut",
    "published_date": "2023-01-20",
    "duration_seconds": 1579
  },
  {
    "title": "Bye bye bededag",
    "published_date": "2023-01-19",
    "duration_seconds": 1481
  },
  {
    "title": "Er Lasse racist?",
    "published_date": "2023-01-18",
    "duration_seconds": 1574
  },
  {
    "title": "PFAS i dit blod",
    "published_date": "2023-01-17",
    "duration_seconds": 1553
  },
  {
    "title": "Israels ulykke",
    "published_date": "2023-01-16",
    "duration_seconds": 1598
  },
  {
    "title": "Klassen forfølger dig",
    "published_date": "2023-01-13",
    "duration_seconds": 1627
  },
  {
    "title": "Bolsonaros hooligans",
    "published_date": "2023-01-12",
    "duration_seconds": 1461
  },
  {
    "title": "En elsket islamofob",
    "published_date": "2023-01-11",
    "duration_seconds": 1500
  },
  {
    "title": "Harrys hævn",
    "published_date": "2023-01-10",
    "duration_seconds": 1509
  },
  {
    "title": "Pis af",
    "published_date": "2023-01-09",
    "duration_seconds": 1532
  },
  {
    "title": "En menneskelig maskine",
    "published_date": "2023-01-06",
    "duration_seconds": 1428
  },
  {
    "title": "Lidegaards radikale valg",
    "published_date": "2023-01-05",
    "duration_seconds": 1716
  },
  {
    "title": "Putins tyske lakaj",
    "published_date": "2023-01-04",
    "duration_seconds": 1330
  },
  {
    "title": "På sporet af livet",
    "published_date": "2023-01-03",
    "duration_seconds": 1529
  },
  {
    "title": "Dumhedens bjerg",
    "published_date": "2023-01-02",
    "duration_seconds": 1625
  },
  {
    "title": "Mørklagt - Agent Samsam",
    "published_date": "2022-12-22",
    "duration_seconds": 1745
  },
  {
    "title": "Jul i Ukraine",
    "published_date": "2022-12-21",
    "duration_seconds": 1487
  },
  {
    "title": "En som Lone",
    "published_date": "2022-12-20",
    "duration_seconds": 1541
  },
  {
    "title": "En verden uden liv",
    "published_date": "2022-12-19",
    "duration_seconds": 1467
  },
  {
    "title": "Skatter op, skatter ned",
    "published_date": "2022-12-16",
    "duration_seconds": 1501
  },
  {
    "title": "Danmarkshistoriens største løftebrud",
    "published_date": "2022-12-15",
    "duration_seconds": 1486
  },
  {
    "title": "Noget at ruge over",
    "published_date": "2022-12-14",
    "duration_seconds": 1526
  },
  {
    "title": "Fugl eller fjende?",
    "published_date": "2022-12-13",
    "duration_seconds": 1603
  },
  {
    "title": "Højre om!",
    "published_date": "2022-12-12",
    "duration_seconds": 1328
  },
  {
    "title": "Ritts regering",
    "published_date": "2022-12-09",
    "duration_seconds": 1730
  },
  {
    "title": "Skam dig!",
    "published_date": "2022-12-08",
    "duration_seconds": 1492
  },
  {
    "title": "Et seriemordersamfund",
    "published_date": "2022-12-07",
    "duration_seconds": 1393
  },
  {
    "title": "Manden fra Moon",
    "published_date": "2022-12-06",
    "duration_seconds": 1607
  },
  {
    "title": "Ukraines ubærlige minde",
    "published_date": "2022-12-05",
    "duration_seconds": 1533
  },
  {
    "title": "Irans forbandede fodboldfeber",
    "published_date": "2022-12-02",
    "duration_seconds": 1584
  },
  {
    "title": "Forældrefælden",
    "published_date": "2022-12-01",
    "duration_seconds": 1493
  },
  {
    "title": "Preben vil dø",
    "published_date": "2022-11-30",
    "duration_seconds": 1769
  },
  {
    "title": "Flammer i Kina",
    "published_date": "2022-11-29",
    "duration_seconds": 1304
  },
  {
    "title": "Kryptos hvide ridder",
    "published_date": "2022-11-28",
    "duration_seconds": 1524
  },
  {
    "title": "Dansk husmor i Islamisk Stat",
    "published_date": "2022-11-25",
    "duration_seconds": 1376
  },
  {
    "title": "Fleece i en hornlygte",
    "published_date": "2022-11-24",
    "duration_seconds": 1441
  },
  {
    "title": "Frisind i Færøerne?",
    "published_date": "2022-11-23",
    "duration_seconds": 1506
  },
  {
    "title": "Fodbold med lukkede øjne",
    "published_date": "2022-11-22",
    "duration_seconds": 1541
  },
  {
    "title": "Missil på afveje",
    "published_date": "2022-11-21",
    "duration_seconds": 1446
  },
  {
    "title": "Make Trump great again",
    "published_date": "2022-11-18",
    "duration_seconds": 1572
  },
  {
    "title": "En COP med gæld",
    "published_date": "2022-11-17",
    "duration_seconds": 1461
  },
  {
    "title": "Den uendelige skatteskandale",
    "published_date": "2022-11-16",
    "duration_seconds": 1622
  },
  {
    "title": "Wagner ud af skyggen",
    "published_date": "2022-11-15",
    "duration_seconds": 1582
  },
  {
    "title": "Bad COP27",
    "published_date": "2022-11-14",
    "duration_seconds": 1336
  },
  {
    "title": "\"Nu er det fucking Ninas tur\"",
    "published_date": "2022-11-11",
    "duration_seconds": 1604
  },
  {
    "title": "Radikaos",
    "published_date": "2022-11-10",
    "duration_seconds": 1559
  },
  {
    "title": "Blå blok på is",
    "published_date": "2022-11-09",
    "duration_seconds": 1401
  },
  {
    "title": "Alt på spil i Pennsylvania",
    "published_date": "2022-11-08",
    "duration_seconds": 1558
  },
  {
    "title": "Verdens mægtigste mand",
    "published_date": "2022-11-07",
    "duration_seconds": 1427
  },
  {
    "title": "Et personligt valg",
    "published_date": "2022-11-04",
    "duration_seconds": 1634
  },
  {
    "title": "USA mod undergangen",
    "published_date": "2022-11-03",
    "duration_seconds": 1635
  },
  {
    "title": "Nattens dronning",
    "published_date": "2022-11-02",
    "duration_seconds": 1339
  },
  {
    "title": "Fravalgt",
    "published_date": "2022-11-01",
    "duration_seconds": 1578
  },
  {
    "title": "PoliTikTok",
    "published_date": "2022-10-31",
    "duration_seconds": 1500
  },
  {
    "title": "Hvis der var valg i morgen",
    "published_date": "2022-10-28",
    "duration_seconds": 1424
  },
  {
    "title": "Drømmen om midten",
    "published_date": "2022-10-27",
    "duration_seconds": 1337
  },
  {
    "title": "Truss af tronen",
    "published_date": "2022-10-26",
    "duration_seconds": 1414
  },
  {
    "title": "Baseret på frygtelige hændelser",
    "published_date": "2022-10-25",
    "duration_seconds": 1416
  },
  {
    "title": "Klimavalg på herrens mark",
    "published_date": "2022-10-24",
    "duration_seconds": 1551
  },
  {
    "title": "Ch/FE",
    "published_date": "2022-10-17",
    "duration_seconds": 1659
  },
  {
    "title": "Løkkefølelsen",
    "published_date": "2022-10-14",
    "duration_seconds": 1506
  },
  {
    "title": "Man gjorde en prins fortræd",
    "published_date": "2022-10-13",
    "duration_seconds": 1518
  },
  {
    "title": "Ensom stuegang",
    "published_date": "2022-10-12",
    "duration_seconds": 1364
  },
  {
    "title": "Putins modangreb",
    "published_date": "2022-10-11",
    "duration_seconds": 1632
  },
  {
    "title": "Danmarks dybeste hemmeligheder",
    "published_date": "2022-10-10",
    "duration_seconds": 1401
  },
  {
    "title": "Mette i midten",
    "published_date": "2022-10-07",
    "duration_seconds": 1490
  },
  {
    "title": "De utro vælgere",
    "published_date": "2022-10-06",
    "duration_seconds": 1536
  },
  {
    "title": "Politisk pis og papirnusseri",
    "published_date": "2022-10-05",
    "duration_seconds": 1407
  },
  {
    "title": "Asteroidernes angreb",
    "published_date": "2022-10-04",
    "duration_seconds": 1337
  },
  {
    "title": "Porten til riget åbner sig på ny",
    "published_date": "2022-10-03",
    "duration_seconds": 1582
  },
  {
    "title": "Sabotage i Østersøen",
    "published_date": "2022-09-30",
    "duration_seconds": 1428
  },
  {
    "title": "De døves sprog forsvinder",
    "published_date": "2022-09-29",
    "duration_seconds": 1604
  },
  {
    "title": "Kvinder mod præstestyret",
    "published_date": "2022-09-28",
    "duration_seconds": 1367
  },
  {
    "title": "Et radikalt valg",
    "published_date": "2022-09-27",
    "duration_seconds": 1574
  },
  {
    "title": "Putins farlige træk",
    "published_date": "2022-09-26",
    "duration_seconds": 1402
  },
  {
    "title": "Mindet om Mussolini",
    "published_date": "2022-09-23",
    "duration_seconds": 1567
  },
  {
    "title": "Danmarks problematiske partner",
    "published_date": "2022-09-22",
    "duration_seconds": 1409
  },
  {
    "title": "Dømt til gæld",
    "published_date": "2022-09-21",
    "duration_seconds": 1602
  },
  {
    "title": "Beretning om et kvindedrab",
    "published_date": "2022-09-20",
    "duration_seconds": 1723
  },
  {
    "title": "Kulden kommer",
    "published_date": "2022-09-19",
    "duration_seconds": 1339
  },
  {
    "title": "Søren skal skilles",
    "published_date": "2022-09-16",
    "duration_seconds": 1484
  },
  {
    "title": "Ukraines blitzkrig",
    "published_date": "2022-09-15",
    "duration_seconds": 1516
  },
  {
    "title": "Længe leve kong Charles",
    "published_date": "2022-09-14",
    "duration_seconds": 1541
  },
  {
    "title": "De tabte drenge",
    "published_date": "2022-09-13",
    "duration_seconds": 1474
  },
  {
    "title": "Den uopklarede mordbrand",
    "published_date": "2022-09-12",
    "duration_seconds": 1539
  },
  {
    "title": "Jimmie-momentet",
    "published_date": "2022-09-09",
    "duration_seconds": 1452
  },
  {
    "title": "Pakistan drukner",
    "published_date": "2022-09-08",
    "duration_seconds": 1340
  },
  {
    "title": "Tik Tok Tate",
    "published_date": "2022-09-07",
    "duration_seconds": 1491
  },
  {
    "title": "Valgkampens vigtigste vælger",
    "published_date": "2022-09-06",
    "duration_seconds": 1444
  },
  {
    "title": "Russere ingen adgang",
    "published_date": "2022-09-05",
    "duration_seconds": 1341
  },
  {
    "title": "Fløjkrig i folkekirken",
    "published_date": "2022-09-02",
    "duration_seconds": 1386
  },
  {
    "title": "Truss på tronen",
    "published_date": "2022-09-01",
    "duration_seconds": 1484
  },
  {
    "title": "Fogde på et fad",
    "published_date": "2022-08-31",
    "duration_seconds": 1434
  },
  {
    "title": "Streng, strengere, straf",
    "published_date": "2022-08-30",
    "duration_seconds": 1415
  },
  {
    "title": "Højt at flyve...",
    "published_date": "2022-08-29",
    "duration_seconds": 1575
  },
  {
    "title": "Konspirationskongens fald",
    "published_date": "2022-08-26",
    "duration_seconds": 1459
  },
  {
    "title": "Døden i de danske farvande",
    "published_date": "2022-08-25",
    "duration_seconds": 1370
  },
  {
    "title": "Ludomanens revanche",
    "published_date": "2022-08-24",
    "duration_seconds": 1541
  },
  {
    "title": "Russere i fælden",
    "published_date": "2022-08-23",
    "duration_seconds": 1430
  },
  {
    "title": "Hjort takker af",
    "published_date": "2022-08-22",
    "duration_seconds": 1395
  },
  {
    "title": "Søren som statsminister",
    "published_date": "2022-08-19",
    "duration_seconds": 1502
  },
  {
    "title": "Rose og Rushdie",
    "published_date": "2022-08-18",
    "duration_seconds": 1539
  },
  {
    "title": "Mere fri abort",
    "published_date": "2022-08-17",
    "duration_seconds": 1550
  },
  {
    "title": "Nancy mod Kina",
    "published_date": "2022-08-16",
    "duration_seconds": 1465
  },
  {
    "title": "Amdis tunge bagage",
    "published_date": "2022-08-15",
    "duration_seconds": 1475
  },
  {
    "title": "En uhyggelig hed sommer",
    "published_date": "2022-08-12",
    "duration_seconds": 1552
  },
  {
    "title": "Bin Ladens løjtnant",
    "published_date": "2022-08-11",
    "duration_seconds": 1487
  },
  {
    "title": "Livet uden Kim Wall",
    "published_date": "2022-08-10",
    "duration_seconds": 1695
  },
  {
    "title": "Trumps kupforsøg",
    "published_date": "2022-08-09",
    "duration_seconds": 1453
  },
  {
    "title": "Kimer deporteret",
    "published_date": "2022-08-08",
    "duration_seconds": 1452
  },
  {
    "title": "Asgers abekoppe-gevinst",
    "published_date": "2022-08-05",
    "duration_seconds": 1419
  },
  {
    "title": "Syg i et sygt system",
    "published_date": "2022-08-04",
    "duration_seconds": 1463
  },
  {
    "title": "Nyt fra det ydre rum",
    "published_date": "2022-08-03",
    "duration_seconds": 1390
  },
  {
    "title": "Mettes embedshær",
    "published_date": "2022-08-02",
    "duration_seconds": 1472
  },
  {
    "title": "Putin den Store",
    "published_date": "2022-08-01",
    "duration_seconds": 1441
  },
  {
    "title": "Bedre skilt end aldrig",
    "published_date": "2022-07-25",
    "duration_seconds": 1544
  },
  {
    "title": "Stålværkets sidste soldater",
    "published_date": "2022-07-18",
    "duration_seconds": 1577
  },
  {
    "title": "Forbandede fertilitet",
    "published_date": "2022-07-11",
    "duration_seconds": 1608
  },
  {
    "title": "Løkke-Lars",
    "published_date": "2022-07-06",
    "duration_seconds": 1607
  },
  {
    "title": "Tour de Leth",
    "published_date": "2022-07-01",
    "duration_seconds": 1591
  },
  {
    "title": "Borgmesterens morfinmisbrug",
    "published_date": "2022-06-30",
    "duration_seconds": 1522
  },
  {
    "title": "Inger-Demokraterne",
    "published_date": "2022-06-29",
    "duration_seconds": 1523
  },
  {
    "title": "Havfruen i Højesteret",
    "published_date": "2022-06-28",
    "duration_seconds": 1504
  },
  {
    "title": "Med Gud i russisk fængsel",
    "published_date": "2022-06-27",
    "duration_seconds": 1435
  },
  {
    "title": "Jungledøden",
    "published_date": "2022-06-24",
    "duration_seconds": 1455
  },
  {
    "title": "Lægens dårlige samvittighed",
    "published_date": "2022-06-23",
    "duration_seconds": 1517
  },
  {
    "title": "Korrespondent, kræft og kirsebær",
    "published_date": "2022-06-22",
    "duration_seconds": 1424
  },
  {
    "title": "Et paradise for alle",
    "published_date": "2022-06-21",
    "duration_seconds": 1589
  },
  {
    "title": "Det levende bevis",
    "published_date": "2022-06-20",
    "duration_seconds": 1798
  },
  {
    "title": "En ond spiral",
    "published_date": "2022-06-17",
    "duration_seconds": 1520
  },
  {
    "title": "Fattigtyverne",
    "published_date": "2022-06-16",
    "duration_seconds": 1446
  },
  {
    "title": "Hooliganens hemmelighed",
    "published_date": "2022-06-15",
    "duration_seconds": 1357
  },
  {
    "title": "Racisme på repertoiret",
    "published_date": "2022-06-14",
    "duration_seconds": 1343
  },
  {
    "title": "Sanjay og den forsvundne skat",
    "published_date": "2022-06-13",
    "duration_seconds": 1456
  },
  {
    "title": "Besøg fra rummet?",
    "published_date": "2022-06-10",
    "duration_seconds": 1577
  },
  {
    "title": "Dronernes herre",
    "published_date": "2022-06-09",
    "duration_seconds": 1418
  },
  {
    "title": "Dronning Elizabeth forever",
    "published_date": "2022-06-08",
    "duration_seconds": 1509
  },
  {
    "title": "Åh abekopper",
    "published_date": "2022-06-07",
    "duration_seconds": 1471
  },
  {
    "title": "SoMe Mette",
    "published_date": "2022-06-03",
    "duration_seconds": 1540
  },
  {
    "title": "Krigens første forbryder",
    "published_date": "2022-06-02",
    "duration_seconds": 1342
  },
  {
    "title": "Det 27. skoleskyderi",
    "published_date": "2022-06-01",
    "duration_seconds": 1574
  },
  {
    "title": "Uffes forsvar",
    "published_date": "2022-05-31",
    "duration_seconds": 1518
  },
  {
    "title": "Prebens voldtægt",
    "published_date": "2022-05-30",
    "duration_seconds": 1393
  },
  {
    "title": "Corona-Kim",
    "published_date": "2022-05-27",
    "duration_seconds": 1405
  },
  {
    "title": "En JA-mission",
    "published_date": "2022-05-25",
    "duration_seconds": 1415
  },
  {
    "title": "Berits ben",
    "published_date": "2022-05-24",
    "duration_seconds": 1319
  },
  {
    "title": "Grønlands første flygtning er faldet",
    "published_date": "2022-05-23",
    "duration_seconds": 1431
  },
  {
    "title": "En fredet Hjort",
    "published_date": "2022-05-20",
    "duration_seconds": 1483
  },
  {
    "title": "Hejdå neutralitet!",
    "published_date": "2022-05-19",
    "duration_seconds": 1417
  },
  {
    "title": "Depps domstol",
    "published_date": "2022-05-18",
    "duration_seconds": 1593
  },
  {
    "title": "En tilsløret fremtid",
    "published_date": "2022-05-17",
    "duration_seconds": 1355
  },
  {
    "title": "En kongelig knibe",
    "published_date": "2022-05-16",
    "duration_seconds": 1424
  },
  {
    "title": "Tøffe fortryder intet",
    "published_date": "2022-05-12",
    "duration_seconds": 1524
  },
  {
    "title": "Et højlydt skrig",
    "published_date": "2022-05-11",
    "duration_seconds": 1546
  },
  {
    "title": "Konfetti-krig",
    "published_date": "2022-05-10",
    "duration_seconds": 1523
  },
  {
    "title": "Nazister overalt",
    "published_date": "2022-05-09",
    "duration_seconds": 1432
  },
  {
    "title": "Rigmandens cyber-rodeo",
    "published_date": "2022-05-06",
    "duration_seconds": 1436
  },
  {
    "title": "Det villige Vesten",
    "published_date": "2022-05-05",
    "duration_seconds": 1485
  },
  {
    "title": "Ulven kommer",
    "published_date": "2022-05-04",
    "duration_seconds": 1596
  },
  {
    "title": "En slam sag",
    "published_date": "2022-05-03",
    "duration_seconds": 1697
  },
  {
    "title": "Velkommen til Medina",
    "published_date": "2022-05-02",
    "duration_seconds": 1612
  },
  {
    "title": "En drøm om censur",
    "published_date": "2022-04-29",
    "duration_seconds": 1571
  },
  {
    "title": "Tysklands dårlige samvittighed",
    "published_date": "2022-04-28",
    "duration_seconds": 1595
  },
  {
    "title": "Nadim i Qatar",
    "published_date": "2022-04-27",
    "duration_seconds": 1656
  },
  {
    "title": "Paludan og påskeopstanden",
    "published_date": "2022-04-26",
    "duration_seconds": 1388
  },
  {
    "title": "Putins plan B",
    "published_date": "2022-04-25",
    "duration_seconds": 1480
  },
  {
    "title": "Le Pen dynastiet",
    "published_date": "2022-04-22",
    "duration_seconds": 1535
  },
  {
    "title": "Klar, parat, prep!",
    "published_date": "2022-04-21",
    "duration_seconds": 1402
  },
  {
    "title": "Skakgeni på krigsstien",
    "published_date": "2022-04-20",
    "duration_seconds": 1620
  },
  {
    "title": "At kæmpe mod vindmøller",
    "published_date": "2022-04-19",
    "duration_seconds": 1596
  },
  {
    "title": "Rap fyr i L.A.",
    "published_date": "2022-04-11",
    "duration_seconds": 1531
  },
  {
    "title": "Butja",
    "published_date": "2022-04-08",
    "duration_seconds": 1704
  },
  {
    "title": "Mails fra mørket",
    "published_date": "2022-04-07",
    "duration_seconds": 1808
  },
  {
    "title": "Hvem angav Anne?",
    "published_date": "2022-04-06",
    "duration_seconds": 1500
  },
  {
    "title": "Flere flygtninge, tak",
    "published_date": "2022-04-05",
    "duration_seconds": 1515
  },
  {
    "title": "Zelenskyjs talegaver",
    "published_date": "2022-04-04",
    "duration_seconds": 1290
  },
  {
    "title": "Viktors væmmelige ven",
    "published_date": "2022-04-01",
    "duration_seconds": 1489
  },
  {
    "title": "Rumrejsen 2023",
    "published_date": "2022-03-31",
    "duration_seconds": 1669
  },
  {
    "title": "Putins brutale fodsoldat",
    "published_date": "2022-03-30",
    "duration_seconds": 1445
  },
  {
    "title": "Et ædru liv",
    "published_date": "2022-03-29",
    "duration_seconds": 1626
  },
  {
    "title": "Kanyes krænkelser",
    "published_date": "2022-03-28",
    "duration_seconds": 1461
  },
  {
    "title": "De unge menneskers lidelser",
    "published_date": "2022-03-25",
    "duration_seconds": 1402
  },
  {
    "title": "Forført af et hængebugsvin",
    "published_date": "2022-03-24",
    "duration_seconds": 1574
  },
  {
    "title": "\"Spyt dem ud som insekter\"",
    "published_date": "2022-03-23",
    "duration_seconds": 1350
  },
  {
    "title": "Londongrad has fallen",
    "published_date": "2022-03-22",
    "duration_seconds": 1479
  },
  {
    "title": "Ude slemt, hjemme værst?",
    "published_date": "2022-03-21",
    "duration_seconds": 1523
  },
  {
    "title": "Miki mod førstedamen",
    "published_date": "2022-03-18",
    "duration_seconds": 1571
  },
  {
    "title": "Meget mere Milo",
    "published_date": "2022-03-17",
    "duration_seconds": 1449
  },
  {
    "title": "Klaphat og nejhat",
    "published_date": "2022-03-16",
    "duration_seconds": 1533
  },
  {
    "title": "Samsam i stikken?",
    "published_date": "2022-03-15",
    "duration_seconds": 1630
  },
  {
    "title": "Ø-nskedrømme",
    "published_date": "2022-03-14",
    "duration_seconds": 1419
  },
  {
    "title": "Farvel til Moskva",
    "published_date": "2022-03-11",
    "duration_seconds": 1443
  },
  {
    "title": "Putins hvide løgne",
    "published_date": "2022-03-10",
    "duration_seconds": 1473
  },
  {
    "title": "Oligark-bold",
    "published_date": "2022-03-09",
    "duration_seconds": 1495
  },
  {
    "title": "Kimer og Krigen",
    "published_date": "2022-03-08",
    "duration_seconds": 1582
  },
  {
    "title": "Det er ikke bare gas",
    "published_date": "2022-03-07",
    "duration_seconds": 1461
  },
  {
    "title": "Grønne Mettes sorte fabrik",
    "published_date": "2022-03-04",
    "duration_seconds": 1433
  },
  {
    "title": "Komiker og krigshelt",
    "published_date": "2022-03-03",
    "duration_seconds": 1430
  },
  {
    "title": "Kage i forvaltningen",
    "published_date": "2022-03-02",
    "duration_seconds": 1576
  },
  {
    "title": "Ukraine imod alle odds",
    "published_date": "2022-03-01",
    "duration_seconds": 1561
  },
  {
    "title": "BitBonnie & CryptoClyde",
    "published_date": "2022-02-28",
    "duration_seconds": 1484
  },
  {
    "title": "Hennings flugt fra Putin",
    "published_date": "2022-02-25",
    "duration_seconds": 1378
  },
  {
    "title": "Putins krig i Europa",
    "published_date": "2022-02-24",
    "duration_seconds": 1501
  },
  {
    "title": "Mia og de mange andre",
    "published_date": "2022-02-23",
    "duration_seconds": 1343
  },
  {
    "title": "Mærsk og våbenfabrikken",
    "published_date": "2022-02-22",
    "duration_seconds": 1383
  },
  {
    "title": "Haanings hævn",
    "published_date": "2022-02-21",
    "duration_seconds": 1350
  },
  {
    "title": "Kronprinsen i den olympiske ild",
    "published_date": "2022-02-11",
    "duration_seconds": 1454
  },
  {
    "title": "På flugt fra bortadoption",
    "published_date": "2022-02-10",
    "duration_seconds": 1575
  },
  {
    "title": "Farlig fodbold",
    "published_date": "2022-02-09",
    "duration_seconds": 1439
  },
  {
    "title": "Drowning Street 10",
    "published_date": "2022-02-08",
    "duration_seconds": 1511
  },
  {
    "title": "Farlig havudsigt",
    "published_date": "2022-02-07",
    "duration_seconds": 1350
  },
  {
    "title": "Veganer-beef",
    "published_date": "2022-02-04",
    "duration_seconds": 1558
  },
  {
    "title": "Miskmask i Mali",
    "published_date": "2022-02-03",
    "duration_seconds": 1555
  },
  {
    "title": "Kongens coronaknibe",
    "published_date": "2022-02-02",
    "duration_seconds": 1575
  },
  {
    "title": "Pers to liv",
    "published_date": "2022-02-01",
    "duration_seconds": 1360
  },
  {
    "title": "Taliban på fjeldet",
    "published_date": "2022-01-31",
    "duration_seconds": 1424
  },
  {
    "title": "Bedst i test",
    "published_date": "2022-01-28",
    "duration_seconds": 1432
  },
  {
    "title": "Rusland på grænsen",
    "published_date": "2022-01-27",
    "duration_seconds": 1401
  },
  {
    "title": "Minktraumer",
    "published_date": "2022-01-26",
    "duration_seconds": 1407
  },
  {
    "title": "Splittet til atomer",
    "published_date": "2022-01-25",
    "duration_seconds": 1413
  },
  {
    "title": "Safe space Hogwarts?",
    "published_date": "2022-01-24",
    "duration_seconds": 1398
  },
  {
    "title": "Da Vinci mysteriet",
    "published_date": "2022-01-21",
    "duration_seconds": 1526
  },
  {
    "title": "Mortens modstand",
    "published_date": "2022-01-20",
    "duration_seconds": 1539
  },
  {
    "title": "Vildt naturlig død?",
    "published_date": "2022-01-19",
    "duration_seconds": 1639
  },
  {
    "title": "No-vax Djokovic",
    "published_date": "2022-01-18",
    "duration_seconds": 1511
  },
  {
    "title": "En landsfaders fald",
    "published_date": "2022-01-17",
    "duration_seconds": 1323
  },
  {
    "title": "En temmelig hemmelig tjeneste",
    "published_date": "2022-01-14",
    "duration_seconds": 1643
  },
  {
    "title": "Liraen er løs",
    "published_date": "2022-01-13",
    "duration_seconds": 1548
  },
  {
    "title": "Pandemiens punktum?",
    "published_date": "2022-01-12",
    "duration_seconds": 1339
  },
  {
    "title": "Knuget af klimasorg",
    "published_date": "2022-01-11",
    "duration_seconds": 1400
  },
  {
    "title": "Stone i stormen",
    "published_date": "2022-01-10",
    "duration_seconds": 1512
  },
  {
    "title": "Forsøgsbarnets forsvundne journal",
    "published_date": "2022-01-07",
    "duration_seconds": 1472
  },
  {
    "title": "Et sofistikeret rovdyr",
    "published_date": "2022-01-06",
    "duration_seconds": 1575
  },
  {
    "title": "Sindssygt farlig",
    "published_date": "2022-01-05",
    "duration_seconds": 1574
  },
  {
    "title": "Overgreb i eliten",
    "published_date": "2022-01-04",
    "duration_seconds": 1346
  },
  {
    "title": "Pias parti",
    "published_date": "2022-01-03",
    "duration_seconds": 1638
  },
  {
    "title": "Jesus i cellen",
    "published_date": "2021-12-24",
    "duration_seconds": 1529
  },
  {
    "title": "En stædig Støjberg",
    "published_date": "2021-12-17",
    "duration_seconds": 1510
  },
  {
    "title": "Kugleregn i København",
    "published_date": "2021-12-16",
    "duration_seconds": 1440
  },
  {
    "title": "Et offers oprejsning",
    "published_date": "2021-12-15",
    "duration_seconds": 1430
  },
  {
    "title": "Et 'undskyld' til Elena",
    "published_date": "2021-12-14",
    "duration_seconds": 1354
  },
  {
    "title": "Paprika og Tove",
    "published_date": "2021-12-13",
    "duration_seconds": 1413
  },
  {
    "title": "Det franske selvmord?",
    "published_date": "2021-12-10",
    "duration_seconds": 1442
  },
  {
    "title": "Lig i lasten",
    "published_date": "2021-12-09",
    "duration_seconds": 1475
  },
  {
    "title": "Dyrbys bekendelse",
    "published_date": "2021-12-08",
    "duration_seconds": 1635
  },
  {
    "title": "Et håbløst mayday",
    "published_date": "2021-12-07",
    "duration_seconds": 1476
  },
  {
    "title": "Den forsvundne smashbold",
    "published_date": "2021-12-06",
    "duration_seconds": 1384
  },
  {
    "title": "Fodboldfatwa",
    "published_date": "2021-12-03",
    "duration_seconds": 1513
  },
  {
    "title": "Barn af et eksperiment",
    "published_date": "2021-12-02",
    "duration_seconds": 1608
  },
  {
    "title": "Paloma alene på legeplads",
    "published_date": "2021-12-01",
    "duration_seconds": 1364
  },
  {
    "title": "Et stik med nazinålen",
    "published_date": "2021-11-30",
    "duration_seconds": 1516
  },
  {
    "title": "Semi-automatisk selvforsvar",
    "published_date": "2021-11-29",
    "duration_seconds": 1470
  },
  {
    "title": "Et kor af stemmer",
    "published_date": "2021-11-26",
    "duration_seconds": 1862
  },
  {
    "title": "Ditlevs kulørte klæder",
    "published_date": "2021-11-25",
    "duration_seconds": 1447
  },
  {
    "title": "Barbara ud af busken",
    "published_date": "2021-11-24",
    "duration_seconds": 1431
  },
  {
    "title": "\"Knep, forfrem, fyr\"",
    "published_date": "2021-11-23",
    "duration_seconds": 1364
  },
  {
    "title": "Thug life",
    "published_date": "2021-11-22",
    "duration_seconds": 1465
  },
  {
    "title": "Le ude med riven",
    "published_date": "2021-11-19",
    "duration_seconds": 1602
  },
  {
    "title": "Travis' tragedie",
    "published_date": "2021-11-18",
    "duration_seconds": 1475
  },
  {
    "title": "Et råddent kinderæg?",
    "published_date": "2021-11-17",
    "duration_seconds": 1561
  },
  {
    "title": "Et kommunalt fupnummer?",
    "published_date": "2021-11-16",
    "duration_seconds": 1537
  },
  {
    "title": "Bondeknoldens hævn?",
    "published_date": "2021-11-15",
    "duration_seconds": 1447
  },
  {
    "title": "Overmark mod overmagten",
    "published_date": "2021-11-12",
    "duration_seconds": 1594
  },
  {
    "title": "Den grønne kronjuvel",
    "published_date": "2021-11-11",
    "duration_seconds": 1364
  },
  {
    "title": "Mordet på Fredy",
    "published_date": "2021-11-10",
    "duration_seconds": 1476
  },
  {
    "title": "Guds egen stikker?",
    "published_date": "2021-11-09",
    "duration_seconds": 1611
  },
  {
    "title": "FLOP26?",
    "published_date": "2021-11-08",
    "duration_seconds": 1471
  },
  {
    "title": "Sol over DF",
    "published_date": "2021-11-05",
    "duration_seconds": 1330
  },
  {
    "title": "Jacobs sms-jagt",
    "published_date": "2021-11-04",
    "duration_seconds": 1471
  },
  {
    "title": "Likvidering af en hitmager",
    "published_date": "2021-11-03",
    "duration_seconds": 1417
  },
  {
    "title": "Ingen sved på prinsens pande",
    "published_date": "2021-11-02",
    "duration_seconds": 1525
  },
  {
    "title": "Kokain-kongens kollaps",
    "published_date": "2021-11-01",
    "duration_seconds": 1327
  },
  {
    "title": "Mor mod marmor",
    "published_date": "2021-10-29",
    "duration_seconds": 1341
  },
  {
    "title": "Minke-smiley",
    "published_date": "2021-10-28",
    "duration_seconds": 1463
  },
  {
    "title": "Afrikas Che Guevara",
    "published_date": "2021-10-27",
    "duration_seconds": 1518
  },
  {
    "title": "En enøjet kvinde får fred",
    "published_date": "2021-10-26",
    "duration_seconds": 1525
  },
  {
    "title": "Oliebold",
    "published_date": "2021-10-25",
    "duration_seconds": 1467
  },
  {
    "title": "Sandies sorg",
    "published_date": "2021-10-18",
    "duration_seconds": 1699
  },
  {
    "title": "En sugardaters advarsel",
    "published_date": "2021-10-15",
    "duration_seconds": 1498
  },
  {
    "title": "Moderland uden mor",
    "published_date": "2021-10-14",
    "duration_seconds": 1584
  },
  {
    "title": "Operation Goldfinger",
    "published_date": "2021-10-13",
    "duration_seconds": 1418
  },
  {
    "title": "Ven med en whistleblower",
    "published_date": "2021-10-12",
    "duration_seconds": 1468
  },
  {
    "title": "Ingen syndsforladelse",
    "published_date": "2021-10-11",
    "duration_seconds": 1453
  },
  {
    "title": "Victim blaming af en statsminister?",
    "published_date": "2021-10-08",
    "duration_seconds": 1439
  },
  {
    "title": "På CIA's sorte liste",
    "published_date": "2021-10-07",
    "duration_seconds": 1561
  },
  {
    "title": "Kettys mistanke",
    "published_date": "2021-10-06",
    "duration_seconds": 1493
  },
  {
    "title": "Drømmen om døde dyr",
    "published_date": "2021-10-05",
    "duration_seconds": 1245
  },
  {
    "title": "Politisk pigtråd",
    "published_date": "2021-10-04",
    "duration_seconds": 1546
  },
  {
    "title": "Brændstof til eftertanke",
    "published_date": "2021-10-01",
    "duration_seconds": 1497
  },
  {
    "title": "I kø til krisehjælp",
    "published_date": "2021-09-30",
    "duration_seconds": 1468
  },
  {
    "title": "Til våbenmesse med en arabisk prins",
    "published_date": "2021-09-29",
    "duration_seconds": 1407
  },
  {
    "title": "Mads Mikkelsens millioner",
    "published_date": "2021-09-28",
    "duration_seconds": 1619
  },
  {
    "title": "Simone svæver i luften",
    "published_date": "2021-09-27",
    "duration_seconds": 1316
  },
  {
    "title": "Fine franske følelser",
    "published_date": "2021-09-24",
    "duration_seconds": 1416
  },
  {
    "title": "Putins kok",
    "published_date": "2021-09-23",
    "duration_seconds": 1621
  },
  {
    "title": "Hotel Hollywood",
    "published_date": "2021-09-22",
    "duration_seconds": 1535
  },
  {
    "title": "Elendig alliance",
    "published_date": "2021-09-21",
    "duration_seconds": 1555
  },
  {
    "title": "Retur til tæsk?",
    "published_date": "2021-09-20",
    "duration_seconds": 1466
  },
  {
    "title": "\"Pas dit barn!\"",
    "published_date": "2021-09-17",
    "duration_seconds": 1347
  },
  {
    "title": "Business, blod og bluff",
    "published_date": "2021-09-16",
    "duration_seconds": 1488
  },
  {
    "title": "Livsfarligt fællesskab",
    "published_date": "2021-09-15",
    "duration_seconds": 1415
  },
  {
    "title": "Den sidste angrebsmand",
    "published_date": "2021-09-14",
    "duration_seconds": 1526
  },
  {
    "title": "TikTokTyran?",
    "published_date": "2021-09-13",
    "duration_seconds": 1447
  },
  {
    "title": "Den sidste soldat",
    "published_date": "2021-09-10",
    "duration_seconds": 1368
  },
  {
    "title": "Suppe, steg og splittelse",
    "published_date": "2021-09-09",
    "duration_seconds": 1477
  },
  {
    "title": "Karnevalg",
    "published_date": "2021-09-08",
    "duration_seconds": 1379
  },
  {
    "title": "Løven fra Panjshir",
    "published_date": "2021-09-07",
    "duration_seconds": 1568
  },
  {
    "title": "Jorden er giftig",
    "published_date": "2021-09-06",
    "duration_seconds": 1405
  },
  {
    "title": "En filippiner i Padborg",
    "published_date": "2021-09-03",
    "duration_seconds": 1619
  },
  {
    "title": "Et ministerknips",
    "published_date": "2021-09-02",
    "duration_seconds": 1471
  },
  {
    "title": "I believe I can fly",
    "published_date": "2021-09-01",
    "duration_seconds": 1569
  },
  {
    "title": "En mægtig mullah vender hjem",
    "published_date": "2021-08-31",
    "duration_seconds": 1324
  },
  {
    "title": "Jagten på pornokongen",
    "published_date": "2021-08-30",
    "duration_seconds": 1359
  },
  {
    "title": "Til fest under Kabuls kollaps",
    "published_date": "2021-08-27",
    "duration_seconds": 1469
  },
  {
    "title": "169 piger",
    "published_date": "2021-08-26",
    "duration_seconds": 1596
  },
  {
    "title": "Huawei-prinsessens fald",
    "published_date": "2021-08-25",
    "duration_seconds": 1467
  },
  {
    "title": "Haitis forbandelse",
    "published_date": "2021-08-24",
    "duration_seconds": 1415
  },
  {
    "title": "Er Al Qaeda virkelig væk?",
    "published_date": "2021-08-23",
    "duration_seconds": 1377
  },
  {
    "title": "Exit Khader",
    "published_date": "2021-08-20",
    "duration_seconds": 1412
  },
  {
    "title": "Talibanistan",
    "published_date": "2021-08-19",
    "duration_seconds": 1508
  },
  {
    "title": "Morten er skyldig",
    "published_date": "2021-08-18",
    "duration_seconds": 1426
  },
  {
    "title": "Flyt familien",
    "published_date": "2021-08-17",
    "duration_seconds": 1416
  },
  {
    "title": "Passer pengene, Pernille?",
    "published_date": "2021-08-16",
    "duration_seconds": 1507
  },
  {
    "title": "Taliban kommer",
    "published_date": "2021-08-13",
    "duration_seconds": 1416
  },
  {
    "title": "Bidens iltapparat?",
    "published_date": "2021-08-12",
    "duration_seconds": 1432
  },
  {
    "title": "\"A nice guy\"",
    "published_date": "2021-08-11",
    "duration_seconds": 1377
  },
  {
    "title": "Kuppet af RoboCop?",
    "published_date": "2021-08-10",
    "duration_seconds": 1518
  },
  {
    "title": "Sommer, sol og syndflod",
    "published_date": "2021-08-09",
    "duration_seconds": 1312
  },
  {
    "title": "Reptilernes sammensværgelse",
    "published_date": "2021-08-02",
    "duration_seconds": 1536
  },
  {
    "title": "Mors hævn",
    "published_date": "2021-07-26",
    "duration_seconds": 1362
  },
  {
    "title": "\"Giv mig min maskinpistol!\"",
    "published_date": "2021-07-19",
    "duration_seconds": 1548
  },
  {
    "title": "Dommen over Qvortrup",
    "published_date": "2021-07-12",
    "duration_seconds": 1517
  },
  {
    "title": "Tvangsfjernet ved en fejl?",
    "published_date": "2021-07-05",
    "duration_seconds": 1495
  },
  {
    "title": "Kvinder mod Khader",
    "published_date": "2021-07-02",
    "duration_seconds": 1737
  },
  {
    "title": "Partiet ingen ville lege med",
    "published_date": "2021-07-01",
    "duration_seconds": 1344
  },
  {
    "title": "Antivirushelt",
    "published_date": "2021-06-30",
    "duration_seconds": 1543
  },
  {
    "title": "De glemte fra Godhavn",
    "published_date": "2021-06-29",
    "duration_seconds": 1580
  },
  {
    "title": "Regnbuebold",
    "published_date": "2021-06-28",
    "duration_seconds": 1478
  },
  {
    "title": "Pigekorets hemmelighed",
    "published_date": "2021-06-25",
    "duration_seconds": 1607
  },
  {
    "title": "Er glansen gået af Margrethe?",
    "published_date": "2021-06-24",
    "duration_seconds": 1406
  },
  {
    "title": "Oprør i hvid kittel",
    "published_date": "2021-06-23",
    "duration_seconds": 1589
  },
  {
    "title": "Manden med de mange liv",
    "published_date": "2021-06-22",
    "duration_seconds": 1521
  },
  {
    "title": "Danmarks farligste fange",
    "published_date": "2021-06-21",
    "duration_seconds": 1384
  },
  {
    "title": "Tre millioner til vagtlægen",
    "published_date": "2021-06-18",
    "duration_seconds": 1417
  },
  {
    "title": "Femten meter fra Eriksen",
    "published_date": "2021-06-17",
    "duration_seconds": 1620
  },
  {
    "title": "Den Lysende Sti",
    "published_date": "2021-06-16",
    "duration_seconds": 1326
  },
  {
    "title": "Den trojanske app",
    "published_date": "2021-06-15",
    "duration_seconds": 1467
  },
  {
    "title": "En Lords magt?",
    "published_date": "2021-06-14",
    "duration_seconds": 1485
  },
  {
    "title": "\"Miraklet i Jerusalem\"",
    "published_date": "2021-06-11",
    "duration_seconds": 1487
  },
  {
    "title": "Radikale rystelser",
    "published_date": "2021-06-10",
    "duration_seconds": 1414
  },
  {
    "title": "Manden med de gyldne ører",
    "published_date": "2021-06-09",
    "duration_seconds": 1448
  },
  {
    "title": "Flertal mod forskere",
    "published_date": "2021-06-08",
    "duration_seconds": 1382
  },
  {
    "title": "\"At drive indianeren ud af barnet\"",
    "published_date": "2021-06-07",
    "duration_seconds": 1517
  },
  {
    "title": "TikTok-manden",
    "published_date": "2021-06-04",
    "duration_seconds": 1345
  },
  {
    "title": "Langeland siger nej",
    "published_date": "2021-06-03",
    "duration_seconds": 1464
  },
  {
    "title": "Parfumesælgerens død",
    "published_date": "2021-06-02",
    "duration_seconds": 1563
  },
  {
    "title": "Tæt på Mette",
    "published_date": "2021-06-01",
    "duration_seconds": 1411
  },
  {
    "title": "House of Kurz",
    "published_date": "2021-05-31",
    "duration_seconds": 1347
  },
  {
    "title": "Lukasjenkos luftrum",
    "published_date": "2021-05-28",
    "duration_seconds": 1287
  },
  {
    "title": "Joachim har det ikke let",
    "published_date": "2021-05-27",
    "duration_seconds": 1377
  },
  {
    "title": "Hvorfor skal mødrene hjem?",
    "published_date": "2021-05-26",
    "duration_seconds": 1402
  },
  {
    "title": "The DarkSide",
    "published_date": "2021-05-25",
    "duration_seconds": 1396
  },
  {
    "title": "Hvorfor besøger Blinken os?",
    "published_date": "2021-05-21",
    "duration_seconds": 1452
  },
  {
    "title": "En gnist i Jerusalem",
    "published_date": "2021-05-20",
    "duration_seconds": 1336
  },
  {
    "title": "Tog Fogh fejl?",
    "published_date": "2021-05-19",
    "duration_seconds": 1398
  },
  {
    "title": "Scener fra et tvangsægteskab",
    "published_date": "2021-05-18",
    "duration_seconds": 1451
  },
  {
    "title": "Stilladsgymnastik",
    "published_date": "2021-05-17",
    "duration_seconds": 1421
  },
  {
    "title": "Ros til Rwanda",
    "published_date": "2021-05-14",
    "duration_seconds": 1454
  },
  {
    "title": "Bill og Melinda skal skilles",
    "published_date": "2021-05-12",
    "duration_seconds": 1405
  },
  {
    "title": "Far på forsiden",
    "published_date": "2021-05-11",
    "duration_seconds": 1328
  },
  {
    "title": "Limfjordsforbandelsen",
    "published_date": "2021-05-10",
    "duration_seconds": 1369
  },
  {
    "title": "Dans med døden",
    "published_date": "2021-05-07",
    "duration_seconds": 1427
  },
  {
    "title": "Køb et møde med Mette",
    "published_date": "2021-05-06",
    "duration_seconds": 1353
  },
  {
    "title": "Modis mareridt",
    "published_date": "2021-05-05",
    "duration_seconds": 1385
  },
  {
    "title": "Caspar og krigen",
    "published_date": "2021-05-04",
    "duration_seconds": 1499
  },
  {
    "title": "\"Our son of a bitch\"",
    "published_date": "2021-05-03",
    "duration_seconds": 1411
  },
  {
    "title": "Blodrus på Borgen",
    "published_date": "2021-04-29",
    "duration_seconds": 1457
  },
  {
    "title": "General Najis sikre Syrien",
    "published_date": "2021-04-28",
    "duration_seconds": 1419
  },
  {
    "title": "Cuba uden Castro",
    "published_date": "2021-04-27",
    "duration_seconds": 1462
  },
  {
    "title": "Mortens svanesang?",
    "published_date": "2021-04-25",
    "duration_seconds": 1513
  },
  {
    "title": "The dirty dozen",
    "published_date": "2021-04-23",
    "duration_seconds": 1410
  },
  {
    "title": "Mordet på Malta",
    "published_date": "2021-04-22",
    "duration_seconds": 1406
  },
  {
    "title": "Det hemmelige Nemlig",
    "published_date": "2021-04-21",
    "duration_seconds": 1455
  },
  {
    "title": "Mørkenettets fyrste",
    "published_date": "2021-04-20",
    "duration_seconds": 1329
  },
  {
    "title": "Sidste stik",
    "published_date": "2021-04-19",
    "duration_seconds": 1453
  },
  {
    "title": "Knægter Khader det frie ord?",
    "published_date": "2021-04-16",
    "duration_seconds": 1355
  },
  {
    "title": "Skrotbunkens hemmelighed",
    "published_date": "2021-04-15",
    "duration_seconds": 1522
  },
  {
    "title": "Mor og morder?",
    "published_date": "2021-04-14",
    "duration_seconds": 1334
  },
  {
    "title": "Hvorfor vil Faeza ikke rejse?",
    "published_date": "2021-04-13",
    "duration_seconds": 1588
  },
  {
    "title": "Præsidentens fortabte søn",
    "published_date": "2021-04-12",
    "duration_seconds": 1424
  },
  {
    "title": "Sukkerkrigen på Lolland",
    "published_date": "2021-04-09",
    "duration_seconds": 1379
  },
  {
    "title": "Den standhaftige tolk",
    "published_date": "2021-04-08",
    "duration_seconds": 1367
  },
  {
    "title": "Blodrøde boldbaner",
    "published_date": "2021-04-07",
    "duration_seconds": 1325
  },
  {
    "title": "Fregat i farligt farvand",
    "published_date": "2021-04-06",
    "duration_seconds": 1436
  },
  {
    "title": "Kalifatets Løveunger",
    "published_date": "2021-03-26",
    "duration_seconds": 1393
  },
  {
    "title": "Merkels maskefald",
    "published_date": "2021-03-25",
    "duration_seconds": 1468
  },
  {
    "title": "Er Nanna martyr?",
    "published_date": "2021-03-24",
    "duration_seconds": 1323
  },
  {
    "title": "#textmewhenyougethome",
    "published_date": "2021-03-23",
    "duration_seconds": 1368
  },
  {
    "title": "Lærkeslette eller losseplads?",
    "published_date": "2021-03-22",
    "duration_seconds": 1460
  },
  {
    "title": "Kinas nye kejser",
    "published_date": "2021-03-19",
    "duration_seconds": 1323
  },
  {
    "title": "Bykongens bolig",
    "published_date": "2021-03-18",
    "duration_seconds": 1406
  },
  {
    "title": "Münchausen by internet",
    "published_date": "2021-03-17",
    "duration_seconds": 1415
  },
  {
    "title": "Alle veje fører til Mosul",
    "published_date": "2021-03-16",
    "duration_seconds": 1397
  },
  {
    "title": "FC Kaos",
    "published_date": "2021-03-15",
    "duration_seconds": 1581
  },
  {
    "title": "Megxit",
    "published_date": "2021-03-12",
    "duration_seconds": 1614
  },
  {
    "title": "Good cop/bad cop",
    "published_date": "2021-03-11",
    "duration_seconds": 1553
  },
  {
    "title": "Napoleon-komplekset",
    "published_date": "2021-03-10",
    "duration_seconds": 1374
  },
  {
    "title": "Søren på savannen",
    "published_date": "2021-03-09",
    "duration_seconds": 1506
  },
  {
    "title": "Også Grækenland",
    "published_date": "2021-03-08",
    "duration_seconds": 1325
  },
  {
    "title": "The Dark Prince",
    "published_date": "2021-03-05",
    "duration_seconds": 1522
  },
  {
    "title": "Ida-lisme",
    "published_date": "2021-03-04",
    "duration_seconds": 1343
  },
  {
    "title": "En lille fisk i Syrien",
    "published_date": "2021-03-03",
    "duration_seconds": 1408
  },
  {
    "title": "Urani naamik?",
    "published_date": "2021-03-02",
    "duration_seconds": 1419
  },
  {
    "title": "Zuckerberg slukker for nyhederne",
    "published_date": "2021-03-01",
    "duration_seconds": 1393
  },
  {
    "title": "To kugler gennem ruden",
    "published_date": "2021-02-26",
    "duration_seconds": 1486
  },
  {
    "title": "Lyden af Mars",
    "published_date": "2021-02-25",
    "duration_seconds": 1398
  },
  {
    "title": "Ursula vil stikke alle",
    "published_date": "2021-02-24",
    "duration_seconds": 1479
  },
  {
    "title": "Fusk i fundamentet",
    "published_date": "2021-02-23",
    "duration_seconds": 1449
  },
  {
    "title": "Befri Britney",
    "published_date": "2021-02-22",
    "duration_seconds": 1388
  },
  {
    "title": "Mettes højre hånd",
    "published_date": "2021-02-12",
    "duration_seconds": 1372
  },
  {
    "title": "Det skyldige offer",
    "published_date": "2021-02-11",
    "duration_seconds": 1415
  },
  {
    "title": "Iltmangel i Amazonas",
    "published_date": "2021-02-10",
    "duration_seconds": 1403
  },
  {
    "title": "Incest i eliten",
    "published_date": "2021-02-09",
    "duration_seconds": 1313
  },
  {
    "title": "Farefuld fødsel",
    "published_date": "2021-02-08",
    "duration_seconds": 1218
  },
  {
    "title": "Generalernes hævn",
    "published_date": "2021-02-05",
    "duration_seconds": 1403
  },
  {
    "title": "En giftig gasledning",
    "published_date": "2021-02-04",
    "duration_seconds": 1516
  },
  {
    "title": "Manden mod mafiaen",
    "published_date": "2021-02-03",
    "duration_seconds": 1250
  },
  {
    "title": "Knus Wall Street",
    "published_date": "2021-02-02",
    "duration_seconds": 1397
  },
  {
    "title": "Kampen om klitterne",
    "published_date": "2021-02-01",
    "duration_seconds": 1458
  },
  {
    "title": "Kasis crash eller comeback?",
    "published_date": "2021-01-29",
    "duration_seconds": 1549
  },
  {
    "title": "Poesi for præsidenten",
    "published_date": "2021-01-28",
    "duration_seconds": 1442
  },
  {
    "title": "Putins palads",
    "published_date": "2021-01-27",
    "duration_seconds": 1353
  },
  {
    "title": "Men in Black",
    "published_date": "2021-01-26",
    "duration_seconds": 1543
  },
  {
    "title": "Et gok i nødden",
    "published_date": "2021-01-25",
    "duration_seconds": 1782
  },
  {
    "title": "Jakobs blå øje",
    "published_date": "2021-01-22",
    "duration_seconds": 1558
  },
  {
    "title": "Bobi Wine er omringet",
    "published_date": "2021-01-21",
    "duration_seconds": 1327
  },
  {
    "title": "Menneskehandel i Thyborøn?",
    "published_date": "2021-01-20",
    "duration_seconds": 1432
  },
  {
    "title": "Barnet i hullet i skoven",
    "published_date": "2021-01-19",
    "duration_seconds": 1288
  },
  {
    "title": "Netanyahus dyrebare dråber",
    "published_date": "2021-01-18",
    "duration_seconds": 1139
  },
  {
    "title": "Bandeboss på hitlisten",
    "published_date": "2021-01-15",
    "duration_seconds": 1398
  },
  {
    "title": "Georgia on my mind",
    "published_date": "2021-01-14",
    "duration_seconds": 1377
  },
  {
    "title": "Crazy Jack",
    "published_date": "2021-01-13",
    "duration_seconds": 1296
  },
  {
    "title": "Maries børn i kalifatet",
    "published_date": "2021-01-12",
    "duration_seconds": 1484
  },
  {
    "title": "Cirkus Kongressen",
    "published_date": "2021-01-11",
    "duration_seconds": 1301
  },
  {
    "title": "Abort, Argentina",
    "published_date": "2021-01-08",
    "duration_seconds": 1216
  },
  {
    "title": "Jorden under Norge",
    "published_date": "2021-01-07",
    "duration_seconds": 1257
  },
  {
    "title": "Det vilde Venstre",
    "published_date": "2021-01-06",
    "duration_seconds": 1203
  },
  {
    "title": "Nej tak til nålen",
    "published_date": "2021-01-05",
    "duration_seconds": 1468
  },
  {
    "title": "Profetens mange ansigter",
    "published_date": "2021-01-04",
    "duration_seconds": 1196
  },
  {
    "title": "De stjålne børn",
    "published_date": "2020-11-18",
    "duration_seconds": 1627
  }
]
$genstart_history_20261014$::jsonb)
    AS a(title text, published_date date, duration_seconds integer)
),
validated AS (
  SELECT a.*
  FROM archive a
  WHERE a.title IS NOT NULL AND btrim(a.title) <> ''
    AND a.duration_seconds > 0
    AND a.published_date >= DATE '2020-11-18'
    AND a.published_date < DATE '2023-07-28'
),
inserted AS (
  INSERT INTO public.podcast_episodes
    (podcast_key, source, external_guid, external_episode_id, title,
     description, published_at, duration_seconds, episode_url, audio_url,
     image_url, is_active, metadata)
  SELECT
    'genstart',
    'onair_genstart_archive',
    'onair-genstart:' || a.published_date::text || ':' || md5(lower(btrim(a.title))),
    NULL,
    a.title,
    NULL,
    (a.published_date::timestamp + interval '12 hours') AT TIME ZONE 'Europe/Copenhagen',
    a.duration_seconds,
    NULL, NULL, NULL, TRUE,
    jsonb_build_object(
      'archive_backfill', TRUE,
      'archive_source_url', 'https://onair.dk/podcast/genstart',
      'archive_snapshot_date', '2026-10-14',
      'published_date_precision', 'day',
      'published_time_inferred', TRUE,
      'rateable', TRUE
    )
  FROM validated a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.podcast_episodes p
    WHERE p.podcast_key = 'genstart'
      AND lower(btrim(p.title)) = lower(btrim(a.title))
      AND p.published_at >= (a.published_date::timestamp - interval '7 days') AT TIME ZONE 'Europe/Copenhagen'
      AND p.published_at < (a.published_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Copenhagen'
  )
  ON CONFLICT (source, external_guid) DO NOTHING
  RETURNING id, title, published_at
)
SELECT count(*) AS inserted_count,
       count(*) FILTER (WHERE title = 'Jakobs blå øje') AS inserted_target_count,
       min(published_at) AS oldest_inserted,
       max(published_at) AS newest_inserted
FROM inserted;
