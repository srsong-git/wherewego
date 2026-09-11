from __future__ import annotations

import concurrent.futures
import hashlib
import io
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

from PIL import Image, ImageOps


ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-fallback-audit.json'
OUTPUT_DIR = ROOT / 'public' / 'place-images'
ORIGINAL_DIR = OUTPUT_DIR / 'original'
TYPE1_METADATA_PATH = ROOT / 'src' / 'data' / 'family-tourapi-human-approved-images.generated.js'
TYPE3_METADATA_PATH = ROOT / 'src' / 'data' / 'family-tourapi-type3-poc-images.generated.js'
APPLICATION_AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-human-review-type3-poc-application.json'

TYPE1_IDS = [
    'place-074', 'place-077', 'place-093', 'place-098', 'place-120',
    'place-161', 'place-175', 'place-180', 'place-206', 'place-215',
    'place-237', 'place-244', 'place-249', 'place-269', 'place-288',
]

TYPE3_IDS = [
    'place-015', 'place-019', 'place-047', 'place-068', 'place-217',
    'place-231', 'place-240', 'place-245', 'place-277', 'place-280',
]

TARGET_RATIO = 8 / 5
MAX_WIDTH = 1200
MAX_WORKERS = 3
MAX_ATTEMPTS = 3


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def existing_hashes() -> dict[str, str]:
    return {
        str(path.relative_to(ROOT)): sha256_file(path)
        for path in sorted(OUTPUT_DIR.rglob('*'))
        if path.is_file()
    }


