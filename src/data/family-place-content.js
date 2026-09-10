const visit = (officialSourceName, officialInfoUrl, verifiedAt, details = {}) => ({
  reservationStatus: 'unknown',
  reservationNote: null,
  reservationUrl: null,
  operationNote: null,
  ageRestrictionNote: null,
  parkingNote: null,
  importantNotes: [],
  officialInfoUrl,
  officialSourceName,
  verifiedAt,
  checkedPages: [],
  verificationReason: null,
  ...details,
})

const image = (src, alt, sourceName, sourceUrl, licenseOrUsageBasis, licenseUrl, attributionText) => ({
  src,
  alt,
  sourceName,
  sourceUrl,
  licenseOrUsageBasis,
  licenseUrl,
  localHostingAllowed: true,
  attributionText,
  verifiedAt: '2026-09-10',
})

const checkedToday = '2026-09-10'

export const familyPlaceContentById = {
  'place-001': {
    visitInfo: visit('국립중앙박물관', 'https://www.museum.go.kr/MUSEUM/contents/M0101000000.do?menuId=tour-guidance', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '상설전시는 자유 관람이지만 어린이박물관·VR 체험·교육과 단체 관람은 별도 예약 대상이에요.',
      reservationUrl: 'https://www.museum.go.kr/MUSEUM/contents/M0104090000.do',
      operationNote: '상설전시는 무료이며 특별전시는 유료일 수 있어요. 입장은 관람 종료 30분 전까지예요.',
      ageRestrictionNote: '어린이박물관은 어린이와 보호자가 함께 입장해야 하며 회차별 예약이 필요해요.',
      parkingNote: '주말과 공휴일에는 주차장이 붐빌 수 있어 대중교통 이용을 권장해요.',
      importantNotes: ['어린이박물관을 함께 볼 계획이라면 본관 관람과 별도로 예약을 먼저 확인해 주세요.'],
      checkedPages: [
        'https://www.museum.go.kr/MUSEUM/contents/M0101000000.do?menuId=tour-guidance',
        'https://www.museum.go.kr/MUSEUM/contents/M0104090000.do',
      ],
    }),
    image: image(
      '/place-images/place-001.webp',
      '국립중앙박물관 전경',
      'Jinah78 · Wikimedia Commons · CC BY-SA 3.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Front_view_of_national_museum_of_korea.jpg',
      'CC BY-SA 3.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/3.0/',
      'Jinah78 / Wikimedia Commons / CC BY-SA 3.0 / cropped and converted to WebP',
    ),
  },
  'place-008': {
    visitInfo: visit('국립어린이과학관', 'https://www.sciencecenter.go.kr/csc/', checkedToday, {
      reservationNote: '공식 사이트의 프로그램별 예약 화면은 확인했지만 일반 관람의 예약 필요 여부를 명확한 문장으로 확인하지 못했어요.',
      importantNotes: ['전시와 교육 프로그램별 이용 방법이 다를 수 있어 방문 전 공식 예약 안내를 확인해 주세요.'],
      verificationReason: '공식 사이트가 동적 화면으로 제공되어 일반 개인 관람의 예약 규칙을 공개 문장으로 검증하지 못함',
      checkedPages: ['https://www.sciencecenter.go.kr/csc/'],
    }),
  },
  'place-011': {
    visitInfo: visit('서울역사박물관', 'https://museum.seoul.go.kr/www/guide/vis/guideInfo.jsp', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '일반 관람과 별도로 20명 이상 단체, 전시 해설, 교육·행사는 사전 신청이 필요해요.',
      reservationUrl: 'https://museum.seoul.go.kr/www/guide/reserveInfo.jsp',
      operationNote: '09:00~18:00 운영하며 입장은 17:30까지예요. 월요일과 1월 1일에는 휴관해요.',
      parkingNote: '도심 박물관이라 주차 여건이 제한될 수 있으니 공식 교통 안내를 함께 확인해 주세요.',
      importantNotes: ['어린이 체험·교육은 프로그램마다 회차와 신청 방식이 달라요.'],
      checkedPages: [
        'https://museum.seoul.go.kr/www/guide/vis/guideInfo.jsp',
        'https://museum.seoul.go.kr/www/guide/reserveInfo.jsp',
        'https://museum.seoul.go.kr/www/guide/vis/grpViewng.jsp',
      ],
    }),
    image: image(
      '/place-images/place-011.webp',
      '서울역사박물관 전경',
      'EllalineSeoul · Wikimedia Commons · CC0 1.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Seoul_Museum_of_History_in_2025.jpg',
      'CC0 1.0: 상업적 이용, 복제·재배포 및 수정 허용',
      'https://creativecommons.org/publicdomain/zero/1.0/',
      'EllalineSeoul / Wikimedia Commons / CC0 1.0 / cropped and converted to WebP',
    ),
  },
  'place-017': {
    visitInfo: visit('서울상상나라', 'https://www.seoulchildrensmuseum.org/reservation/viewAdmission.do', checkedToday, {
      reservationStatus: 'recommended',
      reservationNote: '회차별 정원이 있으며 혼잡 시 현장 입장이 어려울 수 있어 공식 안내에서 사전 예약을 권장해요.',
      reservationUrl: 'https://www.seoulchildrensmuseum.org/reservation/reservationInfo.do',
      operationNote: '10:00~18:00 운영하며 입장은 17:00까지예요. 월요일과 지정 휴관일에는 쉬어요.',
      ageRestrictionNote: '10세 이하 어린이는 보호자와 함께 입장해야 하며, 어린이를 동반하지 않은 성인은 입장할 수 없어요.',
      parkingNote: '서울어린이대공원 주차장을 함께 사용해 주말에는 대기할 수 있어요.',
      importantNotes: ['전시장 안에서는 유모차 이용이 제한되며 음식은 가족쉼터에서만 먹을 수 있어요.'],
      checkedPages: [
        'https://www.seoulchildrensmuseum.org/reservation/viewAdmission.do',
        'https://www.seoulchildrensmuseum.org/reservation/reservationInfo.do',
      ],
    }),
  },
  'place-018': {
    visitInfo: visit('서울시립과학관', 'https://science.seoul.go.kr/tmpl/static/info/use?menuId=2', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '상설전시는 예약 없이 무료 관람할 수 있지만 일부 체험·교육과 단체 관람은 별도 예약이 필요해요.',
      reservationUrl: 'https://science.seoul.go.kr/board/qna?bbsId=13&menuId=24',
      operationNote: '09:30~17:30 운영하며 월요일과 지정 휴일에는 휴관해요.',
      parkingNote: '주차 공간이 적어 공식 안내에서 대중교통 이용을 권장해요.',
      importantNotes: ['체험 프로그램은 현장 회차 예약 또는 온라인 신청 여부를 당일 확인해 주세요.'],
      checkedPages: [
        'https://science.seoul.go.kr/tmpl/static/info/use?menuId=2',
        'https://science.seoul.go.kr/board/qna?bbsId=13&menuId=24',
      ],
    }),
    image: image(
      '/place-images/place-018.webp',
      '서울시립과학관 전경',
      'ChongDae · Wikimedia Commons · CC BY-SA 4.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Seoul_Science_Center_02.jpg',
      'CC BY-SA 4.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'ChongDae / Wikimedia Commons / CC BY-SA 4.0 / cropped and converted to WebP',
    ),
  },
  'place-019': {
    visitInfo: visit('국립항공박물관', 'https://www.aviation.or.kr/contents.do?menuno=65', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '전시 관람은 무료지만 항공 체험은 온라인 예약과 일부 현장 잔여석 방식으로 운영돼요.',
      reservationUrl: 'https://www.aviation.or.kr/reservation.do?gcode=gcode1&menuno=189',
      operationNote: '화~일요일 10:00~18:00, 입장은 17:30까지예요. 월요일과 지정 휴관일에는 쉬어요.',
      ageRestrictionNote: '체험마다 키·나이·건강 조건이 달라요. 예를 들어 블랙이글스 체험은 키 130cm 이상 조건이 있어요.',
      parkingNote: '유료 주차장이 있으나 공간이 제한되어 공식 안내에서 대중교통 이용을 권장해요.',
      importantNotes: ['체험권은 전시 입장과 별개이므로 원하는 체험의 대상 연령과 잔여석을 먼저 확인해 주세요.'],
      checkedPages: [
        'https://www.aviation.or.kr/contents.do?menuno=65',
        'https://www.aviation.or.kr/contents.do?menuno=168',
        'https://www.aviation.or.kr/contents.do?menuno=311',
        'https://www.aviation.or.kr/reservation.do?gcode=gcode1&menuno=189',
      ],
    }),
  },
  'place-092': {
    visitInfo: visit('국립세계문자박물관', 'https://mow.or.kr/kor/sub01_01.do', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '일반 전시와 별도로 어린이 체험실과 단체 관람은 회차별 예약으로 운영돼요.',
      reservationUrl: 'https://www.mow.or.kr/prog/childExprnApply/kor/sub04_03/grp/calendar.do',
      ageRestrictionNote: '어린이 체험실은 5~7세 권장 공간이며 어린이는 보호자와 함께 이용해야 해요.',
      importantNotes: ['어린이 체험실 안에서는 음식물을 먹을 수 없어요.'],
      checkedPages: [
        'https://mow.or.kr/kor/sub01_01.do',
        'https://www.mow.or.kr/prog/childExprnApply/kor/sub04_03/grp/calendar.do',
        'https://www.mow.or.kr/prog/grpViewngApply/kor/sub04_02/calendar.do',
      ],
    }),
  },
  'place-093': {
    visitInfo: visit('인천광역시립박물관', 'https://www.incheon.go.kr/museum/MU010102', checkedToday, {
      reservationNote: '20명 이상 단체와 교육 프로그램의 신청 안내는 확인했지만 개인 가족 관람의 예약 규칙을 명확히 확인하지 못했어요.',
      operationNote: '09:00~18:00 운영하며 입장은 17:30까지예요. 월요일과 1월 1일에는 휴관해요.',
      parkingNote: '박물관 외부 주차장을 이용할 수 있으나 주차 규모와 당일 혼잡은 방문 전에 확인해 주세요.',
      importantNotes: ['가족·어린이 프로그램은 별도 신청이 필요한 경우가 있어 교육·행사 안내를 확인해 주세요.'],
      verificationReason: '공식 안내에서 단체·프로그램 예약은 확인했으나 일반 개인 관람의 예약 필요 여부를 직접 밝힌 문장을 찾지 못함',
      checkedPages: [
        'https://www.incheon.go.kr/museum/MU010102',
        'https://www.incheon.go.kr/museum/MU010109',
      ],
    }),
  },
  'place-095': {
    visitInfo: visit('인천의 공원', 'https://www.incheon.go.kr/park/park010201', checkedToday, {
      reservationNote: '공원과 어린이동물원의 일반 이용 예약 여부를 공식 문장으로 확정하지 못했어요.',
      operationNote: '공원 개방시간은 계절에 따라 달라지며 어린이동물원은 월요일과 지정 휴일에 쉬어요.',
      parkingNote: '공원 주차장을 이용할 수 있으며 요금과 만차 여부는 당일 공식 안내를 확인해 주세요.',
      importantNotes: ['어린이동물원을 함께 방문한다면 별도 운영일과 시간을 확인해 주세요.'],
      verificationReason: '시설별 운영시간은 확인했으나 일반 가족 방문의 예약 불필요를 명시한 공식 근거를 찾지 못함',
      checkedPages: [
        'https://www.incheon.go.kr/park/park010201',
        'https://www.incheon.go.kr/park/park010214',
      ],
    }),
    image: image(
      '/place-images/place-095.webp',
      '인천대공원 풍경',
      '메이 · Wikimedia Commons · CC BY-SA 1.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:%EC%9D%B8%EC%B2%9C%EB%8C%80%EA%B3%B5%EC%9B%90.JPG',
      'CC BY-SA 1.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/1.0/',
      '메이 / Wikimedia Commons / CC BY-SA 1.0 / cropped and converted to WebP',
    ),
  },
  'place-096': {
    visitInfo: visit('인천관광공사 월미공원', 'https://www.ictr.or.kr/main/wolmi/', checkedToday, {
      reservationNote: '공식 운영 사이트에서 일반 방문의 예약 필요 여부를 확인할 수 있는 상세 문장을 찾지 못했어요.',
      importantNotes: ['전망대·문화관 등 세부 시설은 휴관일과 운영시간이 서로 다를 수 있어요.'],
      verificationReason: '공식 사이트의 상세 이용·예약 정보를 공개 페이지에서 검증하지 못함',
      checkedPages: ['https://www.ictr.or.kr/main/wolmi/'],
    }),
  },
  'place-099': {
    visitInfo: visit('국립생물자원관', 'https://www.nibr.go.kr/cmn/sym/mnu/mpm/1150400001/htmlMenuView.do', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '공식 관람 안내에 개인 관람객은 예약 없이 입장할 수 있다고 명시돼요. 10명 이상 단체는 예약 대상이에요.',
      reservationUrl: 'https://www.cyberebu.nibr.go.kr/cmn/wvtex/booking/bookingMain.do',
      operationNote: '화~일요일 09:30~17:30 운영하며 월요일과 지정 휴관일에는 쉬어요. 관람료는 무료예요.',
      ageRestrictionNote: '일부 해설은 초등학교 3학년 이상 단체 등 프로그램별 대상 조건이 있어요.',
      parkingNote: '방문객 주차장과 무료 셔틀버스 안내가 있어요.',
      importantNotes: ['10명 이상 단체나 해설 프로그램을 원하면 온라인 예약을 확인해 주세요.'],
      checkedPages: [
        'https://www.nibr.go.kr/cmn/sym/mnu/mpm/1150400001/htmlMenuView.do',
        'https://www.nibr.go.kr/cmn/sym/mnu/mpm/1150400002/htmlMenuView.do',
        'https://www.nibr.go.kr/cmn/sym/mnu/mpm/1150400003/htmlMenuView.do',
      ],
    }),
  },
  'place-100': {
    visitInfo: visit('옥토끼우주센터', 'https://www.oktokki.com/main', checkedToday, {
      reservationStatus: 'recommended',
      reservationNote: '공식 홈페이지가 네이버 사전 예약을 주요 예매 방법으로 안내해 방문 전에 예약을 확인하는 것이 좋아요.',
      operationNote: '평일과 주말·공휴일 운영시간이 다르게 안내돼요.',
      parkingNote: '주차 가능 여부와 혼잡은 공식 안내 또는 시설에 방문 전 확인해 주세요.',
      importantNotes: ['야외 체험시설은 날씨와 계절에 따라 운영 여부가 달라질 수 있어요.'],
      checkedPages: ['https://www.oktokki.com/main'],
    }),
  },

  'place-101': {
    visitInfo: visit('판교박물관', 'https://www.pangyomuseum.go.kr/', checkedToday, {
      reservationNote: '공식 누리집에 접속할 수 없어 현재 개인 관람 예약 규칙을 확인하지 못했어요.',
      parkingNote: '공공자원 안내에는 방문객용 주차 15면으로 안내되어 있어 대중교통을 함께 고려해 주세요.',
      importantNotes: ['방문 전 성남시 또는 박물관 공식 채널에서 운영 여부를 다시 확인해 주세요.'],
      verificationReason: '공식 시설 사이트 접속 실패로 현재 운영·예약 세부 규칙을 교차 검증하지 못함',
      checkedPages: [
        'https://www.pangyomuseum.go.kr/',
        'https://www.eshare.go.kr/UserPortal/Upv/UprResrcFacl/index.do?rsrc_no=BA10A0001997',
      ],
    }),
  },
  'place-111': {
    visitInfo: visit('현대어린이책미술관 MOKA', 'https://www.hmoka.org/mobile/visit/information/main.do?st_cd=480', checkedToday, {
      reservationNote: '단체 관람 예약 권장 안내는 확인했지만 개인 가족 관람의 예약 필요 여부는 명확히 확인하지 못했어요.',
      operationNote: '전시별 운영기간·휴관일·관람료가 달라 방문할 전시 안내를 확인해야 해요.',
      ageRestrictionNote: '3세 미만 어린이는 보호자와 함께 관람하도록 안내돼요.',
      parkingNote: '현대백화점 판교점 주차장을 이용하며 미술관 관람객은 공식 안내 기준 2시간 무료예요.',
      verificationReason: '공식 관람 안내에서 개인 관람의 예약 필수·불필요를 직접 명시한 근거를 찾지 못함',
      checkedPages: [
        'https://www.hmoka.org/mobile/visit/information/main.do?st_cd=480',
        'https://hmoka.org/mobile/visit/directions/main.do?st_cd=480',
      ],
    }),
  },
  'place-115': {
    visitInfo: visit('경기문화재단 백남준아트센터', 'https://njp.ggcf.kr/pages/information', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '공식 관람 안내에 10명 미만 개인 관람은 예약 없이 가능하다고 명시돼요. 단체는 사전 예약 대상이에요.',
      operationNote: '관람시간과 휴관일은 전시 일정에 따라 달라질 수 있어 방문 전 공식 안내를 확인해 주세요.',
      ageRestrictionNote: '30개월 미만 영유아는 유모차 이용 안내를 확인해 주세요.',
      parkingNote: '주차 가능 여부와 요금은 공식 관람 안내의 교통·주차 항목에서 확인해 주세요.',
      importantNotes: ['10명 이상 단체라면 방문 전 예약이 필요해요.'],
      checkedPages: ['https://njp.ggcf.kr/pages/information'],
    }),
    image: image(
      '/place-images/place-115.webp',
      '백남준아트센터 전경',
      'HanKooKin · Wikimedia Commons · CC BY-SA 3.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:DankookU-Paiknamjun.JPG',
      'CC BY-SA 3.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/3.0/',
      'HanKooKin / Wikimedia Commons / CC BY-SA 3.0 / cropped and converted to WebP',
    ),
  },
  'place-134': {
    visitInfo: visit('국립농업박물관', 'https://namuk.or.kr/kr/1333/subview.do', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '박물관 일반 관람과 별도로 어린이박물관은 사전 예약제로 운영돼요.',
      reservationUrl: 'https://www.namuk.or.kr/artclSearch/kr/1772/artclView.do',
      operationNote: '휴관일과 회차 운영은 박물관과 어린이박물관이 다를 수 있어요.',
      ageRestrictionNote: '어린이박물관은 어린이 중심 체험공간으로 보호자 동반 및 회차별 이용조건을 확인해야 해요.',
      importantNotes: ['어린이박물관을 방문할 계획이라면 일반 전시와 별도로 예약해 주세요.'],
      checkedPages: [
        'https://namuk.or.kr/kr/1333/subview.do',
        'https://www.namuk.or.kr/artclSearch/kr/1772/artclView.do',
      ],
    }),
  },
  'place-135': {
    visitInfo: visit('아쿠아플라넷 광교', 'https://www.aquaplanet.co.kr/gwanggyo/information/use_price.do', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '입장권과 별도로 일부 체험 프로그램은 당일 현장 예약으로 운영돼요.',
      reservationUrl: 'https://www.aquaplanet.co.kr/gwanggyo/program/programList.do',
      operationNote: '공식 안내 기준 연중무휴 10:30~19:30이며 매표 마감은 18:30이에요.',
      parkingNote: '갤러리아 광교·포레나 광교 주차장 이용 시 공식 안내 기준 2시간 무료 등록이 가능해요.',
      importantNotes: ['원하는 체험이 있다면 입장 후 운영시간과 잔여석을 먼저 확인해 주세요.'],
      checkedPages: [
        'https://www.aquaplanet.co.kr/gwanggyo/information/use_price.do',
        'https://m.aquaplanet.co.kr/gwanggyo/customer/faq.do?category=PLA&page=1',
        'https://www.aquaplanet.co.kr/gwanggyo/program/programList.do',
        'https://www.aquaplanet.co.kr/gwanggyo/customer/noticeDetail.do?seq=3101',
      ],
    }),
  },
  'place-145': {
    visitInfo: visit('화성시어린이문화센터', 'https://childrenjob.hscity.go.kr/see/utilization_guide.do', checkedToday, {
      reservationNote: '회차별 예매 화면과 이용 안내는 확인했지만 개인 방문의 현장 입장 가능 여부를 명확한 문장으로 확인하지 못했어요.',
      reservationUrl: 'https://childrenjob.hscity.go.kr/booking/fmcs/1',
      operationNote: '회차별로 운영되어 원하는 날짜와 시간의 잔여 인원을 미리 확인하는 것이 좋아요.',
      ageRestrictionNote: '체험시설별 권장 연령과 보호자 동반 조건을 예매 전에 확인해 주세요.',
      parkingNote: '공식 오시는 길에는 무료 주차 135면으로 안내되지만 행사일에는 혼잡할 수 있어요.',
      importantNotes: ['내부 식사 공간과 음식물 이용 규칙은 FAQ를 확인해 주세요.'],
      verificationReason: '공식 예매 기능은 확인했으나 일반 개인 이용의 사전 예약 필수 여부가 명시되지 않음',
      checkedPages: [
        'https://childrenjob.hscity.go.kr/see/utilization_guide.do',
        'https://childrenjob.hscity.go.kr/booking/fmcs/1',
        'https://childrenjob.hscity.go.kr/see/faq.do',
        'https://childrenjob.hscity.go.kr/about/contact.do',
      ],
    }),
  },

  'place-201': {
    visitInfo: visit('독립기념관', 'https://i815.or.kr/2018/tour/info.do', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '일반 관람과 별도로 전시 해설·교육·단체 프로그램은 사전 신청이 필요할 수 있어요.',
      reservationUrl: 'https://i815.or.kr/2018/tour/explain.do?agree=P&mode=L',
      operationNote: '전시관 운영시간과 휴관일은 계절·행사 일정에 따라 달라질 수 있어요.',
      parkingNote: '대형 주차장이 있으나 유료이며 행사일에는 입·출차가 붐빌 수 있어요.',
      importantNotes: ['부지가 넓어 어린아이와 방문하면 보고 싶은 전시관을 미리 골라 동선을 짜는 것이 좋아요.'],
      checkedPages: [
        'https://i815.or.kr/2018/tour/info.do',
        'https://i815.or.kr/2018/tour/explain.do?agree=P&mode=L',
      ],
    }),
    image: image(
      '/place-images/place-201.webp',
      '독립기념관 전경',
      'Lawinc82 · Wikimedia Commons · CC BY-SA 3.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Independence_Hall_of_Korea_01.JPG',
      'CC BY-SA 3.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/3.0/',
      'Lawinc82 / Wikimedia Commons / CC BY-SA 3.0 / cropped and converted to WebP',
    ),
  },
  'place-204': {
    visitInfo: visit('천안문화재단 천안시립미술관', 'https://www.camoa.or.kr/camoa/sub02_01.do', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '공식 FAQ에 일반 관람은 예약 없이 가능하고 단체만 예약이 필요하다고 안내돼요.',
      reservationUrl: 'https://www.camoa.or.kr/bbs/BBSMSTR_000000000314/list.do',
      operationNote: '화~일요일 10:00~18:00, 입장은 17:30까지예요. 월요일과 지정 휴관일에는 쉬어요.',
      parkingNote: '공식 FAQ 기준 주차는 무료예요.',
      importantNotes: ['일부 특별전은 유료일 수 있어 현재 전시 안내를 확인해 주세요.'],
      checkedPages: [
        'https://www.camoa.or.kr/camoa/sub02_01.do',
        'https://www.camoa.or.kr/bbs/BBSMSTR_000000000314/list.do',
        'https://www.camoa.or.kr/camoa/sub02_04.do',
      ],
    }),
  },
  'place-207': {
    visitInfo: visit('천안어린이꿈누리터', 'https://ticket.cachildren.kr/rsvc/rsv_pm.html?b_id=cacnplay', checkedToday, {
      reservationStatus: 'recommended',
      reservationNote: '회차별 정원이 있으며 현장 접수는 잔여석이 있을 때만 가능하므로 사전 예약이 안전해요.',
      reservationUrl: 'https://ticket.cachildren.kr/rsvc/rsv_pm.html?b_id=cacnplay',
      operationNote: '회차별 운영시간과 정원이 달라 예약 화면에서 방문일 잔여석을 확인해 주세요.',
      ageRestrictionNote: '놀이·체험 공간별 이용 연령과 보호자 동반 기준을 예약 전 확인해 주세요.',
      importantNotes: ['주말에는 원하는 회차가 마감될 수 있어 미리 예약하는 것이 좋아요.'],
      checkedPages: ['https://ticket.cachildren.kr/rsvc/rsv_pm.html?b_id=cacnplay'],
    }),
  },
  'place-211': {
    visitInfo: visit('아산시시설관리공단', 'https://www.asanfmc.or.kr/', checkedToday, {
      reservationNote: '공식 운영기관 사이트에서 현재 개인 관람의 예약 규칙을 시설 단위로 확인하지 못했어요.',
      importantNotes: ['장영실과학관의 당일 운영 여부와 체험 신청은 공식 운영기관에 다시 확인해 주세요.'],
      verificationReason: '운영기관 홈페이지에서 해당 시설의 관람·예약 세부 페이지를 찾지 못함',
      checkedPages: ['https://www.asanfmc.or.kr/'],
    }),
  },
  'place-214': {
    visitInfo: visit('국가유산청 현충사관리소', 'https://hcs.khs.go.kr/cha/idx/SubIndex.do?mn=HCS', checkedToday, {
      reservationNote: '공식 사이트에서 현재 개인 관람의 예약 필요 여부를 확인할 수 있는 문장을 찾지 못했어요.',
      importantNotes: ['기념행사나 해설 프로그램은 별도 운영될 수 있어 방문일 공지를 확인해 주세요.'],
      verificationReason: '공식 사이트의 관람·예약 세부정보를 공개 페이지에서 명확히 검증하지 못함',
      checkedPages: ['https://hcs.khs.go.kr/cha/idx/SubIndex.do?mn=HCS'],
    }),
  },
  'place-215': {
    visitInfo: visit('온양민속박물관', 'https://onyangmuseum.or.kr/', checkedToday, {
      reservationNote: '공식 사이트에 안정적으로 접속하지 못해 현재 개인 관람 예약 규칙을 확인하지 못했어요.',
      importantNotes: ['방문 전 박물관 공식 연락처 또는 공지에서 운영·휴관 여부를 확인해 주세요.'],
      verificationReason: '공식 사이트 SSL/접속 오류로 관람·예약·주차 세부정보를 검증하지 못함',
      checkedPages: ['https://onyangmuseum.or.kr/'],
    }),
  },

  'place-221': {
    visitInfo: visit('국립춘천박물관', 'https://chuncheon.museum.go.kr/prog/yeyakInfo/childmuseum/kor/sub01_0204/list.do', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '어린이박물관 공식 안내에 가족 관람은 예약 없이 이용할 수 있고 단체는 예약 권장으로 안내돼요.',
      operationNote: '어린이박물관은 회차별 운영시간과 휴관일이 있어 방문 전에 당일 일정을 확인해 주세요.',
      ageRestrictionNote: '어린이박물관은 6~10세 어린이를 중심으로 한 공간이며 보호자 동반이 필요해요.',
      importantNotes: ['단체 방문이나 교육 프로그램 참여는 별도 예약 여부를 확인해 주세요.'],
      checkedPages: [
        'https://chuncheon.museum.go.kr/prog/yeyakInfo/childmuseum/kor/sub01_0204/list.do',
        'https://chuncheon.museum.go.kr/child/sub02_01.do',
      ],
    }),
    image: image(
      '/place-images/place-221.webp',
      '국립춘천박물관 전경',
      'Sadopaul · Wikimedia Commons · CC BY 4.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:%EA%B5%AD%EB%A6%BD%EC%B6%98%EC%B2%9C%EB%B0%95%EB%AC%BC%EA%B4%80_%EC%A0%95%EB%A9%B4.jpg',
      'CC BY 4.0: 상업적 이용, 복제·재배포 및 수정 허용(저작자 표시)',
      'https://creativecommons.org/licenses/by/4.0/',
      'Sadopaul / Wikimedia Commons / CC BY 4.0 / cropped and converted to WebP',
    ),
  },
  'place-222': {
    visitInfo: visit('춘천시 문화관광', 'https://www.chuncheon.go.kr/tour/destination/all-tour/detail/?tourId=218', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '춘천시 공식 관광 안내에 사전 예약과 현장 발권이 모두 가능하다고 명시돼요.',
      operationNote: '애니메이션박물관과 토이로봇관의 운영시간·휴관일은 방문일 공식 안내를 확인해 주세요.',
      parkingNote: '공식 관광 안내에 주차장이 제공되는 것으로 안내돼요.',
      importantNotes: ['특별 체험이나 상영 프로그램은 별도 시간표와 접수 여부를 확인해 주세요.'],
      checkedPages: [
        'https://www.chuncheon.go.kr/tour/destination/all-tour/detail/?tourId=218',
        'https://www.gica.or.kr/Home/index',
      ],
    }),
  },
  'place-228': {
    visitInfo: visit('레고랜드 코리아 리조트', 'https://www.legoland.kr/%EA%B3%84%ED%9A%8D%ED%95%98%EA%B8%B0/%EB%B0%A9%EB%AC%B8-%EC%A0%84-%ED%99%95%EC%9D%B8%ED%95%98%EC%84%B8%EC%9A%94/2026-%EC%9A%B4%EC%98%81%EC%95%88%EB%82%B4/', checkedToday, {
      reservationNote: '온라인 티켓과 날짜별 운영 안내는 확인했지만 현장 구매 가능 여부를 포함한 사전 예약 필수 규칙을 공식 문장으로 확정하지 못했어요.',
      operationNote: '날짜별 운영시간과 휴장일이 달라 공식 운영 캘린더를 반드시 확인해야 해요.',
      parkingNote: '전용 주차장과 셔틀·도보 이동 안내를 방문 전에 확인해 주세요.',
      importantNotes: ['놀이기구마다 키 제한과 보호자 동반 조건이 달라요.', '티켓의 방문일 지정·변경 조건을 결제 전에 확인해 주세요.'],
      verificationReason: '공식 페이지에서 온라인 예매는 확인했으나 일반 입장의 사전예약 필수·현장발권 가능 여부를 명확히 확정하지 못함',
      checkedPages: [
        'https://www.legoland.kr/%EA%B3%84%ED%9A%8D%ED%95%98%EA%B8%B0/%EB%B0%A9%EB%AC%B8-%EC%A0%84-%ED%99%95%EC%9D%B8%ED%95%98%EC%84%B8%EC%9A%94/2026-%EC%9A%B4%EC%98%81%EC%95%88%EB%82%B4/',
        'https://www.legoland.kr/%EA%B3%84%ED%9A%8D%ED%95%98%EA%B8%B0/%EB%B0%A9%EB%AC%B8-%EC%A0%84-%ED%99%95%EC%9D%B8%ED%95%98%EC%84%B8%EC%9A%94/%EC%A3%BC%EC%B0%A8-%EC%98%A4%EC%8B%9C%EB%8A%94-%EA%B8%B8/',
      ],
    }),
    image: image(
      '/place-images/place-228.webp',
      '레고랜드 코리아 정문',
      'YellowTurtle9 · Wikimedia Commons · CC BY 4.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:20231226_%EB%A0%88%EA%B3%A0%EB%9E%9C%EB%93%9C%EC%BD%94%EB%A6%AC%EC%95%84_%EC%A0%95%EB%AC%B8_%EC%A0%84%EA%B2%BD.jpg',
      'CC BY 4.0: 상업적 이용, 복제·재배포 및 수정 허용(저작자 표시)',
      'https://creativecommons.org/licenses/by/4.0/',
      'YellowTurtle9 / Wikimedia Commons / CC BY 4.0 / cropped and converted to WebP',
    ),
  },
  'place-231': {
    visitInfo: visit('뮤지엄산', 'https://www.museumsan.org/guide/visitor', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '기본 관람권과 별도로 제임스터렐관·명상관 등 일부 공간은 시간 지정 또는 별도 이용 조건이 있어요.',
      reservationUrl: 'https://www.museumsan.org/museumsan/',
      operationNote: '10:00~18:00 운영하며 매표 마감은 17:00, 월요일은 휴관해요.',
      ageRestrictionNote: '특별관마다 영유아·어린이 입장 제한이 다르므로 티켓 선택 전에 확인해 주세요.',
      parkingNote: '주차 후 전시 공간까지 야외 이동 구간이 있어 날씨와 아이 체력을 고려해 주세요.',
      importantNotes: ['공간 사이를 10~20분씩 걸을 수 있어 편한 신발과 쉬는 동선이 필요해요.'],
      checkedPages: [
        'https://www.museumsan.org/guide/visitor',
        'https://www.museumsan.org/museumsan/',
      ],
    }),
  },
  'place-232': {
    visitInfo: visit('원주한지테마파크', 'https://www.hanjipark.com/', checkedToday, {
      reservationNote: '공식 사이트에서 현재 일반 관람과 체험의 예약 규칙을 명확히 확인하지 못했어요.',
      importantNotes: ['한지 체험은 프로그램·인원에 따라 신청 방식이 달라질 수 있어 방문 전 문의해 주세요.'],
      verificationReason: '공식 사이트의 상세 이용·예약 페이지 내용을 공개 검색 결과로 검증하지 못함',
      checkedPages: ['https://www.hanjipark.com/'],
    }),
  },
  'place-237': {
    visitInfo: visit('국립산악박물관', 'https://nmm.forest.go.kr/', checkedToday, {
      reservationNote: '공식 사이트에서 현재 개인 관람과 체험 프로그램의 예약 규칙을 명확히 확인하지 못했어요.',
      importantNotes: ['체험시설을 이용할 계획이라면 운영 여부와 연령·신장 조건을 공식 안내에서 다시 확인해 주세요.'],
      verificationReason: '공식 사이트의 관람·예약 상세 페이지에 안정적으로 접근하지 못함',
      checkedPages: ['https://nmm.forest.go.kr/'],
    }),
  },

  'place-241': {
    visitInfo: visit('국립해양박물관', 'https://www.mmk.or.kr/?folder=information&page=viewing', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '일반 전시와 별도로 어린이박물관·교육·해설 프로그램은 온라인 예약제로 운영되는 항목이 있어요.',
      reservationUrl: 'https://www.mmk.or.kr/?folder=information&page=reserv.all',
      operationNote: '관람시간과 휴관일은 계절·요일에 따라 달라질 수 있어 공식 관람 안내를 확인해 주세요.',
      ageRestrictionNote: '어린이박물관은 6~10세 권장, 유아놀이터는 5세 이하 대상이며 보호자 동반이 필요해요.',
      parkingNote: '주차장 이용요금과 혼잡도는 방문일 공식 교통 안내를 확인해 주세요.',
      importantNotes: ['어린이박물관은 100% 온라인 예약으로 안내되므로 일반 전시와 별도로 예약해 주세요.'],
      checkedPages: [
        'https://www.mmk.or.kr/?folder=information&page=viewing',
        'https://www.mmk.or.kr/?folder=information&page=reserv.all',
        'https://www.mmk.or.kr/?folder=education&page=kidstourguid',
      ],
    }),
  },
  'place-242': {
    visitInfo: visit('국립부산과학관', 'https://www.sciport.or.kr/kor/CMS/Contents/Contents.do?mCode=MN002', checkedToday, {
      reservationStatus: 'partial',
      reservationNote: '상설전시와 별도로 온라인 티켓·교육·캠프·행사는 예약 또는 신청이 필요한 항목이 있어요.',
      reservationUrl: 'https://www.sciport.or.kr/kor/Main.do',
      operationNote: '화~일요일 09:30~17:30, 입장은 16:30까지예요. 월요일과 지정 휴관일에는 쉬어요.',
      ageRestrictionNote: '어린이 전시·체험 공간마다 대상 연령과 보호자 동반 조건이 달라요.',
      parkingNote: '공식 안내 기준 09:00~18:00 유료 주차장을 운영하며 일반 승용차는 1일 2,000원으로 안내돼요.',
      importantNotes: ['원하는 체험이나 교육이 있다면 일반 입장권과 별도로 신청 여부를 확인해 주세요.'],
      checkedPages: [
        'https://www.sciport.or.kr/kor/CMS/Contents/Contents.do?mCode=MN002',
        'https://www.sciport.or.kr/kor/Main.do',
      ],
    }),
  },
  'place-246': {
    visitInfo: visit('SEA LIFE 부산아쿠아리움', 'https://www.visitsealife.com/busan/plan-your-visit/before-you-visit/opening-hours/', checkedToday, {
      reservationNote: '온라인 티켓 판매는 확인했지만 현장 구매 가능 여부와 사전 예약 필수 규칙을 공식 문장으로 확정하지 못했어요.',
      operationNote: '운영시간과 마지막 입장 시각은 날짜별로 달라질 수 있어 방문일 공식 안내를 확인해 주세요.',
      ageRestrictionNote: '체험·먹이주기 프로그램은 연령이나 현장 운영 조건이 있을 수 있어요.',
      importantNotes: ['온라인 티켓의 방문일·사용 조건과 취소 규정을 결제 전에 확인해 주세요.'],
      verificationReason: '공식 티켓 페이지에서 사전 구매는 확인했으나 일반 입장의 예약 필수·현장발권 가능 여부를 명시한 근거를 찾지 못함',
      checkedPages: [
        'https://www.visitsealife.com/busan/plan-your-visit/before-you-visit/opening-hours/',
        'https://www.visitsealife.com/busan/tickets-passes/',
        'https://www.visitsealife.com/busan/plan-your-visit/information/help-center/',
      ],
    }),
    image: image(
      '/place-images/place-246.webp',
      'SEA LIFE 부산아쿠아리움 수조',
      'Ryan Bodenstein · Wikimedia Commons · CC BY 2.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Sea_Life_Busan_Aquarium_13.jpg',
      'CC BY 2.0: 상업적 이용, 복제·재배포 및 수정 허용(저작자 표시)',
      'https://creativecommons.org/licenses/by/2.0/',
      'Ryan Bodenstein / Wikimedia Commons / CC BY 2.0 / cropped and converted to WebP',
    ),
  },
  'place-258': {
    visitInfo: visit('부산광역시교육청 부산과학체험관', 'https://home.pen.go.kr/scinuri/cm/cntnts/cntntsView.do?cntntsId=3096&mi=15967', checkedToday, {
      reservationStatus: 'required',
      reservationNote: '개인 관람도 공식 통합예약포털에서 온라인 예약 후 이용하도록 안내돼요.',
      reservationUrl: 'https://home.pen.go.kr/scinuri/',
      operationNote: '관람일과 회차가 정해져 있으며 관람료는 무료예요. 운영시간·휴관일은 방문일 안내를 확인해 주세요.',
      ageRestrictionNote: '전시 체험은 6세 이상 권장이며 미취학 아동과 초등 1~4학년은 보호자 동반 안내가 있어요.',
      parkingNote: '공식 안내 기준 08:30~17:50 유료 주차장이며 최초 30분 1,000원, 이후 10분당 300원이에요.',
      importantNotes: ['예약한 회차의 입장시간을 지키고 보호자 동반 기준을 확인해 주세요.'],
      checkedPages: [
        'https://home.pen.go.kr/scinuri/cm/cntnts/cntntsView.do?cntntsId=3095&mi=15966',
        'https://home.pen.go.kr/scinuri/cm/cntnts/cntntsView.do?cntntsId=3096&mi=15967',
      ],
    }),
  },
  'place-261': {
    visitInfo: visit('부산시민공원', 'https://www.citizenpark.or.kr/04_int/int09.asp', checkedToday, {
      reservationNote: '공원 일반 이용의 예약 불필요 여부를 공식 문장으로 확인하지 못했어요.',
      operationNote: '공원은 연중 운영하며 공식 안내 기준 05:00~24:00 개방해요.',
      parkingNote: '공원 주차장 위치와 이용요금은 공식 주차 안내에서 확인할 수 있어요.',
      importantNotes: ['공원 안 개별 체험·대관 시설은 별도 신청이 필요할 수 있어요.'],
      verificationReason: '개방시간과 주차는 확인했으나 일반 가족 방문의 예약 불필요를 직접 명시한 공식 근거를 찾지 못함',
      checkedPages: [
        'https://www.citizenpark.or.kr/04_int/int09.asp',
        'https://www.citizenpark.or.kr/04_int/int10.asp',
      ],
    }),
    image: image(
      '/place-images/place-261.webp',
      '부산시민공원 거울연못',
      'Vichycombo · Wikimedia Commons · CC BY-SA 4.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Busan_Citizens_Park_%22mirror_pond%22.jpg',
      'CC BY-SA 4.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'Vichycombo / Wikimedia Commons / CC BY-SA 4.0 / cropped and converted to WebP',
    ),
  },
  'place-265': {
    visitInfo: visit('해운대블루라인파크', 'https://main.bluelinepark.com/information.do', checkedToday, {
      reservationStatus: 'recommended',
      reservationNote: '예약시간 탑승객이 우선이며 주말·공휴일에는 지연될 수 있어 원하는 시간대를 미리 예매하는 것이 좋아요.',
      reservationUrl: 'https://main.bluelinepark.com/information.do',
      operationNote: '운영시간과 배차 간격은 계절·기상 상황에 따라 달라질 수 있어요.',
      ageRestrictionNote: '유아 동반과 유모차 이용 조건은 차량 종류별 안내를 확인해 주세요.',
      parkingNote: '지정 주차장에서 예매 바코드로 2시간 할인되는 안내가 있어 대상 주차장을 미리 확인해야 해요.',
      importantNotes: ['예약시간은 첫 탑승 기준이며 성수기에는 승·하차 대기가 생길 수 있어요.'],
      checkedPages: [
        'https://main.bluelinepark.com/information.do',
        'https://www.bluelinepark.com/images/guidemap/GUIDEBOOK_KOR.pdf',
      ],
    }),
  },

  'place-271': {
    visitInfo: visit('국립제주박물관', 'https://jeju.museum.go.kr/html/kr/sub06/sub06_0603.html', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '어린이박물관 공식 안내에 가족 관람은 예약 없이 이용할 수 있다고 명시돼요. 단체는 예약 권장 대상이에요.',
      operationNote: '어린이박물관 회차와 휴관일은 공식 관람 안내에서 방문일 기준으로 확인해 주세요.',
      ageRestrictionNote: '어린이박물관은 어린이와 보호자가 함께 이용하는 체험공간이에요.',
      importantNotes: ['교육 프로그램은 가족 관람과 별도로 사전 신청이 필요할 수 있어요.'],
      checkedPages: [
        'https://jeju.museum.go.kr/html/kr/sub06/sub06_0603.html',
        'https://jeju.museum.go.kr/_prog/edu_app/',
      ],
    }),
  },
  'place-275': {
    visitInfo: visit('제주항공우주박물관', 'https://www.jdc-jam.com/visit/info.do', checkedToday, {
      reservationNote: '온라인 티켓 이용 안내는 확인했지만 현장 입장 가능 여부와 사전 예약 필수 규칙을 명확히 확인하지 못했어요.',
      operationNote: '09:00~18:00 운영하며 입장은 17:00까지예요. 매월 셋째 월요일에 휴관해요.',
      ageRestrictionNote: '전시·체험시설별 키와 연령 제한은 현장 및 공식 이용 안내를 확인해 주세요.',
      parkingNote: '공식 관람 안내 기준 주차장은 무료예요.',
      importantNotes: ['체험시설 운영시간은 전시 관람시간과 다를 수 있어 당일 시간표를 확인해 주세요.'],
      verificationReason: '공식 관람 안내에서 온라인 구매 고객 정보는 확인했으나 일반 관람의 예약 필수·불필요를 직접 명시하지 않음',
      checkedPages: ['https://www.jdc-jam.com/visit/info.do'],
    }),
    image: image(
      '/place-images/place-275.webp',
      '제주항공우주박물관 전경',
      'Hunini · Wikimedia Commons · CC BY-SA 3.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Jeju_Aerospace_Museum_20140606-02.JPG',
      'CC BY-SA 3.0: 상업적 이용, 복제·재배포 및 수정 허용(동일조건변경허락·저작자 표시)',
      'https://creativecommons.org/licenses/by-sa/3.0/',
      'Hunini / Wikimedia Commons / CC BY-SA 3.0 / cropped and converted to WebP',
    ),
  },
  'place-277': {
    visitInfo: visit('아쿠아플라넷 제주', 'https://www.aquaplanet.co.kr/jeju/information/use_price.do', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '공식 FAQ에 온라인 구매 티켓도 별도 사전 예약 없이 입장할 수 있다고 안내돼요.',
      operationNote: '운영시간과 공연·프로그램 시간은 날짜별로 달라질 수 있어 방문일 안내를 확인해 주세요.',
      ageRestrictionNote: '체험 프로그램별 참여 연령과 보호자 동반 조건을 확인해 주세요.',
      parkingNote: '공식 FAQ 기준 야외 주차장은 무료예요.',
      importantNotes: ['공연 시간에 맞추려면 입장 후 당일 프로그램 시간표를 먼저 확인해 주세요.'],
      checkedPages: [
        'https://www.aquaplanet.co.kr/jeju/information/use_price.do',
        'https://m.aquaplanet.co.kr/jeju/customer/faq.do',
      ],
    }),
  },
  'place-280': {
    visitInfo: visit('스누피가든', 'https://www.snoopygarden.com/home', checkedToday, {
      reservationNote: '공식 티켓 메뉴는 확인했지만 현장 구매 가능 여부와 사전 예약 필수 규칙을 명확히 확인하지 못했어요.',
      importantNotes: ['야외 가든 비중이 커 날씨와 아이의 걷기 체력을 함께 고려해 주세요.'],
      verificationReason: '공식 사이트에서 티켓 판매는 확인했으나 일반 방문의 예약 필수·불필요를 밝힌 문장을 찾지 못함',
      checkedPages: ['https://www.snoopygarden.com/home'],
    }),
  },
  'place-284': {
    visitInfo: visit('제주특별자치도 제주돌문화공원', 'https://www.jeju.go.kr/jejustonepark/', checkedToday, {
      reservationNote: '공식 사이트에서 일반 관람의 예약 필요 여부를 명확히 확인하지 못했어요.',
      operationNote: '정기 휴원일과 계절별 관람시간은 방문 전 공식 공지에서 다시 확인해 주세요.',
      parkingNote: '넓은 야외 관람 동선이므로 주차 위치와 마지막 입장시간을 함께 확인해 주세요.',
      importantNotes: ['야외 이동이 길 수 있어 비·바람과 아이 체력을 고려해 관람 구역을 골라보세요.'],
      verificationReason: '운영기관 공식 사이트의 상세 이용 페이지에서 예약 불필요를 직접 확인하지 못함',
      checkedPages: [
        'https://www.jeju.go.kr/jejustonepark/',
        'https://m.visitjeju.net/kr/detail/view?contentsid=CONT_000000000500547',
      ],
    }),
    image: image(
      '/place-images/place-284.webp',
      '제주돌문화공원 풍경',
      'Bernard Gagnon · Wikimedia Commons · CC0 1.0 (crop·WebP 변환)',
      'https://commons.wikimedia.org/wiki/File:Jeju_Stone_Park_01.jpg',
      'CC0 1.0: 상업적 이용, 복제·재배포 및 수정 허용',
      'https://creativecommons.org/publicdomain/zero/1.0/',
      'Bernard Gagnon / Wikimedia Commons / CC0 1.0 / cropped and converted to WebP',
    ),
  },
  'place-294': {
    visitInfo: visit('제주시 제주별빛누리공원', 'https://www.jejusi.go.kr/star/reserv/rsvInfo2.do', checkedToday, {
      reservationStatus: 'not_required',
      reservationNote: '공식 예약 안내에 개인 방문은 현장 발매로만 이용한다고 명시돼요. 단체는 온라인 예약 대상이에요.',
      operationNote: '계절별 관람시간이 다르며 매표는 운영 종료 90분 전에 마감돼요.',
      ageRestrictionNote: '4D 영상관은 키 120cm 이상 이용 조건이 있어요.',
      parkingNote: '주차 가능 여부와 야간 관람 후 출차 동선은 방문 전 공식 안내를 확인해 주세요.',
      importantNotes: ['천체관측은 맑은 날에만 가능하므로 당일 날씨와 관측 가능 여부를 확인해 주세요.'],
      checkedPages: [
        'https://www.jejusi.go.kr/star/reserv/rsvInfo2.do',
        'https://www.jejusi.go.kr/fileDown.ac?path=%2Fstar%2Fpdf_workstudy.pdf',
      ],
    }),
  },
}

export const familyVisitInfoPilotIds = Object.freeze(Object.keys(familyPlaceContentById))
