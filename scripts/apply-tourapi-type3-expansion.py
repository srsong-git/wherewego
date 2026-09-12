from __future__ import annotations

import hashlib
import json
import os
import pathlib
import shutil


ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-fallback-audit.json'
REVIEW_MANIFEST_PATH = ROOT / 'reports' / 'family-tourapi-type3-review' / 'review-manifest.json'
ALTERNATE_MANIFEST_PATH = ROOT / 'reports' / 'family-tourapi-type3-review' / 'alternate-review-manifest.json'
OUTPUT_DIR = ROOT / 'public' / 'place-images' / 'original'
METADATA_PATH = ROOT / 'src' / 'data' / 'family-tourapi-type3-expanded-images.generated.js'
APPLICATION_AUDIT_PATH = ROOT / 'data' / 'family' / 'family-tourapi-type3-expansion-application.json'
POC_IDS = {
    'place-015', 'place-019', 'place-047', 'place-068', 'place-217',
    'place-231', 'place-240', 'place-245', 'place-277', 'place-280',
}
HOLD_REASONS = {
    'place-052': '대체 후보 5장 모두 세로형이며 휠체어·통로·단일 체험물·안내도 중심이라 contain 카드에서 작게 보이고 장소 전체를 대표하지 못합니다.',
    'place-072': '후보 전부 헤이리예술마을 전체가 아니라 옛생활체험박물관 실내 소장품 중심이라 서비스 장소와 직접성이 부족합니다.',
    'place-076': '후보 전부 418×627 세로형이며 꽃밭 일부나 소품 중심이라 contain 카드에서 지나치게 작고 시설 전체 대표성이 부족합니다.',
    'place-149': '후보 전부 장애인 화장실·경사로·주차장 입구 등 편의시설 중심이라 동탄호수공원의 경관과 성격을 전달하지 못합니다.',
}
ALTERNATE_SELECTIONS = {
    'place-016': 2,
    'place-018': 4,
    'place-062': 5,
    'place-081': 2,
    'place-101': 5,
    'place-133': 5,
    'place-158': 2,
    'place-194': 2,
    'place-210': 2,
    'place-220': 2,
    'place-223': 2,
    'place-243': 2,
    'place-257': 2,
    'place-263': 3,
    'place-264': 3,
    'place-272': 3,
}


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def image_hashes() -> dict[str, str]:
    root = ROOT / 'public' / 'place-images'
    return {
        str(path.relative_to(ROOT)).replace('\\', '/'): sha256_file(path)
        for path in sorted(root.rglob('*'))
        if path.is_file()
    }


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_metadata(entries: list[dict]) -> None:
    lines = [
        '// Generated from the human-reviewed TourAPI public-nuri Type 3 expansion.',
        'export const tourApiType3ExpandedImageMetadataById = Object.freeze({',
    ]
    for entry in sorted(entries, key=lambda item: item['familyPlaceId']):
        lines.extend([
            f"  {js(entry['familyPlaceId'])}: Object.freeze({{",
            f"    src: {js(entry['publicSrc'])},",
            f"    alt: {js(entry['alt'])},",
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
    METADATA_PATH.write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding='utf-8'))
    review_manifest = json.loads(REVIEW_MANIFEST_PATH.read_text(encoding='utf-8'))
    alternate_manifest = json.loads(ALTERNATE_MANIFEST_PATH.read_text(encoding='utf-8'))
    rows = {
        row['familyPlaceId']: row for row in audit['places']
        if row.get('licenseType') == 'Type3' and row['familyPlaceId'] not in POC_IDS
    }
    if len(rows) != 73:
        raise RuntimeError(f'expected 73 remaining Type 3 rows, found {len(rows)}')
    if len(HOLD_REASONS) != 4:
        raise RuntimeError('expected four held places')

    primary_by_id = {entry['familyPlaceId']: entry for entry in review_manifest['entries']}
    alternate_by_key = {
        (entry['familyPlaceId'], entry['candidateIndex']): entry
        for entry in alternate_manifest['entries']
    }
    before_hashes = image_hashes()
    existing_stems = {pathlib.Path(path).stem for path in before_hashes}
    target_ids = sorted(set(rows) - set(HOLD_REASONS))
    collisions = sorted(set(target_ids) & existing_stems)
    if collisions:
        raise RuntimeError(f'refusing to overwrite existing images: {collisions}')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    applied: list[dict] = []
    decisions: list[dict] = []
    for place_id, row in sorted(rows.items()):
        if place_id in HOLD_REASONS:
            decisions.append({
                'familyPlaceId': place_id,
                'familyPlaceName': row['familyPlaceName'],
                'region': row['region'],
                'decision': 'held',
                'reasonCategory': '대표성 또는 contain UI 적합성 부족',
                'reason': HOLD_REASONS[place_id],
                'sourceUrl': row['selectedImageUrl'],
            })
            continue

        candidate_index = ALTERNATE_SELECTIONS.get(place_id)
        source = alternate_by_key[(place_id, candidate_index)] if candidate_index else primary_by_id[place_id]
        if source.get('copyrightCode') != 'Type3':
            raise RuntimeError(f'non-Type3 candidate selected for {place_id}')
        source_path = ROOT / source['reviewPath']
        if not source_path.is_file():
            raise RuntimeError(f'missing reviewed original for {place_id}: {source_path}')
        source_sha = sha256_file(source_path)
        if source_sha != source['sha256']:
            raise RuntimeError(f'reviewed source hash mismatch for {place_id}')

        extension = source_path.suffix.lower()
        output_path = OUTPUT_DIR / f'{place_id}{extension}'
        temp_path = output_path.with_suffix(output_path.suffix + '.tmp')
        shutil.copyfile(source_path, temp_path)
        os.replace(temp_path, output_path)
        output_sha = sha256_file(output_path)
        if output_sha != source_sha:
            output_path.unlink(missing_ok=True)
            raise RuntimeError(f'stored original differs from reviewed source for {place_id}')

        candidate = next(
            item for item in row['imageCandidates']
            if item['imageUrl'] == source['sourceUrl'] and item.get('copyrightCode') == 'Type3'
        )
        published_year = (row.get('tourApiCreatedAt') or '')[:4] or None
        representative_reason = (
            '사람 검토에서 더 대표적인 대체 원본을 선택했습니다. 장소의 외관·핵심 전시·핵심 체험이 명확하고 contain 카드에서도 식별 가능합니다.'
            if candidate_index
            else '사람 검토에서 장소의 외관·핵심 전시·대표 경관이 명확하고 contain 카드에서도 식별 가능한 원본으로 승인했습니다.'
        )
        entry = {
            'familyPlaceId': place_id,
            'familyPlaceName': row['familyPlaceName'],
            'region': row['region'],
            'licenseType': 'Type3',
            'decision': 'applied',
            'sourceName': '한국관광공사 TourAPI',
            'tourApiContentId': row['contentId'],
            'tourApiTitle': row['tourApiTitle'],
            'sourceUrl': source['sourceUrl'],
            'sourcePolicyUrl': 'https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto',
            'licenseOrUsageBasis': '공공누리 제3유형: 출처표시, 상업적 이용 가능, 변경 및 2차적 저작물 작성 금지',
            'licenseUrl': 'https://www.kogl.or.kr/info/licenseType3.do',
            'attributionText': f"한국관광공사 {published_year or '발행연도 미제공'}년 콘텐츠 '{row['tourApiTitle']}' / 공공누리 제3유형 / 변경 없이 사용",
            'verifiedAt': '2026-09-12',
            'publishedYear': published_year,
            'author': None,
            'authorBasis': 'TourAPI 응답 및 이미지 메타데이터에 별도 저작자명이 표시되지 않음',
            'imageVariant': candidate.get('imageVariant') or source.get('imageVariant'),
            'imageName': candidate.get('imageName'),
            'selectedAlternateCandidate': candidate_index,
            'representativeReason': representative_reason,
            'localPath': str(output_path.relative_to(ROOT)).replace('\\', '/'),
            'publicSrc': '/' + str(output_path.relative_to(ROOT / 'public')).replace('\\', '/'),
            'alt': f"{row['familyPlaceName']} {candidate.get('imageName') or '대표 이미지'}",
            'originalFormat': source['originalFormat'],
            'originalWidth': source['originalWidth'],
            'originalHeight': source['originalHeight'],
            'originalAspectRatio': source['originalAspectRatio'],
            'originalBytesPreserved': True,
            'transformation': 'none',
            'sha256': output_sha,
            'downloadedSha256': source_sha,
            'fileSizeBytes': output_path.stat().st_size,
        }
        applied.append(entry)
        decisions.append(entry)

    after_hashes = image_hashes()
    existing_unchanged = all(after_hashes.get(path) == digest for path, digest in before_hashes.items())
    if not existing_unchanged:
        raise RuntimeError('an existing Family image changed during Type 3 expansion')
    if len(applied) != 69:
        raise RuntimeError(f'expected 69 applied images, got {len(applied)}')
    if any(entry['sha256'] != entry['downloadedSha256'] for entry in applied):
        raise RuntimeError('one or more Type 3 originals were changed')

    write_metadata(applied)
    regions: dict[str, int] = {}
    for entry in applied:
        regions[entry['region']] = regions.get(entry['region'], 0) + 1
    application_audit = {
        'scope': 'Family TourAPI public-nuri Type 3 remaining 73 representative-image review and application',
        'appliedAt': '2026-09-12',
        'policyVerification': {
            'verifiedAt': '2026-09-12',
            'koglType3Url': 'https://www.kogl.or.kr/info/licenseType3.do',
            'ktoCopyrightPolicyUrl': 'https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto',
            'conclusion': '제3유형은 출처표시와 상업적 이용이 가능하지만 변경은 금지됩니다. 승인 파일은 원본 바이트를 그대로 저장하고 CSS contain으로만 표시합니다.',
        },
        'targetCount': 73,
        'appliedCount': len(applied),
        'heldCount': len(HOLD_REASONS),
        'alternateCandidateAppliedCount': len(ALTERNATE_SELECTIONS),
        'existingImageCountBefore': 150,
        'existingImagesUnchanged': existing_unchanged,
        'regions': regions,
        'decisions': decisions,
    }
    APPLICATION_AUDIT_PATH.write_text(json.dumps(application_audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'targetCount': 73,
        'appliedCount': len(applied),
        'heldCount': len(HOLD_REASONS),
        'regions': regions,
        'existingImagesUnchanged': existing_unchanged,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