def fetch_bytes(url: str) -> tuple[bytes, str]:
    request_url = 'https://' + url.removeprefix('http://') if url.startswith('http://') else url
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(
                request_url,
                headers={
                    'User-Agent': 'oneulwhere-family-image-poc/1.0',
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
                time.sleep(attempt * 0.7)
    raise RuntimeError(f'download failed after {MAX_ATTEMPTS} attempts: {last_error}')


def selected_candidate(row: dict) -> dict:
    return next(
        (candidate for candidate in row.get('imageCandidates', []) if candidate.get('imageUrl') == row.get('selectedImageUrl')),
        {},
    )


def transform_type1(payload: bytes, output_path: pathlib.Path) -> dict:
    with Image.open(io.BytesIO(payload)) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode not in {'RGB', 'RGBA'}:
            image = image.convert('RGB')
        source_width, source_height = image.size
        source_ratio = source_width / source_height
        if source_ratio > TARGET_RATIO:
            crop_width = max(1, round(source_height * TARGET_RATIO))
            left = (source_width - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, source_height))
        else:
            crop_height = max(1, round(source_width / TARGET_RATIO))
            top = (source_height - crop_height) // 2
            image = image.crop((0, top, source_width, top + crop_height))

        output_width = min(MAX_WIDTH, image.width)
        output_height = min(round(output_width / TARGET_RATIO), image.height)
        output_width = min(output_width, round(output_height * TARGET_RATIO))
        if output_width < image.width or output_height < image.height:
            image = image.resize((output_width, output_height), Image.Resampling.LANCZOS)

        temp_path = output_path.with_suffix('.webp.tmp')
        image.save(temp_path, format='WEBP', quality=85, method=6)
        os.replace(temp_path, output_path)

    return {
        'sourceWidth': source_width,
        'sourceHeight': source_height,
        'outputWidth': output_width,
        'outputHeight': output_height,
        'upscaled': False,
        'transformation': 'center-cropped to 8:5, resized without upscaling, converted to WebP',
    }


def image_extension(image_format: str | None) -> str:
    extensions = {'JPEG': '.jpg', 'PNG': '.png', 'GIF': '.gif', 'WEBP': '.webp'}
    if image_format not in extensions:
        raise ValueError(f'unsupported original image format: {image_format}')
    return extensions[image_format]


def apply_type1(row: dict) -> dict:
    place_id = row['familyPlaceId']
    output_path = OUTPUT_DIR / f'{place_id}.webp'
    candidate = selected_candidate(row)
    try:
        payload, content_type = fetch_bytes(row['selectedImageUrl'])
        dimensions = transform_type1(payload, output_path)
        return {
            'familyPlaceId': place_id,
            'familyPlaceName': row['familyPlaceName'],
            'region': row['region'],
            'licenseType': 'Type1',
            'status': 'applied',
            'sourceName': '한국관광공사 TourAPI',
            'tourApiContentId': row['contentId'],
            'tourApiTitle': row['tourApiTitle'],
            'sourceUrl': row['selectedImageUrl'],
            'contentType': content_type,
            'licenseOrUsageBasis': '공공누리 제1유형: 상업적 이용, 복제·재배포 및 수정 허용(출처표시)',
            'licenseUrl': 'https://www.kogl.or.kr/info/licenseType1.do',
            'attributionText': '한국관광공사 TourAPI / 공공누리 제1유형 / center-cropped, resized without upscaling, and converted to WebP',
            'verifiedAt': '2026-09-12',
            'imageVariant': row['selectedImageVariant'],
            'imageName': candidate.get('imageName'),
            'representativeReason': '사람 검토에서 장소의 시설·전시·경관 특성을 적절히 보여주는 대표 이미지로 승인했습니다.',
            'localPath': f'public/place-images/{place_id}.webp',
            'sha256': sha256_file(output_path),
            'fileSizeBytes': output_path.stat().st_size,
            **dimensions,
        }
    except Exception as error:
        output_path.with_suffix('.webp.tmp').unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        return {'familyPlaceId': place_id, 'familyPlaceName': row['familyPlaceName'], 'region': row['region'], 'licenseType': 'Type1', 'status': 'failed', 'reason': str(error)}


def apply_type3(row: dict) -> dict:
    place_id = row['familyPlaceId']
    candidate = selected_candidate(row)
    output_path: pathlib.Path | None = None
    try:
        payload, content_type = fetch_bytes(row['selectedImageUrl'])
        with Image.open(io.BytesIO(payload)) as source:
            original_format = source.format
            original_width, original_height = source.size
        extension = image_extension(original_format)
        output_path = ORIGINAL_DIR / f'{place_id}{extension}'
        temp_path = output_path.with_suffix(output_path.suffix + '.tmp')
        temp_path.write_bytes(payload)
        os.replace(temp_path, output_path)
        if sha256_file(output_path) != sha256_bytes(payload):
            raise ValueError('stored original bytes differ from downloaded bytes')

        published_year = (row.get('tourApiCreatedAt') or '')[:4] or None
        return {
            'familyPlaceId': place_id,
            'familyPlaceName': row['familyPlaceName'],
            'region': row['region'],
            'licenseType': 'Type3',
            'status': 'applied',
            'sourceName': '한국관광공사 TourAPI',
            'tourApiContentId': row['contentId'],
            'tourApiTitle': row['tourApiTitle'],
            'sourceUrl': row['selectedImageUrl'],
            'sourcePolicyUrl': 'https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto',
            'licenseOrUsageBasis': '공공누리 제3유형: 상업적 이용과 원본 공유 가능, 변경 및 2차적 저작물 작성 금지(출처표시)',
            'licenseUrl': 'https://www.kogl.or.kr/info/licenseType3.do',
            'attributionText': f"한국관광공사 TourAPI {published_year or '작성연도 미제공'}년 콘텐츠 '{row['tourApiTitle']}' / 공공누리 제3유형 / 변경 없이 사용",
            'verifiedAt': '2026-09-12',
            'imageVariant': row['selectedImageVariant'],
            'imageName': candidate.get('imageName'),
            'representativeReason': '사람 검토에서 장소의 대표 시설·경관이 명확하고 contain 방식의 카드 표시에 적합하다고 판단했습니다.',
            'localPath': str(output_path.relative_to(ROOT)).replace('\\', '/'),
            'publicSrc': '/' + str(output_path.relative_to(ROOT / 'public')).replace('\\', '/'),
            'originalFormat': original_format,
            'originalWidth': original_width,
            'originalHeight': original_height,
            'originalAspectRatio': round(original_width / original_height, 4),
            'originalBytesPreserved': True,
            'transformation': 'none',
            'publishedYear': published_year,
            'publishedYearBasis': 'TourAPI 콘텐츠 등록연도이며 이미지 촬영일로 추정하지 않음',
            'imageCapturedAt': None,
            'sha256': sha256_file(output_path),
            'downloadedSha256': sha256_bytes(payload),
            'fileSizeBytes': output_path.stat().st_size,
            'contentType': content_type,
        }
    except Exception as error:
        if output_path:
            output_path.with_suffix(output_path.suffix + '.tmp').unlink(missing_ok=True)
            output_path.unlink(missing_ok=True)
        return {'familyPlaceId': place_id, 'familyPlaceName': row['familyPlaceName'], 'region': row['region'], 'licenseType': 'Type3', 'status': 'failed', 'reason': str(error)}


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_type1_metadata(entries: list[dict]) -> None:
    lines = [
        '// Generated from the user-approved TourAPI Type 1 human review list.',
        'export const tourApiHumanApprovedImageMetadataById = Object.freeze({',
    ]
    for entry in sorted(entries, key=lambda item: item['familyPlaceId']):
        alt = f"{entry['familyPlaceName']} {entry.get('imageName') or '대표 이미지'}"
        lines.extend([
            f"  {js(entry['familyPlaceId'])}: Object.freeze({{",
            f"    alt: {js(alt)},",
            f"    sourceUrl: {js(entry['sourceUrl'])},",
            f"    tourApiContentId: {js(entry['tourApiContentId'])},",
            f"    imageVariant: {js(entry['imageVariant'])},",
            f"    representativeReason: {js(entry['representativeReason'])},",
            f"    verifiedAt: {js(entry['verifiedAt'])},",
            '  }),',
        ])
    lines.extend(['})', ''])
    TYPE1_METADATA_PATH.write_text('\n'.join(lines), encoding='utf-8')


def write_type3_metadata(entries: list[dict]) -> None:
    lines = [
        '// Generated from the TourAPI public-nuri Type 3 unchanged-original PoC.',
        'export const tourApiType3PocImageMetadataById = Object.freeze({',
    ]
    for entry in sorted(entries, key=lambda item: item['familyPlaceId']):
        alt = f"{entry['familyPlaceName']} {entry.get('imageName') or '대표 이미지'}"
        lines.extend([
            f"  {js(entry['familyPlaceId'])}: Object.freeze({{",
            f"    src: {js(entry['publicSrc'])},",
            f"    alt: {js(alt)},",
            f"    sourceUrl: {js(entry['sourceUrl'])},",
            f"    sourcePolicyUrl: {js(entry['sourcePolicyUrl'])},",
            f"    tourApiContentId: {js(entry['tourApiContentId'])},",
            f"    tourApiTitle: {js(entry['tourApiTitle'])},",
            f"    imageVariant: {js(entry['imageVariant'])},",
            f"    representativeReason: {js(entry['representativeReason'])},",
            f"    verifiedAt: {js(entry['verifiedAt'])},",
            f"    attributionText: {js(entry['attributionText'])},",
            f"    publishedYear: {js(entry['publishedYear'])},",
            f"    originalWidth: {entry['originalWidth']},",
            f"    originalHeight: {entry['originalHeight']},",
            f"    originalAspectRatio: {entry['originalAspectRatio']},",
            f"    originalFormat: {js(entry['originalFormat'])},",
            f"    sha256: {js(entry['sha256'])},",
            '  }),',
        ])
    lines.extend(['})', ''])
    TYPE3_METADATA_PATH.write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding='utf-8'))
    by_id = {row['familyPlaceId']: row for row in audit['places']}
    type1_rows = [by_id[place_id] for place_id in TYPE1_IDS]
    type3_rows = [by_id[place_id] for place_id in TYPE3_IDS]

    if any(row.get('decision') != 'review' or row.get('licenseType') != 'Type1' for row in type1_rows):
        raise RuntimeError('Type 1 human-review selection violates source audit')
    if any(row.get('decision') != 'review' or row.get('licenseType') != 'Type3' for row in type3_rows):
        raise RuntimeError('Type 3 PoC selection violates source audit')

    before_hashes = existing_hashes()
    collisions = []
    for row in type1_rows:
        if str((OUTPUT_DIR / f"{row['familyPlaceId']}.webp").relative_to(ROOT)) in before_hashes:
            collisions.append(row['familyPlaceId'])
    for row in type3_rows:
        if any(pathlib.Path(path).stem == row['familyPlaceId'] for path in before_hashes):
            collisions.append(row['familyPlaceId'])
    if collisions:
        raise RuntimeError(f'refusing to overwrite existing images: {collisions}')

    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    tasks = [(apply_type1, row) for row in type1_rows] + [(apply_type3, row) for row in type3_rows]
    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(worker, row) for worker, row in tasks]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            print(f'progress {index}/{len(futures)}')
            time.sleep(0.04)

    after_hashes = existing_hashes()
    existing_unchanged = all(after_hashes.get(path) == digest for path, digest in before_hashes.items())
    if not existing_unchanged:
        raise RuntimeError('an existing image changed during application')

    type1_applied = [entry for entry in results if entry['licenseType'] == 'Type1' and entry['status'] == 'applied']
    type3_applied = [entry for entry in results if entry['licenseType'] == 'Type3' and entry['status'] == 'applied']
    write_type1_metadata(type1_applied)
    write_type3_metadata(type3_applied)

    application_audit = {
        'scope': 'Family TourAPI Type 1 human approval + Type 3 unchanged-original PoC',
        'appliedAt': '2026-09-12',
        'policyVerification': {
            'verifiedAt': '2026-09-12',
            'koglType3Url': 'https://www.kogl.or.kr/info/licenseType3.do',
            'ktoCopyrightPolicyUrl': 'https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto',
            'conclusion': 'Type 3 permits commercial online sharing with attribution but prohibits modification. Original bytes are preserved and displayed with CSS contain.',
        },
        'type1RequestedCount': len(TYPE1_IDS),
        'type1AppliedCount': len(type1_applied),
        'type3PocRequestedCount': len(TYPE3_IDS),
        'type3PocAppliedCount': len(type3_applied),
        'failedCount': sum(entry['status'] == 'failed' for entry in results),
        'existingImageCountBefore': len(before_hashes),
        'existingImagesUnchanged': existing_unchanged,
        'entries': sorted(results, key=lambda entry: entry['familyPlaceId']),
    }
    APPLICATION_AUDIT_PATH.write_text(json.dumps(application_audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'type1Applied': len(type1_applied),
        'type3Applied': len(type3_applied),
        'failed': application_audit['failedCount'],
        'existingImagesUnchanged': existing_unchanged,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
