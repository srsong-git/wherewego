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
AUDIT_PATH = ROOT / "data" / "family" / "family-tourapi-fallback-audit.json"
OUTPUT_DIR = ROOT / "public" / "place-images"
METADATA_PATH = ROOT / "src" / "data" / "family-tourapi-approved-images.generated.js"
APPLICATION_AUDIT_PATH = ROOT / "data" / "family" / "family-tourapi-approved-image-application.json"
TARGET_RATIO = 8 / 5
MAX_WIDTH = 1200
MAX_WORKERS = 3
MAX_ATTEMPTS = 3


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def existing_image_hashes() -> dict[str, str]:
    return {
        path.name: sha256(path)
        for path in sorted(OUTPUT_DIR.glob("place-*.webp"))
    }


def fetch_bytes(url: str) -> tuple[bytes, str]:
    request_url = "https://" + url.removeprefix("http://") if url.startswith("http://") else url
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            request = urllib.request.Request(
                request_url,
                headers={
                    "User-Agent": "oneulwhere-family-image-audit/1.0",
                    "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*",
                },
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
                if not data:
                    raise ValueError("empty response")
                return data, response.headers.get("Content-Type", "")
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(attempt * 0.7)

    raise RuntimeError(f"download failed after {MAX_ATTEMPTS} attempts: {last_error}")


def crop_without_upscaling(source: Image.Image) -> tuple[Image.Image, dict[str, int | bool | str]]:
    image = ImageOps.exif_transpose(source)
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGB")

    original_width, original_height = image.size
    source_ratio = original_width / original_height

    if source_ratio > TARGET_RATIO:
        crop_width = max(1, round(original_height * TARGET_RATIO))
        left = (original_width - crop_width) // 2
        box = (left, 0, left + crop_width, original_height)
    else:
        crop_height = max(1, round(original_width / TARGET_RATIO))
        top = (original_height - crop_height) // 2
        box = (0, top, original_width, top + crop_height)

    cropped = image.crop(box)
    output_width = min(MAX_WIDTH, cropped.width)
    output_height = max(1, round(output_width / TARGET_RATIO))
    output_height = min(output_height, cropped.height)
    output_width = min(output_width, round(output_height * TARGET_RATIO))
    resized = output_width < cropped.width or output_height < cropped.height

    if resized:
        cropped = cropped.resize((output_width, output_height), Image.Resampling.LANCZOS)

    return cropped, {
        "sourceWidth": original_width,
        "sourceHeight": original_height,
        "outputWidth": cropped.width,
        "outputHeight": cropped.height,
        "upscaled": False,
        "transformation": "center-cropped to 8:5, resized without upscaling, converted to WebP",
    }


def selected_candidate(row: dict) -> dict:
    return next(
        (
            candidate
            for candidate in row.get("imageCandidates", [])
            if candidate.get("imageUrl") == row.get("selectedImageUrl")
        ),
        {},
    )


def process_row(row: dict) -> dict:
    place_id = row["familyPlaceId"]
    output_path = OUTPUT_DIR / f"{place_id}.webp"
    candidate = selected_candidate(row)

    try:
        payload, content_type = fetch_bytes(row["selectedImageUrl"])
        with Image.open(io.BytesIO(payload)) as source:
            transformed, dimensions = crop_without_upscaling(source)
            temp_path = output_path.with_suffix(".webp.tmp")
            transformed.save(temp_path, format="WEBP", quality=85, method=6)

        with temp_path.open("rb") as stream:
            signature = stream.read(12)
        if signature[:4] != b"RIFF" or signature[8:12] != b"WEBP":
            temp_path.unlink(missing_ok=True)
            raise ValueError("converted file is not a valid WebP container")

        os.replace(temp_path, output_path)
        return {
            "familyPlaceId": place_id,
            "familyPlaceName": row["familyPlaceName"],
            "region": row["region"],
            "status": "applied",
            "sourceName": "한국관광공사 TourAPI",
            "tourApiContentId": row["contentId"],
            "sourceUrl": row["selectedImageUrl"],
            "contentType": content_type,
            "licenseOrUsageBasis": "공공누리 제1유형: 상업적 이용, 복제·재배포 및 수정 허용(출처표시)",
            "licenseType": "Type1",
            "licenseUrl": "https://www.kogl.or.kr/info/licenseType1.do",
            "attributionText": "한국관광공사 TourAPI / 공공누리 제1유형 / center-cropped, resized without upscaling, and converted to WebP",
            "verifiedAt": "2026-09-11",
            "imageVariant": row["selectedImageVariant"],
            "imageName": candidate.get("imageName"),
            "representativeReason": row["reason"],
            "localPath": f"public/place-images/{place_id}.webp",
            "sha256": sha256(output_path),
            "fileSizeBytes": output_path.stat().st_size,
            **dimensions,
        }
    except Exception as error:  # The audit records the failure without leaking remote response bodies.
        output_path.with_suffix(".webp.tmp").unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)
        return {
            "familyPlaceId": place_id,
            "familyPlaceName": row["familyPlaceName"],
            "region": row["region"],
            "status": "failed",
            "sourceUrl": row.get("selectedImageUrl"),
            "reason": str(error),
        }


