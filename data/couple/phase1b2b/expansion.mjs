const VERIFIED_AT = '2026-09-01T18:00:00+09:00'
const CHECKED_AT = '2026-09-01'
const DATASET_VERSION = 'couple-production-phase1b2b-v1'

const ref = (kind, url) => ({ kind, url, checked_at: CHECKED_AT })

const venue = ({ key, name, address, latitude, longitude, kakaoId, area, evidence }) => ({
  source_key: key,
  canonical_name: name,
  address,
  latitude,
  longitude,
  kakao_place_id: String(kakaoId),
  kakao_detail_url: `https://place.map.kakao.com/${kakaoId}`,
  meeting_area: area,
  status: 'active',
  verified_at: VERIFIED_AT,
  source_references: [
    ref('kakao', `https://place.map.kakao.com/${kakaoId}`),
    ref('official_or_trusted', evidence),
  ],
})

function editorialScore(scores) {
  const [relevance, destination, current, distinctiveness, conversation, commonnessRisk] = scores
  return relevance * 6 + destination * 4 + current * 4 + distinctiveness * 3
    + conversation * 3 - (commonnessRisk - 1) * 5
}

function makeItem({
  key,
  venueKey,
  name,
  summary,
  category,
  primary,
  secondary = [],
  energy,
  novelty,
  spend,
  requiredSpend = spend,
  priceBasis = 'admission',
  priceNote,
  priceEvidence = null,
  duration,
  indoorOutdoor = 'indoor',
  walking = 'low',
  wait = 'low',
  mobility = 4,
  freshness = 'evergreen',
  freshnessReason,
  kind = 'permanent',
  evidence,
  evidenceKind = kind === 'event' ? 'official_event' : 'official_or_trusted',
  bookingRequired = false,
  bookingUrl = null,
  availability = bookingRequired ? 'available' : 'walk_in_only',
  scores,
  tier,
  rationale,
  human,
  validFrom = null,
  validUntil = null,
  reviewDue = '2026-10-01T00:00:00+09:00',
  status = 'active',
}) {
  const score = editorialScore(scores)
  const priceBand = spend === 0 ? 'free' : spend <= 20000 ? 'under_20000' : spend <= 40000 ? 'under_40000' : 'over_40000'
  return {
    source_key: key,
    venue_source_key: venueKey,
    item_kind: kind,
    canonical_name: name,
    summary,
    category,
    activity_traits: [...new Set([primary, ...secondary])],
    primary_activity_type: primary,
    secondary_activity_types: secondary,
    energy_level: energy,
    novelty_level: novelty,
    freshness_class: freshness,
    freshness_reason: freshnessReason,
    freshness_verified_at: VERIFIED_AT,
    freshness_review_due_at: reviewDue,
    freshness_expires_at: freshness === 'evergreen' ? null : validUntil || '2027-03-01T00:00:00+09:00',
    price_band: priceBand,
    typical_spend_per_person: spend,
    required_spend_per_person: requiredSpend,
    price_basis: spend === 0 ? 'free' : priceBasis,
    price_note: priceNote,
    recommended_duration_minutes: duration,
    indoor_outdoor: indoorOutdoor,
    walking_level: walking,
    wait_risk: wait,
    car_required: false,
    mobility_score: mobility,
    status,
    valid_from: validFrom,
    valid_until: validUntil,
    verified_at: VERIFIED_AT,
    source_references: [
      ref(evidenceKind, evidence),
      ...(priceEvidence && priceEvidence !== evidence
        ? [ref('verified_price', priceEvidence)]
        : []),
    ],
    _review: {
      scores,
      editorial_score: score,
      editorial_tier: tier || (score >= 82 ? 'hero' : 'standard'),
      editorial_rationale: rationale,
      editorial_review_due_at: reviewDue,
      booking_required: bookingRequired,
      booking_url: bookingUrl,
      booking_open_at: kind === 'event' && bookingRequired ? validFrom : null,
      booking_close_at: kind === 'event' && bookingRequired ? validUntil : null,
      availability_status: availability,
      availability_review_due_at: reviewDue,
    },
    _human: human,
  }
}

const eventItem = (value) => makeItem({
  ...value,
  kind: 'event',
  freshness: 'temporary',
  priceBasis: value.priceBasis || 'admission',
})

const permanentItem = (value) => makeItem({
  ...value,
  freshness: value.freshness || 'evergreen',
})

