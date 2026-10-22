-- Add only the six season identities to the private display-group aggregate.
-- This migration does not write podcast, episode, or rating rows.
begin;
insert into private.display_group_rating_members (display_group_id, podcast_key) values
  ('kirsten-ringer-til-rasmus', 'kirsten ringer til rasmus sæson 4'),
  ('kirsten-ringer-til-rasmus', 'display-season:kirsten-ringer-til-rasmus:1'),
  ('kirsten-ringer-til-rasmus', 'display-season:kirsten-ringer-til-rasmus:2'),
  ('kirsten-ringer-til-rasmus', 'display-season:kirsten-ringer-til-rasmus:3'),
  ('kirsten-ringer-til-rasmus', 'display-season:kirsten-ringer-til-rasmus:5'),
  ('kirsten-ringer-til-rasmus', 'display-season:kirsten-ringer-til-rasmus:6')
on conflict (display_group_id, podcast_key) do nothing;
commit;
