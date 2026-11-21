"""Generate the Supabase import for the official menu workbook.

Usage (Python 3.10+, standard library only):
    python -I scripts/menu-import/generate_menu_import.py Menu_Portal_Classification.xlsx

Writes, next to each other in supabase/imports/:
    menu_portal_classification.dry_run.sql  – runs the whole import, reports, then rolls back
    menu_portal_classification.apply.sql    – the same import, committed

Both are generated from the same data and differ only in the final call. Run the dry
run first in the Supabase SQL editor; it changes nothing. The import is idempotent:
re-running it updates the workbook fields of existing dishes and never duplicates them.

What is imported, per data row (all 8 workbook columns):
    Category        -> categories.name (matched case/space-insensitively, else created)
    Dish Name       -> dishes.name
    Base Ingredient -> dishes.base_ingredients
    Taste Profile   -> dishes.taste_profile
    Texture         -> dishes.texture
    Cooking Method  -> dishes.cooking_method
    Cuisine Type    -> cuisines.name (matched case/space-insensitively, else created)
    Region / Origin -> dishes.region_origin
    sheet name      -> dishes.dietary_labels ('Veg Menu' = vegetarian, 'Non-Veg Menu' = non_vegetarian)
price stays NULL; description, image, allergens are left empty; nothing else is invented.
"""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
HEADER = ['Category', 'Dish Name', 'Base Ingredient', 'Taste Profile', 'Texture', 'Cooking Method',
          'Cuisine Type', 'Region / Origin']
SHEETS = {'Veg Menu': 'vegetarian', 'Non-Veg Menu': 'non_vegetarian'}
# Same limits as the database CHECK constraints.
MAX_LEN = {'category': 80, 'name': 120, 'cuisine': 80, 'base_ingredients': 200, 'taste_profile': 200,
           'texture': 200, 'cooking_method': 200, 'region_origin': 200}
FIELDS = ['category', 'name', 'base_ingredients', 'taste_profile', 'texture', 'cooking_method', 'cuisine',
          'region_origin']


class ImportError_(Exception):
    pass


