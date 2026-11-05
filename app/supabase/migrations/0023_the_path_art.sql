-- 0023: New artwork for The Path (Monday night), Nov 2026.
-- Meetings still on the earlier "three levels" image switch to the new poster.
-- (That image stays on the Fishing page.) A leader's own upload is left alone.
update meetings set art_path = 'static/the-path.webp'
 where art_path = 'static/the-path-three-levels.webp';
