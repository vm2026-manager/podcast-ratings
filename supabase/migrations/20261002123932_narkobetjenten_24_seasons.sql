-- Extend the existing private membership map used by the reviewed aggregate RPC.
-- Preserve all rating rows, catalogue identities, policies and public stats.
begin;
insert into private.display_group_rating_members (display_group_id, podcast_key) values
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 1'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 2'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 3'),
  ('narkobetjenten', 'narkobetjenten og den kriminelle underverden sæson 6'),
  ('narkobetjenten', 'narkobetjenten sæson 7'),
  ('narkobetjenten', 'narkobetjenten sæson 9'),
  ('narkobetjenten', 'narkobetjenten sæson 10'),
  ('narkobetjenten', 'narkobetjenten sæson 11'),
  ('narkobetjenten', 'narkobetjenten sæson 12'),
  ('narkobetjenten', 'narkobetjenten sæson 13'),
  ('narkobetjenten', 'narkobetjenten sæson 14'),
  ('narkobetjenten', 'narkobetjenten sæson 15'),
  ('narkobetjenten', 'display-season:narkobetjenten:4'),
  ('narkobetjenten', 'display-season:narkobetjenten:5'),
  ('narkobetjenten', 'display-season:narkobetjenten:8'),
  ('narkobetjenten', 'display-season:narkobetjenten:16'),
  ('narkobetjenten', 'display-season:narkobetjenten:17'),
  ('narkobetjenten', 'display-season:narkobetjenten:18'),
  ('narkobetjenten', 'display-season:narkobetjenten:19'),
  ('narkobetjenten', 'display-season:narkobetjenten:20'),
  ('narkobetjenten', 'display-season:narkobetjenten:21'),
  ('narkobetjenten', 'display-season:narkobetjenten:22'),
  ('narkobetjenten', 'display-season:narkobetjenten:23'),
  ('narkobetjenten', 'display-season:narkobetjenten:24')
on conflict (display_group_id, podcast_key) do nothing;
commit;
