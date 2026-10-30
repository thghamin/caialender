-- 공지에 사진을 여러 장(최대 6장) 첨부. 기존 image_path(첫 장)는 그대로 두고 전체 목록을 image_paths에 둔다.
alter table public.notices add column image_paths text[] not null default '{}';
update public.notices set image_paths = array[image_path] where image_path is not null and image_paths = '{}';
