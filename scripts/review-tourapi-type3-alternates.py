from __future__ import annotations

import hashlib
import io
import json
import pathlib
import time
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-fallback-audit.json'
REPORT_DIR = ROOT / 'reports' / 'family-tourapi-type3-review'
ORIGINAL_DIR = REPORT_DIR / 'alternates'
MANIFEST_PATH = REPORT_DIR / 'alternate-review-manifest.json'
TARGET_IDS = [
    'place-016', 'place-018', 'place-052', 'place-062', 'place-072',
    'place-076', 'place-081', 'place-101', 'place-133', 'place-149',
    'place-158', 'place-194', 'place-210', 'place-220', 'place-223',
    'place-243', 'place-257', 'place-263', 'place-264', 'place-272',
]


def font(size: int):
    for candidate in (pathlib.Path('C:/Windows/Fonts/malgun.ttf'), pathlib.Path('C:/Windows/Fonts/arial.ttf')):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def fetch(url: str) -> bytes:
    request_url = 'https://' + url.removeprefix('http://') if url.startswith('http://') else url
    request = urllib.request.Request(request_url, headers={'User-Agent': 'oneulwhere-family-type3-review/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    if not payload:
        raise ValueError('empty response')
    return payload


def extension(image_format: str | None) -> str:
    return {'JPEG': '.jpg', 'PNG': '.png', 'GIF': '.gif', 'WEBP': '.webp'}[image_format]


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding='utf-8'))
    by_id = {row['familyPlaceId']: row for row in audit['places']}
    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[dict] = []
    title_font = font(17)
    body_font = font(14)
    cell_width, cell_height = 300, 245

    for page, place_id in enumerate(TARGET_IDS, start=1):
        row = by_id[place_id]
        candidates = [item for item in row['imageCandidates'] if item.get('copyrightCode') == 'Type3'][:5]
        canvas = Image.new('RGB', (cell_width * 5, cell_height), '#f3f0e7')
        draw = ImageDraw.Draw(canvas)
        for index, candidate in enumerate(candidates, start=1):
            payload = fetch(candidate['imageUrl'])
            with Image.open(io.BytesIO(payload)) as source:
                image_format = source.format
                width, height = source.size
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((cell_width - 20, 175), Image.Resampling.LANCZOS)
            output = ORIGINAL_DIR / f'{place_id}-{index}{extension(image_format)}'
            output.write_bytes(payload)
            sha256 = hashlib.sha256(payload).hexdigest()
            image_x = (index - 1) * cell_width + (cell_width - image.width) // 2
            image_y = 8 + (175 - image.height) // 2
            canvas.paste(image, (image_x, image_y))
            x = (index - 1) * cell_width
            draw.text((x + 8, 188), f'{place_id} #{index}  {row["familyPlaceName"]}', fill='#17281d', font=title_font)
            draw.text((x + 8, 215), f'{candidate.get("imageName") or "이미지"} · {width}×{height}', fill='#425047', font=body_font)
            manifest_entries.append({
                'familyPlaceId': place_id,
                'familyPlaceName': row['familyPlaceName'],
                'candidateIndex': index,
                'imageName': candidate.get('imageName'),
                'sourceUrl': candidate['imageUrl'],
                'imageVariant': candidate.get('imageVariant'),
                'copyrightCode': candidate.get('copyrightCode'),
                'reviewPath': str(output.relative_to(ROOT)).replace('\\', '/'),
                'originalFormat': image_format,
                'originalWidth': width,
                'originalHeight': height,
                'originalAspectRatio': round(width / height, 4),
                'sha256': sha256,
            })
            time.sleep(0.05)
        sheet_path = REPORT_DIR / f'alternate-sheet-{page:02d}-{place_id}.jpg'
        canvas.save(sheet_path, format='JPEG', quality=92)
        print(f'alternates {page}/{len(TARGET_IDS)} {place_id}')

    MANIFEST_PATH.write_text(json.dumps({
        'scope': 'Ambiguous Type 3 alternate candidates for human representative-image review',
        'preparedAt': '2026-09-12',
        'targetPlaceCount': len(TARGET_IDS),
        'candidateCount': len(manifest_entries),
        'entries': manifest_entries,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
