-- 0022: The Fellowship's meeting artwork, shipped with the site (Nov 2026).
-- art_path may also name an image in the site's /meeting-art folder
-- ("static/<name>.webp"). Meetings get theirs by name; a leader's own upload
-- is never replaced, and leaders can still replace or remove any image.

alter table meetings drop constraint if exists meetings_art_path_check;
alter table meetings add constraint meetings_art_path_check check (
  art_path is null
  or art_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
  or art_path ~ '^static/[a-z0-9-]{1,60}\.webp$');

update meetings set art_path = v.path
  from (values
    ('static/campfire-3-share.webp',      array['%campfire%']),
    ('static/the-path.webp',              array['the path', '%reloaded%']),
    ('static/topic-tuesday-theater.webp', array['%topic tuesday%']),
    ('static/detox-group-room-1.webp',    array['%detox group 1%', '%battle plan%']),
    ('static/detox-group-room-2.webp',    array['%detox group meeting 2%', '%detox group 2%', '%thursday night conquerors%']),
    ('static/space-capsule.webp',         array['%space capsule%']),
    ('static/healing-room.webp',          array['%healing room%'])
  ) as v(path, pats)
 where meetings.art_path is null and meetings.name ilike any (v.pats);

select name, art_path from meetings order by local_day, local_time;
