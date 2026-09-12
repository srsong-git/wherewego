from __future__ import annotations

import hashlib
import io
import json
import pathlib
import time
import urllib.error
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-fallback-audit.json'
REPORT_DIR = ROOT / 'reports' / 'family-tourapi-type3-review'
ORIGINAL_DIR = REPORT_DIR / 'originals'
MANIFEST_PATH = REPORT_DIR / 'review-manifest.json'
POC_IDS = {
    'place-015', 'place-019', 'place-047', 'place-068', 'place-217',
    'place-231', 'place-240', 'place-245', 'place-277', 'place-280',
}
MAX_ATTEMPTS = 3


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def fetch_bytes(url: str) -> tuple[bytes, str]:
    request_url = 'https://' + url.removeprefix('http://') if url.startswith('http://') else url
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(
                request_url,
                headers={
                    'User-Agent': 'oneulwhere-family-type3-review/1.0',
                    'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
                },
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read()
                if not payload:
                    raise ValueError('empty response')
                return payload, response.headers.get('Content-Type', '')
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(attempt * 0.8)
    raise RuntimeError(f'download failed after {MAX_ATTEMPTS} attempts: {last_error}')


def image_extension(image_format: str | None) -> str:
    extensions = {'JPEG': '.jpg', 'PNG': '.png', 'GIF': '.gif', 'WEBP': '.webp'}
    if image_format not in extensions:
        raise ValueError(f'unsupported original image format: {image_format}')
    return extensions[image_format]


def selected_candidate(row: dict) -> dict:
    return next(
        (candidate for candidate in row.get('imageCandidates', []) if candidate.get('imageUrl') == row.get('selectedImageUrl')),
        {},
    )


def font(size: int):
    candidates = [
        pathlib.Path('C:/Windows/Fonts/malgun.ttf'),
        pathlib.Path('C:/Windows/Fonts/arial.ttf'),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def create_contact_sheets(entries: list[dict]) -> list[str]:
    sheet_paths: list[str] = []
    cell_width, cell_height = 380, 285
    columns, rows_per_sheet = 4, 4
    title_font = font(18)
    body_font = font(15)
    for page, start in enumerate(range(0, len(entries), columns * rows_per_sheet), start=1):
        page_entries = entries[start:start + columns * rows_per_sheet]
        canvas = Image.new('RGB', (cell_width * columns, cell_height * rows_per_sheet), '#f3f0e7')
        draw = ImageDraw.Draw(canvas)
        for index, entry in enumerate(page_entries):
            column = index % columns
            row = index // columns
            x, y = column * cell_width, row * cell_height
            draw.rectangle((x + 4, y + 4, x + cell_width - 4, y + cell_height - 4), fill='#ffffff', outline='#ccd5cc', width=2)
            try:
                with Image.open(ROOT / entry['reviewPath']) as source:
                    image = ImageOps.exif_transpose(source).convert('RGB')
                    image.thumbnail((cell_width - 24, 205), Image.Resampling.LANCZOS)
                    image_x = x + (cell_width - image.width) // 2
                    image_y = y + 10 + (205 - image.height) // 2
                    canvas.paste(image, (image_x, image_y))
            except Exception:
                draw.text((x + 12, y + 90), 'IMAGE LOAD FAILED', fill='#aa2222', font=title_font)
            draw.text((x + 10, y + 220), f"{entry['familyPlaceId']}  {entry['familyPlaceName']}", fill='#17281d', font=title_font)
            draw.text(
                (x + 10, y + 247),
                f"{entry['region']} · {entry['imageName'] or '대표 이미지'} · {entry['originalWidth']}×{entry['originalHeight']} ({entry['originalAspectRatio']:.2f})",
                fill='#425047',
                font=body_font,
            )
        sheet_path = REPORT_DIR / f'contact-sheet-{page:02d}.jpg'
        canvas.save(sheet_path, format='JPEG', quality=92)
        sheet_paths.append(str(sheet_path.relative_to(ROOT)).replace('\\', '/'))
    return sheet_paths


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding='utf-8'))
    rows = [
        row for row in audit['places']
        if row.get('licenseType') == 'Type3' and row['familyPlaceId'] not in POC_IDS
    ]
    if len(rows) != 73:
        raise RuntimeError(f'expected 73 remaining Type 3 rows, found {len(rows)}')

    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    for index, row in enumerate(rows, start=1):
        candidate = selected_candidate(row)
        entry = {
            'familyPlaceId': row['familyPlaceId'],
            'familyPlaceName': row['familyPlaceName'],
            'region': row['region'],
            'area': row['area'],
            'tourApiContentId': row['contentId'],
            'tourApiTitle': row['tourApiTitle'],
            'tourApiCreatedAt': row.get('tourApiCreatedAt'),
            'tourApiModifiedAt': row.get('tourApiModifiedAt'),
            'sourceUrl': row['selectedImageUrl'],
            'imageVariant': row['selectedImageVariant'],
            'imageName': candidate.get('imageName'),
            'copyrightCode': candidate.get('copyrightCode'),
            'status': 'downloaded',
        }
        try:
            payload, content_type = fetch_bytes(row['selectedImageUrl'])
            with Image.open(io.BytesIO(payload)) as source:
                original_format = source.format
                original_width, original_height = source.size
            extension = image_extension(original_format)
            target = ORIGINAL_DIR / f"{row['familyPlaceId']}{extension}"
            target.write_bytes(payload)
            if sha256_bytes(target.read_bytes()) != sha256_bytes(payload):
                raise ValueError('stored review bytes differ from response bytes')
            entry.update({
                'reviewPath': str(target.relative_to(ROOT)).replace('\\', '/'),
                'originalFormat': original_format,
                'originalWidth': original_width,
                'originalHeight': original_height,
                'originalAspectRatio': round(original_width / original_height, 4),
                'sha256': sha256_bytes(payload),
                'fileSizeBytes': len(payload),
                'contentType': content_type,
            })
        except Exception as error:
            entry.update({'status': 'failed', 'reason': str(error)})
        entries.append(entry)
        print(f"review download {index}/{len(rows)} {row['familyPlaceId']} {entry['status']}")
        time.sleep(0.08)

    downloaded = [entry for entry in entries if entry['status'] == 'downloaded']
    sheet_paths = create_contact_sheets(downloaded)
    manifest = {
        'scope': 'Family TourAPI public-nuri Type 3 remaining 73 representative-image review',
        'preparedAt': '2026-09-12',
        'targetCount': len(rows),
        'downloadedCount': len(downloaded),
        'failedCount': len(rows) - len(downloaded),
        'contactSheets': sheet_paths,
        'entries': entries,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'targetCount': len(rows),
        'downloadedCount': len(downloaded),
        'failedCount': len(rows) - len(downloaded),
        'contactSheets': sheet_paths,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