def javascript_string(value: str | None) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_metadata(entries: list[dict]) -> None:
    lines = [
        "// Generated from data/family/family-tourapi-fallback-audit.json.",
        "// Only exact-match, representative, public-nuri Type 1 images are included.",
        "export const tourApiApprovedImageMetadataById = Object.freeze({",
    ]
    for entry in sorted(entries, key=lambda item: item["familyPlaceId"]):
        place_id = entry["familyPlaceId"]
        image_name = entry.get("imageName")
        alt = f'{entry["familyPlaceName"]} {image_name}' if image_name else f'{entry["familyPlaceName"]} 대표 이미지'
        lines.extend(
            [
                f"  {javascript_string(place_id)}: Object.freeze({{",
                f"    alt: {javascript_string(alt)},",
                f"    sourceUrl: {javascript_string(entry['sourceUrl'])},",
                f"    tourApiContentId: {javascript_string(entry['tourApiContentId'])},",
                f"    imageVariant: {javascript_string(entry['imageVariant'])},",
                f"    representativeReason: {javascript_string(entry['representativeReason'])},",
                f"    verifiedAt: {javascript_string(entry['verifiedAt'])},",
                "  }),",
            ]
        )
    lines.extend(["})", ""])
    METADATA_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    approved = [row for row in audit["places"] if row.get("decision") == "approved"]
    if len(approved) != 91:
        raise RuntimeError(f"expected 91 approved rows, got {len(approved)}")

    invalid = [
        row["familyPlaceId"]
        for row in approved
        if row.get("tourApiMatchStatus") != "exact"
        or row.get("licenseType") != "Type1"
        or row.get("representativeQuality") != "high_by_tourapi_metadata"
        or not row.get("selectedImageUrl")
    ]
    if invalid:
        raise RuntimeError(f"approved audit invariant failed: {invalid}")

    before_hashes = existing_image_hashes()
    collisions = [row["familyPlaceId"] for row in approved if f'{row["familyPlaceId"]}.webp' in before_hashes]
    if collisions:
        raise RuntimeError(f"refusing to overwrite existing images: {collisions}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_row, row) for row in approved]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 15 == 0 or index == len(futures):
                applied_count = sum(item["status"] == "applied" for item in results)
                print(f"progress {index}/{len(futures)} applied={applied_count}")
            time.sleep(0.04)

    applied = [result for result in results if result["status"] == "applied"]
    failed = [result for result in results if result["status"] == "failed"]
    after_hashes = existing_image_hashes()
    existing_unchanged = all(after_hashes.get(name) == digest for name, digest in before_hashes.items())
    if not existing_unchanged:
        raise RuntimeError("an existing image changed during TourAPI application")

    write_metadata(applied)
    application_audit = {
        "scope": "Family TourAPI approved image application",
        "appliedAt": "2026-09-12",
        "sourceAudit": "data/family/family-tourapi-fallback-audit.json",
        "expectedApprovedCount": 91,
        "appliedCount": len(applied),
        "failedCount": len(failed),
        "existingImageCountBefore": len(before_hashes),
        "existingImagesUnchanged": existing_unchanged,
        "security": {
            "tourApiServiceKeyUsed": False,
            "browserSecretExposure": False,
        },
        "entries": sorted(results, key=lambda item: item["familyPlaceId"]),
    }
    APPLICATION_AUDIT_PATH.write_text(
        json.dumps(application_audit, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "applied": len(applied),
                "failed": len(failed),
                "existingImagesUnchanged": existing_unchanged,
                "metadata": str(METADATA_PATH.relative_to(ROOT)),
                "audit": str(APPLICATION_AUDIT_PATH.relative_to(ROOT)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