export const phase1B2BVenues = [
  // Seongsu / Seoul Forest — independently researched; no Family source.
  venue({ key: 'venue-theclimb-seongsu', name: '더클라임 성수점', address: '서울 성동구 아차산로17길 49', latitude: 37.546768103205, longitude: 127.065279873384, kakaoId: '633255619', area: 'seongsu', evidence: 'https://linktr.ee/theclimb_life' }),
  venue({ key: 'venue-redbutton-seongsu', name: '레드버튼 성수점', address: '서울 성동구 연무장길 17', latitude: 37.5437358671727, longitude: 127.051454136678, kakaoId: '1476449408', area: 'seongsu', evidence: 'https://redbutton.co.kr/' }),
  venue({ key: 'venue-vinyl-seongsu', name: '바이닐 성수', address: '서울 성동구 아차산로 15-8', latitude: 37.5478682133326, longitude: 127.046215318336, kakaoId: '376746050', area: 'seongsu', evidence: 'https://ohou.se/advices/9748' }),
  venue({ key: 'venue-about-the-chapter', name: '어바웃더챕터', address: '서울 성동구 서울숲4길 20-1', latitude: 37.54714947174664, longitude: 127.04315953289951, kakaoId: '480095116', area: 'seongsu', evidence: 'https://www.instagram.com/about.the.chapter/' }),
  venue({ key: 'venue-lafre-fruit', name: '라프레플루트', address: '서울 성동구 서울숲2길 8-8', latitude: 37.54724988369451, longitude: 127.03943659531265, kakaoId: '519985882', area: 'seongsu', evidence: 'https://www.instagram.com/lafre_fruit/' }),
  venue({ key: 'venue-ferment-seongsu', name: '퍼먼트', address: '서울 성동구 서울숲2길 37', latitude: 37.546635149690694, longitude: 127.04275186027311, kakaoId: '2022438740', area: 'seongsu', evidence: 'https://www.instagram.com/ferment_bakeshop/' }),
  venue({ key: 'venue-beton-seongsu', name: '베통 성수', address: '서울 성동구 연무장7가길 8', latitude: 37.54294488785, longitude: 127.055226162255, kakaoId: '1091304591', area: 'seongsu', evidence: 'https://www.instagram.com/beton.seoul/' }),
  venue({ key: 'venue-lowkey-seongsu', name: '로우키', address: '서울 성동구 연무장3길 6', latitude: 37.5441908183721, longitude: 127.05157665819107, kakaoId: '1302549042', area: 'seongsu', evidence: 'https://lowkeycoffee.com/' }),
  venue({ key: 'venue-movemove-cafe', name: '무브모브 카페', address: '서울 성동구 성수일로 56', latitude: 37.545387826028, longitude: 127.050464006778, kakaoId: '1957274050', area: 'seongsu', evidence: 'https://www.instagram.com/movemove_cafe/' }),
  venue({ key: 'venue-nudake-tea-house', name: '누데이크 티 하우스', address: '서울 성동구 뚝섬로 433', latitude: 37.5381858138613, longitude: 127.058939539412, kakaoId: '750562735', area: 'seongsu', evidence: 'https://www.nudake.com/' }),
  venue({ key: 'venue-artirum', name: '아티룸', address: '서울 성동구 상원6길 10-1', latitude: 37.5487580266333, longitude: 127.049364068884, kakaoId: '1184593303', area: 'seongsu', evidence: 'https://www.instagram.com/artirum_seongsu/' }),
  venue({ key: 'venue-flodi-studio', name: '플로디스튜디오', address: '서울 성동구 성수일로3길 4-13', latitude: 37.5424172654246, longitude: 127.048226088404, kakaoId: '1238841504', area: 'seongsu', evidence: 'https://flodstudio.com/' }),
  venue({ key: 'venue-yuyuhui-seongsu', name: '담금주공방 유유히 성수', address: '서울 성동구 서울숲9길 5', latitude: 37.5484161248689, longitude: 127.043571043884, kakaoId: '1576739768', area: 'seongsu', evidence: 'https://ktxmagazine.kr/wp-content/uploads/2025/02/2502-1.pdf' }),
  venue({ key: 'venue-plavi-seongsu', name: '플라비 성수점', address: '서울 성동구 서울숲2길 19-17', latitude: 37.5474493743079, longitude: 127.040996062555, kakaoId: '336686550', area: 'seongsu', evidence: 'https://www.instagram.com/plavi_official/' }),
  venue({ key: 'venue-lettre-seongsu', name: '레트르 성수', address: '서울 성동구 연무장길 37-18', latitude: 37.5433789281582, longitude: 127.053797333507, kakaoId: '4502670', area: 'seongsu', evidence: 'https://www.instagram.com/lettre_seongsu/' }),
  venue({ key: 'venue-peaches-dowon', name: '피치스그룹코리아', address: '서울 성동구 연무장3길 9', latitude: 37.544659446306476, longitude: 127.05132803556035, kakaoId: '865024773', area: 'seongsu', evidence: 'https://peachesoneuniverse.com/' }),
  venue({ key: 'venue-pubg-seongsu-playarena', name: '펍지 성수 플레이아레나', address: '서울 성동구 왕십리로4길 5', latitude: 37.54588263235273, longitude: 127.04564829807882, kakaoId: '654221545', area: 'seongsu', evidence: 'https://pubg.com/ko/' }),
  venue({ key: 'venue-snowrabbit-seongsu', name: '보드게임카페 스노우래빗', address: '서울 성동구 왕십리로 104', latitude: 37.5468659208299, longitude: 127.044869222691, kakaoId: '1641826064', area: 'seongsu', evidence: 'https://www.instagram.com/snowrabbit_boardgame/' }),
  venue({ key: 'venue-samjakso', name: '삼작소', address: '서울 성동구 둘레3길 12', latitude: 37.538251517322, longitude: 127.047047804409, kakaoId: '513574485', area: 'seongsu', evidence: 'https://www.instagram.com/samjakso/' }),
  venue({ key: 'venue-maison-liliane', name: '메종릴리앙', address: '서울 성동구 왕십리로 102', latitude: 37.54662715487814, longitude: 127.04487247437933, kakaoId: '2121644557', area: 'seongsu', evidence: 'https://www.instagram.com/maison_liliane/' }),
  venue({ key: 'venue-the-seouliteum', name: '더서울라이티움', address: '서울 성동구 서울숲2길 32-14', latitude: 37.5455853989664, longitude: 127.042991156674, kakaoId: '66485696', area: 'seongsu', evidence: 'https://www.instagram.com/theseouliteum/' }),
  venue({ key: 'venue-laoc-seongsu', name: '라오크 성수점', address: '서울 성동구 서울숲4길 20', latitude: 37.5471909713625, longitude: 127.043012447699, kakaoId: '1327812716', area: 'seongsu', evidence: 'https://www.instagram.com/laoc_official/' }),

  // Hongdae / Yeonnam.
  venue({ key: 'venue-duex-hongdae', name: '덕스(DUEX)', address: '서울 마포구 양화로 186', latitude: 37.5576983954636, longitude: 126.926036726927, kakaoId: '2077723370', area: 'hongdae', evidence: 'https://dueple.tistory.com/23' }),
  venue({ key: 'venue-ak-plaza-hongdae', name: 'AK플라자 홍대', address: '서울 마포구 양화로 188', latitude: 37.55780854901018, longitude: 126.92640783829829, kakaoId: '1156421273', area: 'hongdae', evidence: 'https://dueple.tistory.com/23' }),
  venue({ key: 'venue-ktng-cinema-hongdae', name: 'KT&G 상상마당 시네마', address: '서울 마포구 어울마당로 65', latitude: 37.5510160623612, longitude: 126.921036839018, kakaoId: '21059836', area: 'hongdae', evidence: 'https://www.sangsangmadang.com/' }),
  venue({ key: 'venue-channel-1969', name: '채널1969', address: '서울 마포구 연희로 35', latitude: 37.5618967594842, longitude: 126.927033115238, kakaoId: '24063521', area: 'hongdae', evidence: 'https://web.ducksticket.com/venue/1274' }),
  venue({ key: 'venue-liveclub-bbang', name: '라이브클럽 빵', address: '서울 마포구 와우산로29길 12', latitude: 37.55485954187758, longitude: 126.92928645021782, kakaoId: '10449951', area: 'hongdae', evidence: 'https://www.instagram.com/cafe_bbang/' }),
  venue({ key: 'venue-jebi-dabang', name: '제비다방', address: '서울 마포구 와우산로 24', latitude: 37.5466169482794, longitude: 126.923100991167, kakaoId: '27194461', area: 'hongdae', evidence: 'https://www.instagram.com/jebidabang/' }),
  venue({ key: 'venue-sannullim-small-theater', name: '소극장산울림', address: '서울 마포구 와우산로 157', latitude: 37.5550834709886, longitude: 126.93009542405, kakaoId: '7910244', area: 'hongdae', evidence: 'https://sannullim.com/' }),
  venue({ key: 'venue-rolling-hall', name: '롤링홀', address: '서울 마포구 어울마당로 35', latitude: 37.54849715586611, longitude: 126.92012061415478, kakaoId: '7854938', area: 'hongdae', evidence: 'https://rollinghall.co.kr/' }),
  venue({ key: 'venue-musinsa-garage', name: '무신사 개러지', address: '서울 마포구 잔다리로 32', latitude: 37.55157469963834, longitude: 126.91972803364959, kakaoId: '1123419577', area: 'hongdae', evidence: 'https://www.musinsagarage.com/' }),
  venue({ key: 'venue-west-bridge-live-hall', name: '웨스트브릿지 라이브홀', address: '서울 마포구 와우산로25길 6', latitude: 37.5536502874205, longitude: 126.926153898396, kakaoId: '1224362243', area: 'hongdae', evidence: 'https://www.instagram.com/westbridge_livehall/' }),
  venue({ key: 'venue-indiespace-hongdae', name: '인디스페이스', address: '서울 마포구 양화로 176', latitude: 37.55724272960245, longitude: 126.92498690357512, kakaoId: '17532139', area: 'hongdae', evidence: 'https://indiespace.kr/' }),
  venue({ key: 'venue-cinemapo', name: '씨네마포', address: '서울 마포구 독막로9길 3-3', latitude: 37.5486236541694, longitude: 126.919322679926, kakaoId: '722179655', area: 'hongdae', evidence: 'https://www.instagram.com/cinemapo/' }),
  venue({ key: 'venue-grim-production-yeonnam', name: '그림제작소 연남점', address: '서울 마포구 성미산로 170', latitude: 37.56415583377452, longitude: 126.92460532508811, kakaoId: '1095116329', area: 'hongdae', evidence: 'https://www.instagram.com/grimfactory_official/' }),
  venue({ key: 'venue-dotori-caricature-yeonnam', name: '도토리캐리커쳐 연남본점', address: '서울 마포구 동교로38길 34', latitude: 37.5614147077178, longitude: 126.925559951025, kakaoId: '263440049', area: 'hongdae', evidence: 'https://www.instagram.com/dotori_caricature/' }),
  venue({ key: 'venue-ahyeon-pottery', name: '아현공방', address: '서울 마포구 성미산로29길 35-6', latitude: 37.56564226966326, longitude: 126.92152169724336, kakaoId: '353979024', area: 'hongdae', evidence: 'https://www.instagram.com/ahyeon_ceramic/' }),
  venue({ key: 'venue-piece-to-you', name: '피스투유', address: '서울 마포구 성미산로29길 30-3', latitude: 37.5654967489615, longitude: 126.922187398478, kakaoId: '945567881', area: 'hongdae', evidence: 'https://www.instagram.com/piece_to_you/' }),
  venue({ key: 'venue-vessel-studio-blossom', name: '그릇공방 플로썸', address: '서울 마포구 성미산로27길 53', latitude: 37.56593994998293, longitude: 126.92069963133953, kakaoId: '62101870', area: 'hongdae', evidence: 'https://www.instagram.com/flosom_pottery/' }),
  venue({ key: 'venue-book-gopsem', name: '책방곱셈', address: '서울 마포구 성미산로29길 33', latitude: 37.5653352090453, longitude: 126.921791407494, kakaoId: '138332755', area: 'hongdae', evidence: 'https://www.instagram.com/bookshop_gopsem/' }),
  venue({ key: 'venue-booknook-yeonnam', name: '북눅 연남', address: '서울 마포구 월드컵북로6길 93', latitude: 37.5604488759022, longitude: 126.922810616118, kakaoId: '281033091', area: 'hongdae', evidence: 'https://www.instagram.com/booknook_yeonnam/' }),
  venue({ key: 'venue-1984-hongdae', name: '1984', address: '서울 마포구 동교로 194', latitude: 37.5573639089622, longitude: 126.922881704192, kakaoId: '23634722', area: 'hongdae', evidence: 'https://www.instagram.com/1984_store/' }),
  venue({ key: 'venue-kokorokara', name: '코코로카라', address: '서울 마포구 연남로1길 41', latitude: 37.55979892305329, longitude: 126.92094381805684, kakaoId: '149766335', area: 'hongdae', evidence: 'https://www.instagram.com/kokorokara/' }),
  venue({ key: 'venue-cafe-gongmyung-yeonnam', name: '카페공명 연남점', address: '서울 마포구 연희로 11', latitude: 37.5598708965573, longitude: 126.926352615326, kakaoId: '1797970569', area: 'hongdae', evidence: 'https://www.instagram.com/cafe_gongmyoung/' }),
  venue({ key: 'venue-club-onair', name: '클럽온에어', address: '서울 마포구 잔다리로 44', latitude: 37.5523174897451, longitude: 126.918947505363, kakaoId: '1897701926', area: 'hongdae', evidence: 'https://www.instagram.com/clubonair/' }),
  venue({ key: 'venue-gonjung-camp', name: '공중캠프', address: '서울 마포구 와우산로 150', latitude: 37.55430486721728, longitude: 126.92985622751605, kakaoId: '12571532', area: 'hongdae', evidence: 'https://www.instagram.com/kuchu_camp/' }),

  // Jongno / Euljiro.
  venue({ key: 'venue-arko-art-center', name: '아르코미술관', address: '서울 종로구 동숭길 3', latitude: 37.5804617445584, longitude: 127.00323784065, kakaoId: '7991363', area: 'jongno_euljiro', evidence: 'https://www.arko.or.kr/artcenter/' }),
  venue({ key: 'venue-museum-hanmi-samcheong', name: '뮤지엄한미 삼청', address: '서울 종로구 삼청로9길 45', latitude: 37.58786366786638, longitude: 126.9806706683131, kakaoId: '20950644', area: 'jongno_euljiro', evidence: 'https://museumhanmi.or.kr/en/location/samchung/' }),
  venue({ key: 'venue-museum-hanmi-annex', name: '뮤지엄한미 삼청별관', address: '서울 종로구 삼청로11길 11', latitude: 37.58840432255569, longitude: 126.98103510732976, kakaoId: '1424798668', area: 'jongno_euljiro', evidence: 'https://museumhanmi.or.kr/en/location/samchung/' }),
  venue({ key: 'venue-sehwa-museum', name: '세화미술관', address: '서울 종로구 새문안로 68', latitude: 37.56964296257807, longitude: 126.97214275152511, kakaoId: '1684105979', area: 'jongno_euljiro', evidence: 'https://sehwamuseum.org/' }),
  venue({ key: 'venue-culture-station-284', name: '문화역서울284', address: '서울 중구 통일로 1', latitude: 37.55587561333548, longitude: 126.97162727684287, kakaoId: '27299118', area: 'jongno_euljiro', evidence: 'https://www.seoul284.org/' }),
  venue({ key: 'venue-kumho-museum', name: '금호미술관', address: '서울 종로구 삼청로 18', latitude: 37.577465172613, longitude: 126.979894494703, kakaoId: '12163059', area: 'jongno_euljiro', evidence: 'http://www.kumhomuseum.com/' }),
  venue({ key: 'venue-sejong-art-museum', name: '세종문화회관 미술관', address: '서울 종로구 세종대로 175', latitude: 37.5718530872608, longitude: 126.976183103242, kakaoId: '25587453', area: 'jongno_euljiro', evidence: 'https://www.sejongpac.or.kr/' }),
  venue({ key: 'venue-kcdf-gallery', name: '한국공예디자인문화진흥원 갤러리', address: '서울 종로구 인사동11길 8', latitude: 37.57400960286309, longitude: 126.98412915767824, kakaoId: '9330736', area: 'jongno_euljiro', evidence: 'https://www.kcdf.or.kr/' }),
  venue({ key: 'venue-chungsudang-bakery', name: '청수당 베이커리', address: '서울 종로구 돈화문로11나길 31-9', latitude: 37.57388138546145, longitude: 126.98978471926921, kakaoId: '78911659', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/cheongsudang_/' }),
  venue({ key: 'venue-dotori-garden-anguk', name: '도토리가든 안국점', address: '서울 종로구 계동길 19-8', latitude: 37.57809678858027, longitude: 126.98632451823079, kakaoId: '374133761', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/dotori__garden/' }),
  venue({ key: 'venue-layered-anguk', name: '카페레이어드 안국점', address: '서울 종로구 북촌로2길 2-3', latitude: 37.57772553241114, longitude: 126.98592836139179, kakaoId: '826692169', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/cafe_layered/' }),
  venue({ key: 'venue-soha-saltpond-ikseon', name: '소하염전 익선점', address: '서울 종로구 수표로28길 21-5', latitude: 37.5731236413013, longitude: 126.989698790693, kakaoId: '1130146507', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/soha_saltpond/' }),
  venue({ key: 'venue-osulloc-bukchon', name: '오설록티하우스 북촌점', address: '서울 종로구 북촌로 45', latitude: 37.5809977756573, longitude: 126.984591843689, kakaoId: '1502729906', area: 'jongno_euljiro', evidence: 'https://www.osulloc.com/' }),
  venue({ key: 'venue-hyemindang', name: '혜민당', address: '서울 중구 삼일대로12길 16-9', latitude: 37.56647779917071, longitude: 126.98861308151253, kakaoId: '346424300', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/hyemindang/' }),
  venue({ key: 'venue-teong', name: '텅', address: '서울 종로구 율곡로 82', latitude: 37.5771887848361, longitude: 126.988160889755, kakaoId: '253722326', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/tung_seoul/' }),
  venue({ key: 'venue-horangi-euljiro', name: '호랑이', address: '서울 중구 을지로 157', latitude: 37.5674657521006, longitude: 126.99544970010409, kakaoId: '1709558766', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/horangiicoffee/' }),
  venue({ key: 'venue-seoul-coffee-ikseon', name: '서울커피 익선점', address: '서울 종로구 수표로28길 33-3', latitude: 37.5733146821313, longitude: 126.990047421584, kakaoId: '1202876840', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/seoulcoffee1945/' }),
  venue({ key: 'venue-dynamic-maze-insadong', name: '다이나믹메이즈 서울인사동점', address: '서울 종로구 인사동길 12', latitude: 37.57189803811425, longitude: 126.98714973498457, kakaoId: '27215154', area: 'jongno_euljiro', evidence: 'https://www.dynamicmaze.com/' }),
  venue({ key: 'venue-hanboknam-gyeongbok', name: '한복남 경복궁점', address: '서울 종로구 사직로 133-5', latitude: 37.57620788084097, longitude: 126.97330744725905, kakaoId: '101080414', area: 'jongno_euljiro', evidence: 'https://hanboknam.com/' }),
  venue({ key: 'venue-amateur-workshop-cheonggye', name: '아마츄어작업실 청계점', address: '서울 종로구 청계천로 97-8', latitude: 37.56863926319365, longitude: 126.98835806751802, kakaoId: '1551175922', area: 'jongno_euljiro', evidence: 'https://www.instagram.com/amateurworkshop/' }),
  venue({ key: 'venue-ssamziegil-workshop', name: '쌈지길체험공방', address: '서울 종로구 인사동길 44', latitude: 37.574251162308684, longitude: 126.98483548569659, kakaoId: '27393479', area: 'jongno_euljiro', evidence: 'https://www.ssamzigil.co.kr/' }),
  venue({ key: 'venue-museum-head', name: '뮤지엄헤드', address: '서울 종로구 계동길 84-3', latitude: 37.581253042755144, longitude: 126.98696472317121, kakaoId: '983287184', area: 'jongno_euljiro', evidence: 'https://museumhead.com/' }),
  venue({ key: 'venue-park-no-soo-museum', name: '종로구립 박노수미술관', address: '서울 종로구 옥인1길 34', latitude: 37.5813184655898, longitude: 126.966783450397, kakaoId: '21631695', area: 'jongno_euljiro', evidence: 'https://museum.jongno.go.kr/' }),
]

const KEEP = 'keep_primary'
const ALT = 'alternative_only'
const HOLD = 'research_hold'
const HERO = [5, 5, 5, 4, 5, 2]
const STRONG = [5, 4, 4, 4, 4, 2]
const CAFE_PRIMARY = [5, 4, 4, 4, 4, 3]
const ALT_SCORE = [4, 4, 4, 4, 3, 3]

export const phase1B2BItems = [
  // Seongsu — primary gaps: cafe/low, indoor culture, short/low-mid budget, current Event.
  eventItem({ key: 'event-seoul-garden-expo-2026', venueKey: 'venue-seoul-forest', name: '2026 서울국제정원박람회', summary: '서울숲과 성수 일대를 잇는 167개 정원과 선형 정원을 함께 걸으며 대화할 수 있는 장기 정원 행사입니다.', category: 'walk', primary: 'walk_culture', secondary: ['exhibition_popup'], energy: 'medium', novelty: 'new', spend: 0, priceNote: '무료 관람(일부 체험 유료)', priceEvidence: 'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=156916&menuNo=200044', duration: 120, indoorOutdoor: 'outdoor', walking: 'medium', freshnessReason: '서울시 공식 보도자료에서 2026년 5월 1일부터 10월 27일까지 서울숲 일대 개최를 확인했습니다.', evidence: 'https://www.seoul.go.kr/news/news_report.do?nttNo=456708', scores: HERO, rationale: '현재성·규모·산책 동선이 분명해 성수에서 비소비형 목적 데이트로 추천할 근거가 충분합니다.', human: KEEP, validFrom: '2026-05-01T00:00:00+09:00', validUntil: '2026-10-28T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  permanentItem({ key: 'item-theclimb-seongsu', venueKey: 'venue-theclimb-seongsu', name: '더클라임 성수점', summary: '초보 강습과 난이도별 볼더링을 통해 둘이 서로 응원하며 몸을 쓰는 실내 클라이밍 공간입니다.', category: 'experience', primary: 'experience', energy: 'high', novelty: 'balanced', spend: 25000, requiredSpend: 22000, priceBasis: 'admission', priceNote: '일일 이용권과 장비 대여를 포함한 일반 방문 예상액', duration: 150, walking: 'medium', freshness: 'recent', freshnessReason: '공식 지점 링크와 2026년 7월 갱신된 운영 정보에서 성수점 운영을 확인했습니다.', evidence: 'https://linktr.ee/theclimb_life', bookingRequired: false, availability: 'walk_in_only', scores: STRONG, rationale: '게임이 아닌 성인 활동형 경험이며 둘이 함께 도전하고 응원하는 목적성이 선명합니다.', human: KEEP }),
  permanentItem({ key: 'item-redbutton-seongsu', venueKey: 'venue-redbutton-seongsu', name: '레드버튼 성수점', summary: '다양한 보드게임을 골라 둘이 협력하거나 가볍게 경쟁할 수 있는 성수 실내 보드게임 공간입니다.', category: 'entertainment', primary: 'experience', secondary: ['cafe'], energy: 'medium', novelty: 'proven', spend: 14000, requiredSpend: 9000, priceBasis: 'minimum_purchase', priceNote: '시간 이용료와 기본 음료를 포함한 일반 예상액', duration: 120, freshnessReason: '공식 브랜드 사이트와 Kakao 지점 정보에서 현재 영업을 확인했습니다.', evidence: 'https://redbutton.co.kr/', scores: STRONG, rationale: '날씨 영향을 받지 않고 1~2시간 함께 즐길 수 있어 성수의 짧은 실내 경험 공백을 채웁니다.', human: KEEP }),
  permanentItem({ key: 'item-vinyl-seongsu', venueKey: 'venue-vinyl-seongsu', name: '바이닐 성수', summary: '각자 고른 LP를 헤드폰으로 듣고 서로 음악 취향을 나눌 수 있는 목적형 음악 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'proven', spend: 18000, requiredSpend: 18000, priceBasis: 'admission', priceNote: '음료가 포함된 입장료 기준', duration: 120, freshnessReason: 'Kakao 운영 정보와 공간 이용 방식·입장료를 설명한 검수 매체를 대조했습니다.', evidence: 'https://ohou.se/advices/9748', scores: CAFE_PRIMARY, rationale: '단순 카페가 아니라 음악을 고르고 비교하는 대화 경험이 있어 low-energy primary로 설득력이 높습니다.', human: KEEP }),
  permanentItem({ key: 'item-about-the-chapter', venueKey: 'venue-about-the-chapter', name: '어바웃더챕터', summary: '책과 음악이 있는 조용한 공간에서 각자 고른 이야기를 함께 나누기 좋은 서울숲 북카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 선택 시 일반 예상액', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 현재 영업 정보와 공식 소셜 채널을 2026년 9월에 확인했습니다.', evidence: 'https://www.instagram.com/about.the.chapter/', scores: CAFE_PRIMARY, rationale: '짧고 조용한 실내 데이트 목적이 분명해 성수 카페·저에너지·1~2시간 공백을 직접 보완합니다.', human: KEEP }),
  permanentItem({ key: 'item-lafre-fruit', venueKey: 'venue-lafre-fruit', name: '라프레플루트', summary: '제철 과일을 중심으로 구성한 디저트를 함께 고르는 서울숲의 소규모 과일 디저트 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'balanced', spend: 16000, requiredSpend: 8000, priceBasis: 'minimum_purchase', priceNote: '1인 음료 또는 과일 디저트 기준', duration: 75, wait: 'medium', freshness: 'recent', freshnessReason: 'Kakao 장소 정보와 공식 운영 채널을 대조했습니다.', evidence: 'https://www.instagram.com/lafre_fruit/', scores: ALT_SCORE, rationale: '데이트 감도는 있으나 공간 자체보다 디저트 관심 의존성이 있어 대안 자격이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-ferment-seongsu', venueKey: 'venue-ferment-seongsu', name: '퍼먼트', summary: '서울숲 골목에서 발효와 제빵 콘셉트의 빵을 골라 짧게 쉬기 좋은 베이커리 공간입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'balanced', spend: 13000, requiredSpend: 5000, priceBasis: 'optional_purchase', priceNote: '빵과 음료를 함께 고를 때의 일반 예상액', duration: 60, freshness: 'recent', freshnessReason: 'Kakao 현행 장소 정보와 공식 채널에서 영업을 확인했습니다.', evidence: 'https://www.instagram.com/ferment_bakeshop/', scores: ALT_SCORE, rationale: '짧은 저예산 stop으로는 매력적이지만 하루의 단독 목적지보다는 대안에 적합합니다.', human: ALT }),
  permanentItem({ key: 'item-beton-seongsu', venueKey: 'venue-beton-seongsu', name: '베통 성수', summary: '소금빵을 중심으로 한 베이커리 콘셉트와 성수 공간 분위기를 함께 즐기는 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'balanced', spend: 13000, requiredSpend: 5000, priceBasis: 'optional_purchase', priceNote: '대표 빵과 음료 기준', duration: 60, wait: 'medium', freshness: 'recent', freshnessReason: 'Kakao 장소와 공식 소셜 채널의 최근 운영 정보를 확인했습니다.', evidence: 'https://www.instagram.com/beton.seoul/', scores: ALT_SCORE, rationale: '목적형 디저트 stop의 성격이 강하므로 강력추천보다 카페 대안에 적합합니다.', human: ALT }),
  permanentItem({ key: 'item-lowkey-seongsu', venueKey: 'venue-lowkey-seongsu', name: '로우키', summary: '로스터리의 커피 취향을 차분히 비교하며 쉬기 좋은 성수의 커피 전문 공간입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'proven', spend: 10000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '1인 음료와 선택 디저트 기준', duration: 75, freshnessReason: '공식 브랜드 사이트와 Kakao 영업 정보를 대조했습니다.', evidence: 'https://lowkeycoffee.com/', scores: ALT_SCORE, rationale: '신뢰도 높은 카페지만 공간 경험의 독특함은 제한적이어서 대안으로 유지합니다.', human: ALT }),
  permanentItem({ key: 'item-movemove-cafe', venueKey: 'venue-movemove-cafe', name: '무브모브 카페', summary: '성수의 넓은 공간과 전시형 분위기를 함께 둘러보며 쉬어 갈 수 있는 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 13000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 장소 정보와 공식 소셜 채널에서 현재 영업을 확인했습니다.', evidence: 'https://www.instagram.com/movemove_cafe/', scores: ALT_SCORE, rationale: '공간성은 있으나 다른 성수 동선과 결합할 때 더 좋은 stop 성격이라 대안이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-nudake-tea-house', venueKey: 'venue-nudake-tea-house', name: '누데이크 티 하우스', summary: '차와 조형적인 디저트를 하나의 공간 경험으로 구성한 하우스 노웨어의 목적형 티 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['experience'], energy: 'low', novelty: 'new', spend: 22000, requiredSpend: 9000, priceBasis: 'minimum_purchase', priceNote: '차와 디저트를 함께 주문할 때의 일반 예상액', duration: 90, wait: 'medium', freshness: 'recent', freshnessReason: '공식 브랜드 사이트와 Kakao 세부 지점 정보를 확인했습니다.', evidence: 'https://www.nudake.com/', scores: STRONG, rationale: '감도 높은 공간 경험이지만 하우스 노웨어 동선의 일부라는 성격과 취향 의존성 때문에 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-artirum-seongsu', venueKey: 'venue-artirum', name: '아티룸', summary: '그림 도구를 골라 각자의 작업을 만들고 서로 결과물을 보여줄 수 있는 성수 드로잉 카페입니다.', category: 'experience', primary: 'experience', secondary: ['cafe'], energy: 'low', novelty: 'balanced', spend: 20000, requiredSpend: 15000, priceBasis: 'program_fee', priceNote: '드로잉 이용과 기본 음료를 포함한 예상액', duration: 120, freshness: 'recent', freshnessReason: 'Kakao 업종·주소와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/artirum_seongsu/', bookingRequired: false, scores: STRONG, rationale: '둘이 결과물을 만들면서도 에너지가 낮아 성수의 체험·저에너지 교차 공백을 채웁니다.', human: KEEP }),
  permanentItem({ key: 'item-flodi-studio', venueKey: 'venue-flodi-studio', name: '플로디스튜디오', summary: '두 사람이 각자 도자기를 만들고 완성물을 남길 수 있는 성수의 예약형 도예 스튜디오입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 40000, requiredSpend: 40000, priceBasis: 'program_fee', priceNote: '도예 원데이 클래스 일반 가격대', duration: 120, freshnessReason: '공식 스튜디오 사이트와 Kakao 장소 정보를 대조했습니다.', evidence: 'https://flodstudio.com/', bookingRequired: true, bookingUrl: 'https://flodstudio.com/', availability: 'available', scores: HERO, rationale: '함께 결과물을 만드는 명확한 목적형 체험으로 primary 자격이 충분합니다.', human: KEEP }),
  permanentItem({ key: 'item-yuyuhui-seongsu', venueKey: 'venue-yuyuhui-seongsu', name: '담금주공방 유유히 성수', summary: '재료를 시음하고 조합해 각자의 담금주를 완성하는 성인 대상 예약형 원데이 클래스입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'new', spend: 95000, requiredSpend: 95000, priceBasis: 'program_fee', priceNote: 'KTX매거진에 소개된 원데이 클래스 비용 기준', duration: 150, freshness: 'recent', freshnessReason: 'KTX매거진의 체험·주소·가격 정보와 Kakao 운영 정보를 대조했습니다.', evidence: 'https://ktxmagazine.kr/wp-content/uploads/2025/02/2502-1.pdf', bookingRequired: true, bookingUrl: 'https://www.instagram.com/yuyuhui.seongsu/', availability: 'available', scores: HERO, rationale: '성인 커플이 취향을 조합해 결과물을 만드는 독특한 경험이지만 고예산 조건에서는 자동 제외됩니다.', human: KEEP }),
  permanentItem({ key: 'item-plavi-seongsu', venueKey: 'venue-plavi-seongsu', name: '플라비 성수점', summary: '가죽 소재와 색을 골라 둘만의 소품을 만드는 서울숲 예약형 가죽공예 공간입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 38000, requiredSpend: 35000, priceBasis: 'program_fee', priceNote: '소형 가죽 소품 원데이 클래스 예상액', duration: 120, freshnessReason: 'Kakao의 가죽공예 업종과 공식 채널의 클래스 운영을 확인했습니다.', evidence: 'https://www.instagram.com/plavi_official/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/plavi_official/', availability: 'available', scores: STRONG, rationale: '둘이 소재를 고르고 완성품을 남기는 목적형 공동 경험으로 primary에 적합합니다.', human: KEEP }),
  permanentItem({ key: 'item-lettre-seongsu', venueKey: 'venue-lettre-seongsu', name: '레트르 성수', summary: '향을 시향하고 자신의 조합을 찾는 성수의 향수 제작·브랜드 체험 공간입니다.', category: 'experience', primary: 'experience', energy: 'low', novelty: 'balanced', spend: 45000, requiredSpend: 35000, priceBasis: 'program_fee', priceNote: '향수 제작 체험의 일반 가격대', duration: 90, freshnessReason: 'Kakao 장소와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/lettre_seongsu/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/lettre_seongsu/', availability: 'available', scores: STRONG, rationale: '체험 목적은 분명하지만 향 관심 의존성이 커서 현재 질문지에서는 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-peaches-dowon', venueKey: 'venue-peaches-dowon', name: '피치스 도원', summary: '자동차 문화와 그래픽·공간 연출을 함께 둘러보는 성수의 자동차 문화 복합공간입니다.', category: 'culture', primary: 'walk_culture', secondary: ['experience'], energy: 'medium', novelty: 'balanced', spend: 10000, requiredSpend: 0, priceBasis: 'optional_purchase', priceNote: '공간 관람은 무료, 선택 구매 기준', duration: 90, freshnessReason: '공식 브랜드 사이트와 Kakao 장소 정보를 확인했습니다.', evidence: 'https://peachesoneuniverse.com/', scores: STRONG, rationale: '공간은 독특하지만 자동차 문화 관심 의존성이 있어 강력추천보다 대안이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-pubg-seongsu-playarena', venueKey: 'venue-pubg-seongsu-playarena', name: '펍지 성수 플레이아레나', summary: 'PUBG 세계관과 게임 플레이를 오프라인 공간에서 경험하는 성수의 게임 문화 체험장입니다.', category: 'entertainment', primary: 'experience', energy: 'high', novelty: 'new', spend: 10000, requiredSpend: 0, priceBasis: 'optional_purchase', priceNote: '프로그램별 무료 또는 선택 구매 기준', duration: 120, freshness: 'recent', freshnessReason: 'Kakao의 플레이아레나 별도 장소와 공식 PUBG 채널을 확인했습니다.', evidence: 'https://pubg.com/ko/', scores: STRONG, rationale: '현재성과 활동성은 높지만 특정 게임 관심 의존성이 커 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-snowrabbit-seongsu', venueKey: 'venue-snowrabbit-seongsu', name: '보드게임카페 스노우래빗', summary: '서울숲에서 둘이 짧게 보드게임을 고르고 즐길 수 있는 소규모 실내 보드게임 카페입니다.', category: 'entertainment', primary: 'experience', secondary: ['cafe'], energy: 'medium', novelty: 'balanced', spend: 12000, requiredSpend: 8000, priceBasis: 'minimum_purchase', priceNote: '시간 이용과 음료 기준', duration: 120, freshness: 'recent', freshnessReason: 'Kakao 현행 장소 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/snowrabbit_boardgame/', scores: ALT_SCORE, rationale: '짧은 실내 대안으로 유용하지만 차별성이 제한되어 primary로 승격하지 않습니다.', human: ALT }),
  permanentItem({ key: 'item-samjakso', venueKey: 'venue-samjakso', name: '삼작소', summary: '흙을 다루며 각자의 그릇이나 오브제를 만드는 성수의 소규모 도자기 공방입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 38000, requiredSpend: 35000, priceBasis: 'program_fee', priceNote: '도자기 원데이 클래스 예상액', duration: 120, freshnessReason: 'Kakao 도자기공방 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/samjakso/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/samjakso/', availability: 'available', scores: STRONG, rationale: '둘이 함께 결과물을 만드는 명확한 1~2시간 체험이어서 primary 자격이 충분합니다.', human: KEEP }),
  permanentItem({ key: 'item-maison-liliane', venueKey: 'venue-maison-liliane', name: '메종릴리앙', summary: '향과 공예 수업을 운영하는 서울숲 인근 소규모 스튜디오 후보입니다.', category: 'experience', primary: 'experience', energy: 'low', novelty: 'new', spend: 45000, requiredSpend: 40000, priceBasis: 'program_fee', priceNote: '클래스별 가격 재검수 필요', duration: 120, freshness: 'recent', freshnessReason: 'Kakao 장소는 확인했지만 2026년 클래스 상세·예약 가능 회차의 독립 근거가 부족합니다.', evidence: 'https://www.instagram.com/maison_liliane/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/maison_liliane/', availability: 'available', scores: STRONG, rationale: '장소 존재는 확인했으나 현재 클래스 구성과 예약 가능성을 재검수할 때까지 결과에서 제외합니다.', human: HOLD }),
  permanentItem({ key: 'item-the-seouliteum', venueKey: 'venue-the-seouliteum', name: '더서울라이티움', summary: '서울숲 인근에서 미디어아트와 기획 전시를 운영하는 전시관 후보입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 20000, requiredSpend: 0, priceBasis: 'variable', priceNote: '전시별 가격이 달라 현재 Event 확인 필요', duration: 120, freshness: 'recent', freshnessReason: 'Venue 운영은 확인했지만 2026년 9월 현재 방문 목적이 되는 구체 Event 근거가 부족합니다.', evidence: 'https://www.instagram.com/theseouliteum/', availability: 'unknown', scores: STRONG, rationale: 'Venue만으로 primary를 만들지 않고 구체 Event가 확인될 때까지 research hold로 유지합니다.', human: HOLD, status: 'inactive' }),
  permanentItem({ key: 'item-laoc-seongsu', venueKey: 'venue-laoc-seongsu', name: '라오크 성수점', summary: '서울숲에서 향을 시향하고 취향을 비교해 볼 수 있는 향 브랜드 체험 공간입니다.', category: 'experience', primary: 'experience', energy: 'low', novelty: 'balanced', spend: 25000, requiredSpend: 0, priceBasis: 'optional_purchase', priceNote: '시향은 무료, 제품 구매는 선택', duration: 60, freshness: 'recent', freshnessReason: 'Kakao 지점 정보와 공식 브랜드 채널을 확인했습니다.', evidence: 'https://www.instagram.com/laoc_official/', scores: ALT_SCORE, rationale: '짧은 실내 stop으로는 유용하지만 향 관심 의존성과 구매 공간 성격 때문에 대안으로 제한합니다.', human: ALT }),

  // Hongdae / Yeonnam — current Event, calm indoor culture, music/creation, short low-budget.
  eventItem({ key: 'event-attack-on-titan-final-hongdae-2026', venueKey: 'venue-duex-hongdae', name: '진격의 거인展 FINAL', summary: '복제 원화·영상·입체 전시와 작품 속 공간 재현을 함께 보는 DUEX 홍대의 장기 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'medium', novelty: 'new', spend: 26000, requiredSpend: 26000, priceNote: '성인 입장권 26,000원', priceEvidence: 'https://tickets.interpark.com/contents/notice/detail/14032', duration: 120, walking: 'medium', freshnessReason: '2026년 6월 19일부터 11월 1일까지의 전시 기간과 장소·가격을 현재 행사 안내에서 확인했습니다.', evidence: 'https://dueple.tistory.com/23', evidenceKind: 'trusted_current_listing', availability: 'available', scores: HERO, rationale: '규모와 현재성은 충분하지만 작품 팬덤 관심 의존성이 커 Human Gate에서는 대안으로 제한합니다.', human: ALT, validFrom: '2026-06-19T00:00:00+09:00', validUntil: '2026-11-02T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-detective-conan-30th-hongdae-2026', venueKey: 'venue-ak-plaza-hongdae', name: '명탐정 코난 TV 애니메이션 30주년 기념전', summary: '기획·콘티·작화·더빙·주제가를 따라 애니메이션 제작과 30년 역사를 보는 홍대 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 20000, requiredSpend: 0, priceBasis: 'variable', priceNote: '예매처 가격 재확인 대상', duration: 90, freshnessReason: '2026년 8월 12일부터 11월 29일까지 AK플라자 홍대 오뮤지엄 운영을 현재 행사 안내에서 확인했습니다.', evidence: 'https://dueple.tistory.com/23', evidenceKind: 'trusted_current_listing', availability: 'available', scores: HERO, rationale: '현재 진행 전시이나 특정 팬덤 관심을 질문하지 않는 V1에서는 대안 자격이 안전합니다.', human: ALT, validFrom: '2026-08-12T00:00:00+09:00', validUntil: '2026-11-30T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  permanentItem({ key: 'item-ktng-cinema-hongdae', venueKey: 'venue-ktng-cinema-hongdae', name: 'KT&G 상상마당 시네마', summary: '독립·예술영화와 기획전을 골라 보고 상영 후 이야기를 나누기 좋은 홍대 영화관입니다.', category: 'culture', primary: 'walk_culture', secondary: ['exhibition_popup'], energy: 'low', novelty: 'balanced', spend: 15000, requiredSpend: 12000, priceBasis: 'admission', priceNote: '일반 영화 관람료 기준', duration: 150, freshnessReason: '공식 상상마당 사이트와 Kakao 영화관 정보를 확인했습니다.', evidence: 'https://www.sangsangmadang.com/', scores: STRONG, rationale: '콘텐츠 선택이 필요해 당일 상영 확인이 선행되어야 하므로 대안 중심이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-channel-1969', venueKey: 'venue-channel-1969', name: '채널1969', summary: '소규모 라이브 공연을 가까이서 보고 함께 새로운 음악을 발견할 수 있는 연남 공연 공간입니다.', category: 'culture', primary: 'experience', secondary: ['walk_culture'], energy: 'medium', novelty: 'balanced', spend: 25000, requiredSpend: 15000, priceBasis: 'admission', priceNote: '공연별 입장료 범위의 일반 예상액', duration: 150, freshness: 'recent', freshnessReason: '2026년 공연 이력과 Kakao 공연장 정보를 확인했습니다.', evidence: 'https://web.ducksticket.com/venue/1274', availability: 'available', scores: STRONG, rationale: '게임이 아닌 음악 공동 경험이며 작은 공연의 대화거리와 목적성이 분명합니다.', human: KEEP }),
  permanentItem({ key: 'item-liveclub-bbang', venueKey: 'venue-liveclub-bbang', name: '라이브클럽 빵', summary: '홍대 인디 음악을 가까운 거리에서 함께 듣는 오래된 소규모 라이브클럽입니다.', category: 'culture', primary: 'experience', secondary: ['walk_culture'], energy: 'medium', novelty: 'proven', spend: 25000, requiredSpend: 15000, priceBasis: 'admission', priceNote: '공연별 입장료 예상 범위', duration: 150, freshnessReason: 'Kakao 라이브카페 정보와 공식 공연 채널을 확인했습니다.', evidence: 'https://www.instagram.com/cafe_bbang/', availability: 'available', scores: STRONG, rationale: '홍대다운 비게임 공동 경험과 대화거리가 분명해 primary 자격을 유지합니다.', human: KEEP }),
  permanentItem({ key: 'item-jebi-dabang', venueKey: 'venue-jebi-dabang', name: '제비다방', summary: '낮에는 카페, 공연 시간에는 가까운 라이브 공간으로 바뀌어 음악과 대화를 함께 즐기는 장소입니다.', category: 'cafe', primary: 'cafe', secondary: ['experience', 'walk_culture'], energy: 'medium', novelty: 'proven', spend: 18000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 공연 운영 방식에 따른 일반 예상액', duration: 120, freshnessReason: 'Kakao 테마카페 정보와 공식 공연 채널을 확인했습니다.', evidence: 'https://www.instagram.com/jebidabang/', scores: CAFE_PRIMARY, rationale: '목적형 카페와 음악 경험을 함께 제공해 홍대의 비게임·카페 primary 공백을 채웁니다.', human: KEEP }),
  permanentItem({ key: 'item-sannullim-small-theater', venueKey: 'venue-sannullim-small-theater', name: '소극장산울림', summary: '대형 상업극장보다 가까운 거리에서 연극을 보고 이야기를 이어가기 좋은 홍대 소극장입니다.', category: 'culture', primary: 'experience', secondary: ['walk_culture'], energy: 'low', novelty: 'proven', spend: 35000, requiredSpend: 25000, priceBasis: 'admission', priceNote: '공연별 일반 티켓 예상액', duration: 150, freshnessReason: '공식 극장 사이트와 Kakao 공연장 정보를 확인했습니다.', evidence: 'https://sannullim.com/', availability: 'available', scores: STRONG, rationale: '공연 선택과 시간 의존성이 있어 현재 V1에서는 대안으로 활용합니다.', human: ALT }),
  permanentItem({ key: 'item-rolling-hall', venueKey: 'venue-rolling-hall', name: '롤링홀', summary: '밴드와 뮤지션 공연을 중심으로 홍대 라이브 음악의 현장감을 함께 즐기는 공연장입니다.', category: 'culture', primary: 'experience', energy: 'high', novelty: 'proven', spend: 45000, requiredSpend: 30000, priceBasis: 'admission', priceNote: '공연별 티켓 가격 범위', duration: 180, freshnessReason: '공식 공연장 사이트와 Kakao 정보를 확인했습니다.', evidence: 'https://rollinghall.co.kr/', availability: 'available', scores: STRONG, rationale: '목적형 음악 공간이지만 공연 편성에 따른 관심 의존성이 있어 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-musinsa-garage', venueKey: 'venue-musinsa-garage', name: '무신사 개러지', summary: '다양한 장르의 공연을 가까운 무대에서 경험하는 홍대의 라이브 공연장입니다.', category: 'culture', primary: 'experience', energy: 'high', novelty: 'balanced', spend: 45000, requiredSpend: 30000, priceBasis: 'admission', priceNote: '공연별 티켓 예상액', duration: 180, freshness: 'recent', freshnessReason: '공식 공연장 사이트와 Kakao 공연 정보를 확인했습니다.', evidence: 'https://www.musinsagarage.com/', availability: 'available', scores: STRONG, rationale: '최신 공연장은 맞지만 출연진 취향을 질문하지 않는 V1에서는 대안이 안전합니다.', human: ALT }),
  permanentItem({ key: 'item-west-bridge-live-hall', venueKey: 'venue-west-bridge-live-hall', name: '웨스트브릿지 라이브홀', summary: '인디 뮤지션과 쇼케이스를 가까이서 함께 보는 홍대 라이브홀입니다.', category: 'culture', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 35000, requiredSpend: 20000, priceBasis: 'admission', priceNote: '공연별 티켓 예상액', duration: 150, freshnessReason: 'Kakao 공연장 정보와 공식 편성 채널을 확인했습니다.', evidence: 'https://www.instagram.com/westbridge_livehall/', availability: 'available', scores: ALT_SCORE, rationale: '공연 자체는 목적형이지만 당일 편성 관심을 확인할 수 없어 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-indiespace-hongdae', venueKey: 'venue-indiespace-hongdae', name: '인디스페이스', summary: '독립영화를 고르고 관람 뒤 서로 다른 감상을 이야기하기 좋은 홍대 독립영화관입니다.', category: 'culture', primary: 'walk_culture', secondary: ['exhibition_popup'], energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 10000, priceBasis: 'admission', priceNote: '일반 관람료 기준', duration: 150, freshnessReason: '공식 영화관 사이트와 Kakao 장소 정보를 확인했습니다.', evidence: 'https://indiespace.kr/', scores: STRONG, rationale: '저예산·차분한 실내 문화 경험과 관람 후 대화가 명확해 primary에 적합합니다.', human: KEEP }),
  permanentItem({ key: 'item-cinemapo', venueKey: 'venue-cinemapo', name: '씨네마포', summary: '영화 관련 책과 소품을 둘러보고 음료와 함께 영화 취향을 나누는 목적형 시네마 카페입니다.', category: 'cafe', primary: 'walk_culture', secondary: ['cafe', 'exhibition_popup'], energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 선택 구매 기준', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 테마카페 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/cinemapo/', scores: CAFE_PRIMARY, rationale: '카페·전시 취향을 함께 중재할 수 있는 짧은 실내 문화 목적지로 primary가 설득력 있습니다.', human: KEEP }),
  permanentItem({ key: 'item-grim-production-yeonnam', venueKey: 'venue-grim-production-yeonnam', name: '그림제작소 연남점', summary: '준비된 재료로 각자의 그림을 완성하고 서로 작품을 보여주는 연남 드로잉 카페입니다.', category: 'experience', primary: 'experience', secondary: ['cafe'], energy: 'low', novelty: 'balanced', spend: 22000, requiredSpend: 18000, priceBasis: 'program_fee', priceNote: '드로잉 이용과 음료 예상액', duration: 120, freshness: 'recent', freshnessReason: 'Kakao 장소와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/grimfactory_official/', scores: STRONG, rationale: '게임이 아니면서 결과물을 함께 남기는 low-energy 목적형 체험입니다.', human: KEEP }),
  permanentItem({ key: 'item-dotori-caricature-yeonnam', venueKey: 'venue-dotori-caricature-yeonnam', name: '도토리캐리커쳐 연남본점', summary: '짧은 시간 서로의 캐리커처를 남겨 데이트 기념물을 만들 수 있는 연남 공방입니다.', category: 'experience', primary: 'experience', energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 9000, priceBasis: 'program_fee', priceNote: '인원·옵션별 캐리커처 일반 예상액', duration: 45, freshness: 'recent', freshnessReason: 'Kakao 공방 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/dotori_caricature/', availability: 'walk_in_only', scores: ALT_SCORE, rationale: '기념 stop으로는 좋지만 체류시간이 짧아 대안 자격이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-ahyeon-pottery', venueKey: 'venue-ahyeon-pottery', name: '아현공방', summary: '연남에서 흙을 빚어 각자의 도자기 결과물을 만드는 예약형 도예 공방입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 40000, requiredSpend: 40000, priceBasis: 'program_fee', priceNote: '도예 원데이 클래스 예상액', duration: 120, freshnessReason: 'Kakao 도자기공방 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/ahyeon_ceramic/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/ahyeon_ceramic/', availability: 'available', scores: HERO, rationale: '둘이 함께 결과물을 만드는 명확한 비게임 목적형 체험입니다.', human: KEEP }),
  permanentItem({ key: 'item-piece-to-you', venueKey: 'venue-piece-to-you', name: '피스투유', summary: '색과 형태를 고르며 두 사람이 각자의 도자기를 만드는 연남 소규모 도예 공간입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'new', spend: 40000, requiredSpend: 40000, priceBasis: 'program_fee', priceNote: '원데이 클래스 예상액', duration: 120, freshness: 'recent', freshnessReason: 'Kakao 도자기공방 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/piece_to_you/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/piece_to_you/', availability: 'available', scores: HERO, rationale: '현재 감도와 공동 제작 목적이 분명해 new·비게임 경험 primary로 적합합니다.', human: KEEP }),
  permanentItem({ key: 'item-vessel-studio-blossom', venueKey: 'venue-vessel-studio-blossom', name: '그릇공방 플로썸', summary: '연남 골목에서 작은 그릇과 도자기를 만들어 보는 예약형 공방입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'balanced', spend: 40000, requiredSpend: 40000, priceBasis: 'program_fee', priceNote: '클래스별 일반 예상액', duration: 120, freshnessReason: 'Kakao 공방 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/flosom_pottery/', bookingRequired: true, bookingUrl: 'https://www.instagram.com/flosom_pottery/', availability: 'available', scores: ALT_SCORE, rationale: '좋은 제작 경험이지만 유사 공방 대비 목적지 차별성은 낮아 대안으로 둡니다.', human: ALT }),
  permanentItem({ key: 'item-book-gopsem', venueKey: 'venue-book-gopsem', name: '책방곱셈', summary: '작은 책방과 카페 공간에서 서로 고른 책을 나누며 쉬기 좋은 연남 북카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 10000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '음료와 선택 도서 구매 기준', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 북카페 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/bookshop_gopsem/', scores: CAFE_PRIMARY, rationale: '차분한 실내 문화와 대화 목적이 뚜렷해 홍대·연남의 low-energy primary로 적합합니다.', human: KEEP }),
  permanentItem({ key: 'item-booknook-yeonnam', venueKey: 'venue-booknook-yeonnam', name: '북눅 연남', summary: '책을 읽고 각자의 문장을 고르며 잠시 쉬기 좋은 연남의 조용한 북카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 10000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '음료 기준', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 북카페 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/booknook_yeonnam/', scores: ALT_SCORE, rationale: '차분한 stop으로 좋지만 목적지 차별성 근거는 제한되어 대안으로 유지합니다.', human: ALT }),
  permanentItem({ key: 'item-1984-hongdae', venueKey: 'venue-1984-hongdae', name: '1984', summary: '디자인 서적과 전시형 진열을 둘러보고 커피를 마시며 취향을 나누는 홍대 북카페입니다.', category: 'culture', primary: 'walk_culture', secondary: ['cafe'], energy: 'low', novelty: 'proven', spend: 10000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '음료와 선택 구매 기준', duration: 90, freshnessReason: 'Kakao 북카페 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/1984_store/', scores: STRONG, rationale: '카페 veto에도 남는 실내 walk/culture 목적지이며 짧고 저예산인 primary 후보입니다.', human: KEEP }),
  permanentItem({ key: 'item-kokorokara', venueKey: 'venue-kokorokara', name: '코코로카라', summary: '푸딩과 구움과자처럼 선명한 디저트 취향을 함께 고르는 연남 베이커리입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 5000, priceBasis: 'optional_purchase', priceNote: '디저트와 음료 일반 예상액', duration: 60, wait: 'medium', freshnessReason: 'Kakao 장소와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/kokorokara/', scores: ALT_SCORE, rationale: '디저트 stop으로는 매력적이지만 단독 데이트 목적지보다는 대안이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-cafe-gongmyung-yeonnam', venueKey: 'venue-cafe-gongmyung-yeonnam', name: '카페공명 연남점', summary: '넓은 서가와 차분한 공간에서 대화를 이어가기 좋은 연남의 목적형 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, freshness: 'recent', freshnessReason: 'Kakao 지점 정보와 공식 브랜드 채널을 확인했습니다.', evidence: 'https://www.instagram.com/cafe_gongmyoung/', scores: CAFE_PRIMARY, rationale: '쉬기·카페 선호를 직접 충족하면서 공간 경험도 있어 primary로 설득력이 있습니다.', human: KEEP }),
  permanentItem({ key: 'item-club-onair', venueKey: 'venue-club-onair', name: '클럽온에어', summary: '뮤지션 공연과 방송형 라이브 콘텐츠를 운영하는 홍대 공연 공간 후보입니다.', category: 'culture', primary: 'experience', energy: 'medium', novelty: 'new', spend: 30000, requiredSpend: 0, priceBasis: 'variable', priceNote: '공연별 가격과 입장 방식 재검수 필요', duration: 150, freshness: 'recent', freshnessReason: 'Venue는 확인했지만 2026년 9월 일반 관객용 편성과 예약 근거가 충분하지 않습니다.', evidence: 'https://www.instagram.com/clubonair/', availability: 'unknown', scores: STRONG, rationale: '일반 관객이 오늘 선택할 수 있는 편성 근거가 확보될 때까지 모든 추천에서 보류합니다.', human: HOLD, status: 'inactive' }),
  permanentItem({ key: 'item-gonjung-camp', venueKey: 'venue-gonjung-camp', name: '공중캠프', summary: '라이브와 상영을 함께 운영하는 홍대의 소규모 문화공간 후보입니다.', category: 'culture', primary: 'experience', secondary: ['cafe'], energy: 'medium', novelty: 'balanced', spend: 25000, requiredSpend: 0, priceBasis: 'variable', priceNote: '프로그램별 가격 재검수 필요', duration: 120, freshnessReason: 'Kakao 장소는 확인했지만 현재 프로그램·일반 입장 방식의 근거가 부족합니다.', evidence: 'https://www.instagram.com/kuchu_camp/', availability: 'unknown', scores: STRONG, rationale: '공간 정체성은 좋지만 오늘 방문 가능한 구체 프로그램 근거가 생길 때까지 research hold로 둡니다.', human: HOLD, status: 'inactive' }),

  // Jongno / Euljiro — Event-first exhibitions, purpose cafes, low/medium indoor and short budget.
  eventItem({ key: 'event-arko-art-of-learning-2026', venueKey: 'venue-arko-art-center', name: '《예술 학교: 우리가 서로의 학교가 될 때》', summary: '예술가 모임과 독립적인 배움의 방식을 전시·워크숍으로 경험하는 아르코미술관 주제기획전입니다.', category: 'exhibition', primary: 'exhibition_popup', secondary: ['experience'], energy: 'low', novelty: 'new', spend: 0, priceNote: '무료 관람', priceEvidence: 'https://www.arko.or.kr/artcenter/board/view/506?bid=266&category=exhibition&cid=717549&dateLocation=now', duration: 120, freshnessReason: '아르코 공식 페이지에서 2026년 8월 7일부터 9월 27일까지 무료 전시와 연계 프로그램을 확인했습니다.', evidence: 'https://www.arko.or.kr/artcenter/board/view/506?bid=266&category=exhibition&cid=717549&dateLocation=now', availability: 'available', scores: HERO, rationale: '현재 Event·무료·1~2시간·대화와 참여 요소가 모두 분명해 primary 가치가 높습니다.', human: KEEP, validFrom: '2026-08-07T00:00:00+09:00', validUntil: '2026-09-28T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-museum-hanmi-enter-roger-ballen-2026', venueKey: 'venue-museum-hanmi-samcheong', name: 'Museum B1: Enter Roger Ballen', summary: '로저 발렌의 강렬한 사진 세계를 지하 전시 공간에서 집중해 보는 뮤지엄한미 삼청 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 15000, requiredSpend: 10000, priceBasis: 'admission', priceNote: '뮤지엄한미 일반 관람 예상액', duration: 90, freshnessReason: '뮤지엄한미 공식 현재전시에서 2026년 9월 1일부터 30일까지의 일정을 확인했습니다.', evidence: 'https://museumhanmi.or.kr/en/location/samchung/?pgs=1', availability: 'available', scores: HERO, rationale: '구체적인 사진 Event와 공간성이 결합되어 차분한 실내 데이트 primary로 충분합니다.', human: KEEP, validFrom: '2026-09-01T00:00:00+09:00', validUntil: '2026-10-01T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-museum-hanmi-vogue-into-art-2026', venueKey: 'venue-museum-hanmi-samcheong', name: 'Vogue into Art', summary: '패션 이미지와 사진 예술의 관계를 함께 살펴보는 뮤지엄한미 삼청의 9월 기획 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 15000, requiredSpend: 10000, priceBasis: 'admission', priceNote: '뮤지엄한미 일반 관람 예상액', duration: 90, freshnessReason: '뮤지엄한미 공식 현재전시에서 2026년 9월 1일부터 30일까지의 일정을 확인했습니다.', evidence: 'https://museumhanmi.or.kr/en/location/samchung/?pgs=1', availability: 'available', scores: HERO, rationale: '패션과 사진이라는 대화 소재가 선명하고 current Event 근거가 충분해 primary로 유지합니다.', human: KEEP, validFrom: '2026-09-01T00:00:00+09:00', validUntil: '2026-10-01T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-museum-hanmi-uelsmann-preview-2026', venueKey: 'venue-museum-hanmi-annex', name: 'Preview: Jerry Uelsmann Memorial Hall, Gimpo', summary: '제리 율스만 기념관 개관 전 작품 세계를 먼저 만나는 뮤지엄한미 삼청별관 프리뷰 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 10000, requiredSpend: 0, priceBasis: 'variable', priceNote: '별관 관람료 현장 재확인', duration: 60, freshnessReason: '뮤지엄한미 공식 페이지에서 2026년 5월 22일부터 9월 30일까지의 전시를 확인했습니다.', evidence: 'https://museumhanmi.or.kr/en/location/samchung/?pgs=1', availability: 'available', scores: STRONG, rationale: '짧은 사진 전시 stop으로 좋지만 본관의 두 Event보다 목적성이 약해 대안으로 둡니다.', human: ALT, validFrom: '2026-05-22T00:00:00+09:00', validUntil: '2026-10-01T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-sehwa-georg-baselitz-2026', venueKey: 'venue-sehwa-museum', name: '게오르그 바젤리츠', summary: '독일 현대미술 거장의 회화 세계를 광화문 세화미술관에서 집중해 보는 장기 기획전입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 15000, requiredSpend: 10000, priceBasis: 'admission', priceNote: '일반 기획전 관람 예상액', duration: 120, freshnessReason: '대한민국 미술축제 현재 전시 목록에서 2026년 8월 13일부터 12월 27일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: HERO, rationale: '전시 규모·작가성·운영기간이 명확해 Event 단위 primary로 충분합니다.', human: KEEP, validFrom: '2026-08-13T00:00:00+09:00', validUntil: '2026-12-28T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-culture-station-design-of-care-2026', venueKey: 'venue-culture-station-284', name: '《돌봄의 디자인》', summary: '돌봄을 디자인 관점으로 풀어낸 설치와 기획 콘텐츠를 옛 서울역 공간에서 보는 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', secondary: ['walk_culture'], energy: 'low', novelty: 'new', spend: 0, priceNote: '무료 관람', priceEvidence: 'https://www.seoul284.org/cms/content/view/250', duration: 120, walking: 'medium', freshnessReason: '대한민국 미술축제 목록에서 2026년 9월 7일부터 11월 1일까지의 운영을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: HERO, rationale: '공간과 주제가 선명한 무료 Event이지만 9월 7일 전에는 Operational Gate가 자동 차단합니다.', human: KEEP, validFrom: '2026-09-07T00:00:00+09:00', validUntil: '2026-11-02T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-kumho-park-hyesoo-2026', venueKey: 'venue-kumho-museum', name: '박혜수 《사람들은 진실에 관심이 없다》', summary: '진실과 믿음의 간극을 설치·아카이브로 탐구하며 둘이 관점을 나눌 수 있는 금호미술관 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 10000, requiredSpend: 5000, priceBasis: 'admission', priceNote: '미술관 관람 예상액', duration: 120, freshnessReason: '대한민국 미술축제 목록에서 2026년 8월 7일부터 10월 18일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: HERO, rationale: '현재 Event와 대화 주제가 분명하고 저예산·1~2시간 조건에 맞아 primary에 적합합니다.', human: KEEP, validFrom: '2026-08-07T00:00:00+09:00', validUntil: '2026-10-19T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-mmca-suh-do-ho-2026', venueKey: 'venue-mmca-seoul', name: '서도호', summary: '집·이동·기억을 다룬 서도호의 작업을 국립현대미술관 서울에서 넉넉히 보는 대형 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 5000, requiredSpend: 0, priceBasis: 'admission', priceNote: '전시별 관람료 또는 통합 관람권 기준', duration: 180, walking: 'medium', freshnessReason: '대한민국 미술축제 목록에서 2026년 8월 27일부터 2027년 2월 9일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: HERO, rationale: '현재 진행 대형 Event와 커플 대화 가치가 분명해 Venue 일반 Item보다 primary 우선 가치가 높습니다.', human: KEEP, validFrom: '2026-08-27T00:00:00+09:00', validUntil: '2027-02-10T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-sejong-hoban-art-prize-2026', venueKey: 'venue-sejong-art-museum', name: '2026 호반미술상 이수경 《아직, 이제는, 여전히》', summary: '깨진 도자기 조각을 새로운 조형으로 잇는 이수경의 작업을 보는 세종미술관 기획전입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 0, priceNote: '무료 관람', priceEvidence: 'https://www.sejongpac.or.kr/portal/performance/performance/performTicket.do?menuNo=200558&performIdx=37607', duration: 90, freshnessReason: '대한민국 미술축제 목록에서 2026년 9월 4일부터 27일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: HERO, rationale: '공예적 조형과 이야기성이 선명하지만 개막 전에는 Operational Gate가 자동 차단합니다.', human: KEEP, validFrom: '2026-09-04T00:00:00+09:00', validUntil: '2026-09-28T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-kcdf-craft-design-competition-2026', venueKey: 'venue-kcdf-gallery', name: '2026 KCDF 공예·디자인 공모전시', summary: '새로운 공예와 디자인 작업을 인사동에서 무료로 비교해 보는 KCDF 공모 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', secondary: ['walk_culture'], energy: 'low', novelty: 'new', spend: 0, priceNote: '무료 관람', priceEvidence: 'https://www.kcdf.or.kr/brd/board/322/L/menu/291?bbIdx=9145&brdCodeValue=&brdType=R&thisPage=1', duration: 90, freshnessReason: '대한민국 미술축제 목록에서 2026년 9월 1일부터 30일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: STRONG, rationale: '무료·짧은 현재 Event로 대화 가치는 높지만 공모전 성격상 규모 편차를 고려해 primary로는 보수적으로 유지합니다.', human: KEEP, validFrom: '2026-09-01T00:00:00+09:00', validUntil: '2026-10-01T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  eventItem({ key: 'event-park-no-soo-mountain-objects-2026', venueKey: 'venue-park-no-soo-museum', name: '《산수·격물》', summary: '서촌의 근대 가옥과 박노수의 산수 작품을 함께 보는 개관 12주년 장기 전시입니다.', category: 'exhibition', primary: 'exhibition_popup', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 3000, requiredSpend: 3000, priceBasis: 'admission', priceNote: '미술관 일반 관람료 기준', duration: 90, freshnessReason: '대한민국 미술축제 목록에서 2025년 9월 19일부터 2026년 12월 6일까지의 일정을 확인했습니다.', evidence: 'https://www.k-artfestival.com/curation/curation', availability: 'available', scores: STRONG, rationale: '전시와 서촌 공간이 결합되고 저예산·짧은 시간에 적합해 primary로 유지합니다.', human: KEEP, validFrom: '2025-09-19T00:00:00+09:00', validUntil: '2026-12-07T00:00:00+09:00', reviewDue: '2026-09-15T00:00:00+09:00' }),
  permanentItem({ key: 'item-chungsudang-bakery', venueKey: 'venue-chungsudang-bakery', name: '청수당 베이커리', summary: '수경과 한옥형 공간 연출 속에서 디저트를 즐기는 익선동의 콘셉트 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'proven', spend: 16000, requiredSpend: 7000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, wait: 'high', freshnessReason: 'Kakao 테마카페 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/cheongsudang_/', scores: STRONG, rationale: '공간 목적성은 높지만 긴 웨이팅 위험이 있어 대안으로 두고 veto 시 자동 제외합니다.', human: ALT }),
  permanentItem({ key: 'item-dotori-garden-anguk', venueKey: 'venue-dotori-garden-anguk', name: '도토리가든 안국점', summary: '캐릭터와 베이커리 연출이 뚜렷한 한옥 공간에서 디저트를 고르는 안국 콘셉트 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'balanced', spend: 16000, requiredSpend: 7000, priceBasis: 'minimum_purchase', priceNote: '음료와 베이커리 기준', duration: 90, wait: 'high', freshness: 'recent', freshnessReason: 'Kakao 장소 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/dotori__garden/', scores: STRONG, rationale: '공간 감도는 높지만 웨이팅과 캐릭터 취향 의존성 때문에 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-layered-anguk', venueKey: 'venue-layered-anguk', name: '카페레이어드 안국점', summary: '한옥과 영국식 베이커리 연출 속에서 케이크를 골라 쉬기 좋은 안국 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'proven', spend: 15000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 베이커리 기준', duration: 75, wait: 'high', freshnessReason: 'Kakao 테마카페 정보와 공식 브랜드 채널을 확인했습니다.', evidence: 'https://www.instagram.com/cafe_layered/', scores: ALT_SCORE, rationale: '유명하고 안정적이지만 웨이팅과 익숙함이 있어 강력추천보다 대안이 적절합니다.', human: ALT }),
  permanentItem({ key: 'item-soha-saltpond-ikseon', venueKey: 'venue-soha-saltpond-ikseon', name: '소하염전 익선점', summary: '소금과 염전 이미지를 공간·베이커리로 풀어낸 익선동의 목적형 콘셉트 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 14000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 소금빵 기준', duration: 90, wait: 'medium', freshness: 'recent', freshnessReason: 'Kakao 장소 정보와 공식 브랜드 채널을 확인했습니다.', evidence: 'https://www.instagram.com/soha_saltpond/', scores: CAFE_PRIMARY, rationale: '공간과 메뉴 콘셉트가 분명하고 1~2시간 저예산 카페 primary로 활용할 수 있습니다.', human: KEEP }),
  permanentItem({ key: 'item-osulloc-bukchon', venueKey: 'venue-osulloc-bukchon', name: '오설록티하우스 북촌점', summary: '차를 시향하고 골라 한옥 공간에서 천천히 즐기는 북촌의 목적형 티하우스입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 18000, requiredSpend: 9000, priceBasis: 'minimum_purchase', priceNote: '차와 디저트 기준', duration: 90, wait: 'medium', freshnessReason: '공식 브랜드 사이트와 Kakao 지점 정보를 확인했습니다.', evidence: 'https://www.osulloc.com/', scores: CAFE_PRIMARY, rationale: '차 선택과 공간 경험이 함께 있어 종로의 low-energy 카페 primary로 설득력이 있습니다.', human: KEEP }),
  permanentItem({ key: 'item-hyemindang', venueKey: 'venue-hyemindang', name: '혜민당', summary: '옛 건물의 질감과 디저트를 함께 즐기며 대화를 나누기 좋은 을지로 콘셉트 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'proven', spend: 12000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, wait: 'medium', freshnessReason: 'Kakao 테마카페 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/hyemindang/', scores: CAFE_PRIMARY, rationale: '공간 정체성과 접근성이 분명해 종로·을지로 카페 primary 공백을 보완합니다.', human: KEEP }),
  permanentItem({ key: 'item-teong', venueKey: 'venue-teong', name: '텅', summary: '창덕궁 인근의 절제된 공간에서 음료와 전시형 분위기를 함께 즐기는 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 12000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, wait: 'low', freshness: 'recent', freshnessReason: 'Kakao 현재 장소 정보와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/tung_seoul/', scores: CAFE_PRIMARY, rationale: '긴 웨이팅 veto에도 남는 차분한 실내 카페 primary로 S14 공백을 직접 보완합니다.', human: KEEP }),
  permanentItem({ key: 'item-horangi-euljiro', venueKey: 'venue-horangi-euljiro', name: '호랑이', summary: '을지로의 산업적 건물 분위기와 커피를 짧게 경험하는 로컬 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'proven', spend: 9000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '음료 기준', duration: 60, wait: 'medium', freshnessReason: 'Kakao 현재 장소와 공식 운영 채널을 확인했습니다.', evidence: 'https://www.instagram.com/horangiicoffee/', scores: ALT_SCORE, rationale: '짧고 저예산인 장점은 있지만 단독 목적지보다는 을지로 동선의 대안 stop에 가깝습니다.', human: ALT }),
  permanentItem({ key: 'item-seoul-coffee-ikseon', venueKey: 'venue-seoul-coffee-ikseon', name: '서울커피 익선점', summary: '한옥 공간과 레트로 디저트를 함께 즐기는 익선동의 카페입니다.', category: 'cafe', primary: 'cafe', energy: 'low', novelty: 'proven', spend: 12000, requiredSpend: 5000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 75, wait: 'medium', freshnessReason: 'Kakao 지점 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/seoulcoffee1945/', scores: ALT_SCORE, rationale: '데이트 stop으로 안정적이지만 익숙함과 상권 공통성이 있어 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-dynamic-maze-insadong', venueKey: 'venue-dynamic-maze-insadong', name: '다이나믹메이즈 서울인사동점', summary: '둘이 몸을 움직이고 협력해 장애물과 미션을 통과하는 인사동 실내 체험 공간입니다.', category: 'entertainment', primary: 'experience', energy: 'high', novelty: 'proven', spend: 15000, requiredSpend: 15000, priceBasis: 'admission', priceNote: '일반 입장권 기준', duration: 90, walking: 'medium', freshnessReason: '공식 브랜드 사이트와 Kakao 지점 정보를 확인했습니다.', evidence: 'https://www.dynamicmaze.com/', scores: STRONG, rationale: '가족 관광 위험은 있으나 성인 두 명의 협력 경험과 high-energy 공백을 명확히 채워 primary로 제한 승인합니다.', human: KEEP }),
  permanentItem({ key: 'item-hanboknam-gyeongbok', venueKey: 'venue-hanboknam-gyeongbok', name: '한복남 경복궁점', summary: '한복을 함께 고르고 경복궁·서촌 동선에서 사진과 산책 경험을 만드는 대여 공간입니다.', category: 'experience', primary: 'experience', secondary: ['walk_culture'], energy: 'medium', novelty: 'proven', spend: 30000, requiredSpend: 20000, priceBasis: 'program_fee', priceNote: '기본 한복 대여 예상액', duration: 180, indoorOutdoor: 'mixed', walking: 'medium', wait: 'medium', freshnessReason: '공식 예약 사이트와 Kakao 지점 정보를 확인했습니다.', evidence: 'https://hanboknam.com/', bookingRequired: true, bookingUrl: 'https://hanboknam.com/', availability: 'available', scores: STRONG, rationale: '공동 경험은 분명하지만 관광·의상 취향과 야외 동선 의존성이 커 대안으로 제한합니다.', human: ALT }),
  permanentItem({ key: 'item-amateur-workshop-cheonggye', venueKey: 'venue-amateur-workshop-cheonggye', name: '아마츄어작업실 청계점', summary: '을지로 건물의 개성 있는 공간에서 커피와 디저트를 즐기는 콘셉트 카페입니다.', category: 'cafe', primary: 'cafe', secondary: ['walk_culture'], energy: 'low', novelty: 'balanced', spend: 13000, requiredSpend: 6000, priceBasis: 'minimum_purchase', priceNote: '음료와 디저트 기준', duration: 90, wait: 'medium', freshness: 'recent', freshnessReason: 'Kakao 현재 장소 정보와 공식 채널을 확인했습니다.', evidence: 'https://www.instagram.com/amateurworkshop/', scores: ALT_SCORE, rationale: '공간 감도는 있으나 primary 목적성 근거는 중간 수준이라 대안으로 둡니다.', human: ALT }),
  permanentItem({ key: 'item-ssamziegil-workshop', venueKey: 'venue-ssamziegil-workshop', name: '쌈지길체험공방', summary: '인사동 쌈지길 안에서 공예 체험을 선택해 결과물을 만드는 체험 공간 후보입니다.', category: 'experience', primary: 'experience', energy: 'medium', novelty: 'proven', spend: 25000, requiredSpend: 15000, priceBasis: 'program_fee', priceNote: '공방·프로그램별 가격 재검수 필요', duration: 90, freshnessReason: 'Venue는 확인했지만 당일 가능한 성인 커플용 클래스와 예약 상태가 구체적으로 확인되지 않았습니다.', evidence: 'https://www.ssamzigil.co.kr/', availability: 'unknown', scores: STRONG, rationale: '가족 체험 위험과 클래스 가용성 불확실성이 해소될 때까지 모든 추천에서 제외합니다.', human: HOLD, status: 'inactive' }),
  permanentItem({ key: 'item-museum-head-visit', venueKey: 'venue-museum-head', name: '뮤지엄헤드', summary: '계동의 소규모 현대미술 공간에서 기획 전시를 보는 문화공간 후보입니다.', category: 'exhibition', primary: 'exhibition_popup', energy: 'low', novelty: 'new', spend: 10000, requiredSpend: 0, priceBasis: 'variable', priceNote: '전시별 관람료 재확인 필요', duration: 90, freshness: 'recent', freshnessReason: 'Venue 운영은 확인했지만 2026년 9월 현재 구체 Event 상세와 기간 근거가 충분하지 않습니다.', evidence: 'https://museumhead.com/', availability: 'unknown', scores: STRONG, rationale: 'Venue 유명세만으로 추천하지 않고 현재 Event가 확인될 때까지 research hold로 둡니다.', human: HOLD, status: 'inactive' }),
]

function withoutReview(item) {
  const { _review, _human, ...stored } = item
  return stored
}

export const phase1B2BExpansion = {
  dataset_kind: 'production',
  dataset_version: DATASET_VERSION,
  verified_at: VERIFIED_AT,
  image_policy: 'deferred_pending_rights_approval',
  venues: phase1B2BVenues,
  items: phase1B2BItems.map(withoutReview),
}

export const phase1B2BEditorialReviews = {
  dataset_version: DATASET_VERSION,
  editorial_gate_version: 'couple-editorial-v1',
  curation_origin: 'independent_couple_research',
  editorial_reviewed_at: VERIFIED_AT,
  availability_verified_at: VERIFIED_AT,
  items: phase1B2BItems.map((item) => ({
    source_key: item.source_key,
    ...item._review,
    editorial_evidence_refs: item.source_references,
  })),
}

// Approved at the Phase 1B-2B Human Curation checkpoint. The `_human`
// values above preserve the pre-checkpoint proposal; these overrides are the
// authoritative statuses exported to validation, quality tests, and SQL.
const APPROVED_HUMAN_CURATION_OVERRIDES = new Map([
  ['item-redbutton-seongsu', 'alternative_only'],
  ['item-about-the-chapter', 'alternative_only'],
  ['item-channel-1969', 'alternative_only'],
  ['item-liveclub-bbang', 'alternative_only'],
  ['item-book-gopsem', 'alternative_only'],
  ['item-1984-hongdae', 'alternative_only'],
  ['item-cafe-gongmyung-yeonnam', 'alternative_only'],
  ['event-kcdf-craft-design-competition-2026', 'alternative_only'],
  ['event-park-no-soo-mountain-objects-2026', 'alternative_only'],
  ['item-soha-saltpond-ikseon', 'alternative_only'],
  ['item-hyemindang', 'alternative_only'],
  ['item-teong', 'alternative_only'],
  ['item-yuyuhui-seongsu', 'research_hold'],
  ['item-dynamic-maze-insadong', 'research_hold'],
])

export const phase1B2BHumanCuration = {
  dataset_version: DATASET_VERSION,
  human_curation_gate_version: 'couple-human-curation-v1',
  human_curation_reviewed_at: VERIFIED_AT,
  items: phase1B2BItems.map((item) => ({
    source_key: item.source_key,
    human_curation_status: APPROVED_HUMAN_CURATION_OVERRIDES.get(item.source_key) || item._human,
  })),
}