def col_index(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_workbook(path):
    """{sheet name: [(row number, [cell text or None, ...])]} using only the standard library."""
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(f'{{{NS["m"]}}}t')))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = {}
    for s in wb.find('m:sheets', NS):
        target = rels[s.get(f'{{{NS["r"]}}}id')].lstrip('/')
        target = target if target.startswith('xl/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(target)).iter(f'{{{NS["m"]}}}row'):
            cells = {}
            for c in row.findall('m:c', NS):
                kind, v = c.get('t'), c.find('m:v', NS)
                if kind == 's' and v is not None:
                    text = shared[int(v.text)]
                elif kind == 'inlineStr':
                    text = ''.join(x.text or '' for x in c.iter(f'{{{NS["m"]}}}t'))
                elif v is not None:
                    text = v.text
                else:
                    text = None
                cells[col_index(c.get('r'))] = text
            width = max(cells) + 1 if cells else 0
            rows.append((int(row.get('r')), [cells.get(i) for i in range(width)]))
        sheets[s.get('name')] = rows
    return sheets


def clean(value):
    return ' '.join(value.split()) if isinstance(value, str) else ''


def extract(sheets):
    if set(sheets) != set(SHEETS):
        raise ImportError_(f'Expected sheets {sorted(SHEETS)}, found {sorted(sheets)}')
    records, problems, whitespace_fixes = [], [], 0
    for sheet, label in SHEETS.items():
        rows = sheets[sheet]
        header_rows = [n for n, vals in rows if [clean(v) for v in vals[:8]] == HEADER]
        if len(header_rows) != 1:
            raise ImportError_(f'{sheet}: expected exactly one header row {HEADER}, found {header_rows}')
        section = None
        for n, vals in rows:
            if n <= header_rows[0]:
                continue
            if any(clean(v) for v in vals[8:]):
                problems.append(f'{sheet} row {n}: data beyond column H')
            vals = (vals + [None] * 8)[:8]
            filled = [i for i, v in enumerate(vals) if clean(v)]
            if not filled:
                continue
            if filled == [0]:
                section = clean(vals[0])  # merged section heading, e.g. "BEVERAGES - MOCKTAILS"
                continue
            if len(filled) != 8:
                problems.append(f'{sheet} row {n}: {8 - len(filled)} empty cell(s): {vals}')
                continue
            rec = dict(zip(FIELDS, (clean(v) for v in vals)))
            whitespace_fixes += sum(1 for v in vals if v != clean(v))
            if section is None or section.lower() != rec['category'].lower():
                problems.append(f'{sheet} row {n}: category "{rec["category"]}" is under heading "{section}"')
            for field, limit in MAX_LEN.items():
                if len(rec[field]) > limit:
                    problems.append(f'{sheet} row {n}: {field} longer than {limit} characters')
            if '$menu$' in json.dumps(rec, ensure_ascii=False):
                problems.append(f'{sheet} row {n}: contains the SQL quote marker $menu$')
            records.append({'sheet': sheet, 'row_no': n, 'label': label, **rec})
    seen = {}
    for r in records:
        key = (r['category'].lower(), r['name'].lower())
        if key in seen:
            problems.append(f'{r["sheet"]} row {r["row_no"]}: "{r["name"]}" repeats row {seen[key]} in the same category')
        seen[key] = r['row_no']
    if problems:
        raise ImportError_('Workbook problems:\n  ' + '\n  '.join(problems))
    return records, whitespace_fixes


SQL_TEMPLATE = r"""-- =============================================================================
-- Surinder Caterers – import of the official menu ({mode_title})
-- GENERATED by scripts/menu-import/generate_menu_import.py – do not edit by hand.
-- Source: {source_name} (sha256 {sha256})
-- Rows: {total} ({veg} from "Veg Menu", {nonveg} from "Non-Veg Menu")
--
-- Requires migration 20261124090000_menu_catalogue.sql. Run in the Supabase SQL editor.
-- {mode_note}
--
-- Behaviour (identical in both files):
--  * Categories and cuisines are matched by name ignoring case and extra spaces;
--    missing ones are created (active), after the existing ones in workbook order.
--  * A dish is identified by (category, name). New dishes are inserted with
--    price NULL, no description, no image, no allergens. Existing dishes get their
--    workbook fields refreshed (name spelling, cuisine, the five attribute columns,
--    veg/non-veg label); price, unit, tier, description, image, allergens,
--    availability and any other dietary labels are never touched.
--  * Dishes that are not in the workbook are left alone.
--  * Any validation failure aborts the whole run with nothing changed.
-- =============================================================================

-- Existing labels with the veg/non-veg classification replaced by the workbook's.
create or replace function pg_temp.menu_import_labels(current_labels text[], workbook_labels text[])
returns text[]
language sql
immutable
as $lbl$
  select array(select distinct l from unnest(current_labels || workbook_labels) l
                where l not in ('vegetarian', 'non_vegetarian') or l = any(workbook_labels)
                order by 1)
$lbl$;

create or replace function pg_temp.import_menu_portal(p_apply boolean)
returns table (report_section text, report_item text, report_value text)
language plpgsql
as $fn$
#variable_conflict use_column
declare
  src jsonb := $menu${data}$menu$::jsonb;
  c_total   constant integer := {total};
  c_veg     constant integer := {veg};
  c_nonveg  constant integer := {nonveg};
  lines     jsonb := '[]'::jsonb;
  n         integer;
  n2        integer;
  base_sort integer;
  rec       record;
begin
  -- 0. Prerequisites --------------------------------------------------------------------
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'dishes' and column_name = 'region_origin')
     or (select is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'dishes' and column_name = 'price') <> 'YES'
     or to_regclass('public.dishes_category_name_key') is null then
    raise exception 'Run migration 20261124090000_menu_catalogue.sql before this import.';
  end if;

  -- 1. Validate the embedded data again, inside the database --------------------------
  drop table if exists pg_temp.menu_import_rows;
  create temp table menu_import_rows as
  select x.*, (case x.sheet when 'Veg Menu' then 0 else 1 end) * 100000 + x.row_no as pos  -- workbook order
    from jsonb_to_recordset(src) as x(sheet text, row_no integer, label text, category text,
         name text, base_ingredients text, taste_profile text, texture text, cooking_method text,
         cuisine text, region_origin text);

  select count(*) into n from menu_import_rows;
  if n <> c_total then raise exception 'Expected % rows, found %', c_total, n; end if;
  select count(*) into n from menu_import_rows where label = 'vegetarian' and sheet = 'Veg Menu';
  select count(*) into n2 from menu_import_rows where label = 'non_vegetarian' and sheet = 'Non-Veg Menu';
  if n <> c_veg or n2 <> c_nonveg then
    raise exception 'Expected % vegetarian and % non-vegetarian rows, found % and %', c_veg, c_nonveg, n, n2;
  end if;
  select count(*) into n from menu_import_rows
   where coalesce(btrim(category), '') = '' or coalesce(btrim(name), '') = '' or coalesce(btrim(cuisine), '') = ''
      or coalesce(btrim(base_ingredients), '') = '' or coalesce(btrim(taste_profile), '') = ''
      or coalesce(btrim(texture), '') = '' or coalesce(btrim(cooking_method), '') = ''
      or coalesce(btrim(region_origin), '') = '';
  if n > 0 then raise exception '% rows have an empty field', n; end if;
  select count(*) into n from (select 1 from menu_import_rows
                                 group by lower(btrim(category)), lower(btrim(name)) having count(*) > 1) d;
  if n > 0 then raise exception '% dishes appear twice in the same category', n; end if;

  lines := lines || jsonb_build_array(
    jsonb_build_array('Workbook', 'Rows validated', c_total::text),
    jsonb_build_array('Workbook', 'Vegetarian (Veg Menu)', c_veg::text),
    jsonb_build_array('Workbook', 'Non-vegetarian (Non-Veg Menu)', c_nonveg::text));

  -- 2. Do the import inside a savepoint, so a dry run can undo it --------------------------
  begin
    -- Categories
    select coalesce(max(sort_order), 0) into base_sort from public.categories;
    for rec in
      select w.category, row_number() over (order by w.first_pos) as k
        from (select min(category) as category, min(pos) as first_pos
                from menu_import_rows group by lower(btrim(category))) w
       where not exists (select 1 from public.categories c where lower(btrim(c.name)) = lower(btrim(w.category)))
    loop
      insert into public.categories (name, sort_order) values (rec.category, base_sort + rec.k * 10);
      lines := lines || jsonb_build_array(jsonb_build_array('Categories', 'Created', rec.category));
    end loop;
    for rec in
      select distinct c.name, c.is_active from public.categories c
        join menu_import_rows m on lower(btrim(m.category)) = lower(btrim(c.name))
       where c.created_at < now()  -- existed before this transaction
       order by c.name
    loop
      lines := lines || jsonb_build_array(jsonb_build_array('Categories',
        case when rec.is_active then 'Matched existing' else 'Matched existing – HIDDEN from customers' end, rec.name));
    end loop;

    -- Cuisines
    select coalesce(max(sort_order), 0) into base_sort from public.cuisines;
    for rec in
      select w.cuisine, row_number() over (order by w.first_pos) as k
        from (select min(cuisine) as cuisine, min(pos) as first_pos
                from menu_import_rows group by lower(btrim(cuisine))) w
       where not exists (select 1 from public.cuisines c where lower(btrim(c.name)) = lower(btrim(w.cuisine)))
    loop
      insert into public.cuisines (name, sort_order) values (rec.cuisine, base_sort + rec.k * 10);
      lines := lines || jsonb_build_array(jsonb_build_array('Cuisines', 'Created', rec.cuisine));
    end loop;
    for rec in
      select distinct c.name, c.is_active from public.cuisines c
        join menu_import_rows m on lower(btrim(m.cuisine)) = lower(btrim(c.name))
       where c.created_at < now()
       order by c.name
    loop
      lines := lines || jsonb_build_array(jsonb_build_array('Cuisines',
        case when rec.is_active then 'Matched existing' else 'Matched existing – HIDDEN from customers' end, rec.name));
    end loop;

    -- Dishes
    with incoming as (
      select m.name, cat.id as category_id, cui.id as cuisine_id, array[m.label] as labels,
             m.base_ingredients, m.taste_profile, m.texture, m.cooking_method, m.region_origin
        from menu_import_rows m
        join public.categories cat on lower(btrim(cat.name)) = lower(btrim(m.category))
        join public.cuisines   cui on lower(btrim(cui.name)) = lower(btrim(m.cuisine))
    ), written as (
      insert into public.dishes as d (name, category_id, cuisine_id, price, dietary_labels,
                                      base_ingredients, taste_profile, texture, cooking_method, region_origin)
      select name, category_id, cuisine_id, null, labels,
             base_ingredients, taste_profile, texture, cooking_method, region_origin
        from incoming
      on conflict (category_id, lower(btrim(name))) do update set
        name             = excluded.name,
        cuisine_id       = excluded.cuisine_id,
        dietary_labels   = pg_temp.menu_import_labels(d.dietary_labels, excluded.dietary_labels),
        base_ingredients = excluded.base_ingredients,
        taste_profile    = excluded.taste_profile,
        texture          = excluded.texture,
        cooking_method   = excluded.cooking_method,
        region_origin    = excluded.region_origin
      where (d.name, d.cuisine_id, d.base_ingredients, d.taste_profile, d.texture, d.cooking_method, d.region_origin)
              is distinct from
            (excluded.name, excluded.cuisine_id, excluded.base_ingredients, excluded.taste_profile, excluded.texture,
             excluded.cooking_method, excluded.region_origin)
         or d.dietary_labels is distinct from pg_temp.menu_import_labels(d.dietary_labels, excluded.dietary_labels)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted), count(*) filter (where not inserted) into n, n2 from written;
    lines := lines || jsonb_build_array(
      jsonb_build_array('Dishes', 'Inserted', n::text),
      jsonb_build_array('Dishes', 'Updated (workbook fields changed)', n2::text),
      jsonb_build_array('Dishes', 'Already up to date', (c_total - n - n2)::text));

    -- 3. Verify the result -------------------------------------------------------------
    select count(*),
           count(*) filter (where d.dietary_labels @> array['vegetarian'] and not d.dietary_labels @> array['non_vegetarian']),
           count(*) filter (where d.dietary_labels @> array['non_vegetarian'] and not d.dietary_labels @> array['vegetarian'])
      into n, n2, base_sort
      from menu_import_rows m
      join public.categories cat on lower(btrim(cat.name)) = lower(btrim(m.category))
      join public.cuisines   cui on lower(btrim(cui.name)) = lower(btrim(m.cuisine))
      join public.dishes d on d.category_id = cat.id and lower(btrim(d.name)) = lower(btrim(m.name))
     where d.cuisine_id = cui.id and d.base_ingredients = m.base_ingredients and d.taste_profile = m.taste_profile
       and d.texture = m.texture and d.cooking_method = m.cooking_method and d.region_origin = m.region_origin
       and d.dietary_labels @> array[m.label];
    if n <> c_total or n2 <> c_veg or base_sort <> c_nonveg then
      raise exception 'Verification failed: % of % rows match (% veg, % non-veg)', n, c_total, n2, base_sort;
    end if;
    lines := lines || jsonb_build_array(jsonb_build_array('Verification', 'Workbook rows matching a dish exactly', n::text));

    select count(*) into n from public.dishes d
     where d.created_at >= now() and d.price is null and d.description is null and d.image_path is null
       and d.allergens = '{{}}';
    select count(*) into n2 from public.dishes d where d.created_at >= now();
    if n <> n2 then raise exception 'Verification failed: % new dishes have a price, description, image or allergens', n2 - n; end if;
    lines := lines || jsonb_build_array(jsonb_build_array('Verification', 'New dishes with NULL price and no description/image/allergens', n::text));

    select count(*) into n from public.dishes;
    lines := lines || jsonb_build_array(jsonb_build_array('Database', 'Dishes in table after import', n::text));
    select count(*) into n from public.dishes d where not exists (
      select 1 from menu_import_rows m join public.categories cat on lower(btrim(cat.name)) = lower(btrim(m.category))
       where d.category_id = cat.id and lower(btrim(d.name)) = lower(btrim(m.name)));
    lines := lines || jsonb_build_array(jsonb_build_array('Database', 'Other dishes (not in workbook, untouched)', n::text));

    if not p_apply then
      raise exception using errcode = 'P0001', message = 'menu_import_dry_run';
    end if;
  exception when others then
    if sqlerrm <> 'menu_import_dry_run' then raise; end if;
    lines := jsonb_build_array(jsonb_build_array('DRY RUN', 'Nothing was saved', 'Run the .apply.sql file to import'))
             || lines;
  end;

  if p_apply then
    lines := jsonb_build_array(jsonb_build_array('APPLIED', 'Import committed', c_total::text || ' rows')) || lines;
  end if;
  drop table if exists pg_temp.menu_import_rows;

  return query select e ->> 0, e ->> 1, e ->> 2 from jsonb_array_elements(lines) e;
end;
$fn$;

select * from pg_temp.import_menu_portal(p_apply => {apply});
"""


def render(records, source, apply):
    data = json.dumps(records, ensure_ascii=False, separators=(',', ':'))
    veg = sum(r['label'] == 'vegetarian' for r in records)
    return SQL_TEMPLATE.format(
        mode_title='APPLY' if apply else 'DRY RUN',
        mode_note=('Imports and commits. Run the .dry_run.sql file first.' if apply
                   else 'DRY RUN: performs the whole import, reports what it would do, then rolls it back.'),
        source_name=source.name,
        sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        total=len(records), veg=veg, nonveg=len(records) - veg,
        data=data, apply='true' if apply else 'false',
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('workbook', type=Path)
    ap.add_argument('--out-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'supabase' / 'imports')
    ap.add_argument('--expect-veg', type=int, default=337)
    ap.add_argument('--expect-nonveg', type=int, default=242)
    ap.add_argument('--json', type=Path, help='also write the parsed rows as JSON (for review/tests)')
    args = ap.parse_args()
    try:
        records, ws = extract(read_workbook(args.workbook))
    except ImportError_ as err:
        sys.exit(f'ERROR: {err}')
    veg = sum(r['label'] == 'vegetarian' for r in records)
    nonveg = len(records) - veg
    if (veg, nonveg) != (args.expect_veg, args.expect_nonveg):
        sys.exit(f'ERROR: expected {args.expect_veg} veg + {args.expect_nonveg} non-veg rows, found {veg} + {nonveg}')
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for apply in (False, True):
        out = args.out_dir / f'menu_portal_classification.{"apply" if apply else "dry_run"}.sql'
        out.write_text(render(records, args.workbook, apply), encoding='utf-8', newline='\n')
        print(f'wrote {out} ({out.stat().st_size:,} bytes)')
    if args.json:
        args.json.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding='utf-8')
    cats = {r['category'].lower() for r in records}
    cuis = {r['cuisine'].lower() for r in records}
    print(f'{len(records)} rows ({veg} veg, {nonveg} non-veg); {len(cats)} categories; {len(cuis)} cuisines; '
          f'{ws} cells had extra whitespace trimmed')


if __name__ == '__main__':
    main()
