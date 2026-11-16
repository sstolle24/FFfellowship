-- 0027: Bill W. movie notes in two parts (Nov 2026).
-- Key 3's movie is worked in two parts (minutes 1–59, then 59 to the end), so
-- the movie card has a notes box for each. Part 1 keeps the existing notes
-- column; Part 2 goes in notes_part2, saved by its own function so the
-- existing save_video (and an older copy of the site) is unchanged.
-- Same visibility as his other video notes (himself, his AP/sponsor, leaders).

alter table video_progress add column if not exists notes_part2 text;

create or replace function public.save_video_notes_part2(p_video uuid, p_notes text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k module_key;
begin
  if auth.uid() is null or not app.is_active() then perform app.fail('Your account must be approved first.'); end if;
  select pm.key into k from videos v join program_modules pm on pm.id = v.module_id where v.id = p_video;
  if k is null then perform app.fail('Video not found.'); end if;
  if k <> 'key_3_part_1' then perform app.fail('Part 2 notes are for the Key 3 movie.'); end if;
  if not app.video_unlocked(auth.uid(), p_video) then perform app.fail('Finish ' || app.prev_key_label(k) || ' first.'); end if;
  insert into video_progress as vp (man_id, video_id, notes_part2)
  values (auth.uid(), p_video, left(p_notes, 10000))
  on conflict (man_id, video_id) do update set notes_part2 = excluded.notes_part2;
  return jsonb_build_object('ok', true, 'events', '[]'::jsonb);
end $$;

revoke all on function public.save_video_notes_part2(uuid, text) from public, anon;
grant execute on function public.save_video_notes_part2(uuid, text) to authenticated;
