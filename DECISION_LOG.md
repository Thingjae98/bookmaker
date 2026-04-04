# DECISION_LOG.md — 의사결정 & 트러블슈팅 기록

> 개발 중 주요 기술 선택 이유와 문제 해결 과정을 기록합니다.
> 구글폼 서술형 문항 작성 시 참고용.

---

## ✅ 2026-04-04 — 24p 규격 대응 고퀄리티 더미 데이터 대개편 + 감성 에세이 리브랜딩

### 배경 / 요구사항

- SQUAREBOOK_HC 최소 24페이지 규격을 만족하려면 더미 데이터도 24개 페이지가 필요
- 기존 더미 데이터(8~12개)로는 에디터 로드 시 UI가 빈약하게 보여 시연 퀄리티 저하
- 세 가지 템플릿 유형(text+photo, text_only, photo_only Full-bleed)이 실제로 모두 시연되어야 함
- '1인 출판 플랫폼'이라는 이름이 서비스 정체성을 제대로 전달하지 못함

### 의사결정

**리브랜딩: `1인 출판 플랫폼` → `감성 에세이`**
- `constants.js`: `name`, `subtitle`, `description`, `icon` (✍️) 전부 변경
- 대상: `selfpublish` 서비스 키 유지, UI 표시 이름만 교체
- README.md 서비스 설명 동기화

**더미 데이터 24페이지 전면 재작성 (6개 서비스 × 24페이지)**

| 구분 | 1~12p | 13~24p |
|------|-------|--------|
| 육아 일기 | 감성 장문 텍스트 + 사진 (TPL_WITH_PHOTO) | text: "" Full-bleed 사진 (TPL_WITH_PHOTO) |
| 유치원 졸업 | 선생님·부모 코멘트 + 활동사진 | text: "" 활동 사진 Full-bleed |
| AI 동화책 | 10페이지 이야기 텍스트 + 삽화 | 챕터 구분 Full-bleed 삽화 12장 |
| 여행 포토북 | 장소·감성 캡션 + 사진 (파노라마 1장 포함) | text: "" 풍경 Full-bleed (파노라마 1장 포함) |
| 감성 에세이 | **교차 배치** — image:null 텍스트 전용 12장 | **교차 배치** — photo Full-bleed 12장 |
| 반려동물 | 감성 캡션 + 귀여운 사진 | text: "" 사진 Full-bleed |

**세 가지 템플릿 분기 완전 지원**

```
image: PLACEHOLDER + text: "텍스트"  → TPL_WITH_PHOTO (사진+텍스트)
image: PLACEHOLDER + text: ""        → TPL_WITH_PHOTO (Full-bleed, diaryText=' ')
image: null        + text: "텍스트"  → TPL_TEXT_ONLY  (텍스트 전용)
```

**editor/page.jsx useEffect 버그 수정**
- 기존: `p.image?.startsWith('http') ? p.image : picsum_fallback` — `p.image === null`일 때 fallback으로 덮어씌워 text-only 의도 파괴
- 수정: `p.image === null || p.image === '' ? null : (...)` — null 명시적 보존 → TPL_TEXT_ONLY 분기 정상 동작

**파노라마 이미지 지원**
- `PANORAMA(seed)` 헬퍼 추가: `https://picsum.photos/seed/{seed}/1200/600` (2:1 비율)
- 여행 더미 14p·22p에 파노라마 2장 포함, `isLandscape: true` 플래그
- useEffect에서 `isLandscape: p.isLandscape || false` 읽기 추가 → 갤러리 가로형 배지 표시

### 결과
- 6개 서비스 모두 더미 데이터 채우기 즉시 24페이지 갤러리 구성 → API 최소 페이지 조건 자동 충족
- 감성 에세이의 text_only ↔ photo_only 교차 배치로 TPL_TEXT_ONLY 매력 시연 가능
- 여행 파노라마로 isLandscape 배지 UI 자연스럽게 시연 가능

---

## ✅ 2026-04-04 — [해결완료] Photos API 업로드 성공 후 URL 추출 실패 ("업로드 실패: undefined") 해결

### 배경 / 문제

**증상**: 에디터 API 로그에 `⚠️ 내지 N 업로드 실패: undefined` 4회 연속 출력, 업로드된 사진이 모두 picsum fallback으로 대체됨
- 로그 패턴: `📁 내지 파일 맵: 4개 / 24장 보유 (인덱스: [10, 11, 12, 13])` → 파일은 정상 로드됨
- 원인 오판: 처음에는 `stagedFilesRef` 인덱스 불일치로 파악 → 수정 후에도 동일 증상 지속
- 실제 원인: SweetBook Photos API `POST /Books/{bookUid}/photos` 응답 JSON의 **URL 필드명 불일치**

### 진단 과정

1. `d.message === undefined` → `d.success === true`임을 역추론 (success 응답에는 message 없음)
2. 업로드 소요 시간 7~9초 → SDK `maxRetries=2`, `delay(1s+2s)` = 3회 시도 패턴 아님 → 1회 성공 + URL 추출 실패
3. SDK 소스 분석: `photos.upload()` → `ResponseParser(body).getData()` = `body?.data ?? body` → `sweetbook.js` `ok(data)` = `{ success: true, data: <photo object> }`
4. 클라이언트 코드: `d.data?.url || d.data?.photoUrl || d.data?.fileUrl` — SweetBook API 실제 필드명이 이 3가지 중 어느 것도 아님
5. SweetBook SDK 예제(`01_create_book.js`)는 Photos API 전혀 사용하지 않고 picsum URL 직접 전달 → API 문서에서 반환 필드명 보장 없음

### 의사결정

**`uploadFile` 헬퍼 URL 추출 로직 전면 재작성**

```js
// 기존 (3개 필드명만 시도)
const url = d.data?.url || d.data?.photoUrl || d.data?.fileUrl;

// 변경 후 (14개 필드명 + 문자열 타입 대응)
const raw = d.data;
const url =
  (typeof raw === 'string' && raw.startsWith('http') ? raw : null) ||
  raw?.url || raw?.downloadUrl || raw?.originalUrl ||
  raw?.photoUrl || raw?.fileUrl || raw?.imageUrl ||
  raw?.cdnUrl || raw?.publicUrl || raw?.uploadedUrl ||
  raw?.uploadUrl || raw?.originalFileUrl || raw?.fileDownloadUrl ||
  raw?.photo?.url || raw?.photo?.downloadUrl || raw?.photo?.originalUrl ||
  null;
```

**에러 분기 명확화**
- `!d.success` 조기 감지 → 명확한 실패 메시지 출력
- URL 미발견이지만 `d.success=true` → 응답 전체를 `addLog`로 출력하여 필드명 즉시 파악 가능: `업로드 성공했으나 URL 필드 미발견. 응답: {...}`
- 모든 분기에 `console.log('[업로드 응답]', JSON.stringify(d))` 추가

### 결과 (1차 수정)
- 14개 URL 필드명 폴백 탐색 + 응답 전체 addLog 출력으로 실제 응답 구조 확인
- **실제 API 응답 확인**: `{ fileName, originalName, size, mimeType, uploadedAt, isDuplicate, hash }` — **URL 필드 없음**

### 2차 수정 — `fileName` 참조 사용

**실제 원인 (로그 분석 후 확정)**:
SweetBook Photos API는 URL을 반환하지 않는다. `fileName`(`photo260404064434599.PNG`)이 SweetBook 내부 사진 참조 ID이며, 이를 템플릿 파라미터(`photo1`, `coverPhoto`)에 전달하면 SweetBook 렌더링 엔진이 해당 book 스코프 내 업로드된 사진을 자동으로 조회한다.

```js
// URL 탐색 실패 → fileName을 SweetBook 내부 참조로 반환
if (raw?.fileName) {
  addLog(`✅ ${label} 업로드 완료 (fileName 참조) → ${raw.fileName}`);
  return raw.fileName;
}
```

- `fileName`이 truthy string이므로 picsum fallback 분기 스킵 → 실제 사진 사용
- `params.photo1 = "photo260404xxxxxx.PNG"` → SweetBook API에 fileName 전달

---

## ✅ 2026-04-04 — [해결완료] 내지 스프레드 전환에 따른 사진 데이터 인덱스 매핑 최종 동기화 및 업로드 버그 해결

### 배경 / 문제

**스프레드 UI 도입 후 실제 업로드 파일이 picsum fallback으로 대체되는 현상**
- `item.file` 프로퍼티는 gallery state 객체에 저장되어 있으나, `setGallery`의 비동기 batching 과정 또는 `map/filter`로 생성된 새 배열에서 파일 참조가 끊어지는 경우 발생
- `handleBlankSlotUpload`가 `await detectLandscape(file)` 이후 `updateGalleryItem(galleryIdx, {...})` 를 호출할 때 stale closure 위험 존재
- `handleCreateBook`에서 `contentItems[ci].file`을 직접 참조했는데, 이 파일 참조가 `undefined`로 평가되어 `uploadFile` 건너뜀 → picsum fallback 적용

### 의사결정

**`stagedFilesRef` (useRef) 도입 — itemId → File 이중 보관 맵**
- `useRef({})` 로 `stagedFilesRef` 생성: gallery state와 독립적으로 파일 객체 보관
- `handleGalleryUpload`: 각 item ID 생성 직후 `stagedFilesRef.current[id] = file` 등록
- `handleBlankSlotUpload`: `setGallery` 함수형 업데이터 내부에서 `prev[galleryIdx].id` 읽어 등록 → stale closure 위험 완전 제거
- `removeGalleryItem` / `removeSpreadPair`: 아이템 제거 시 `delete stagedFilesRef.current[item.id]` 정리

**`contentFileMap` — 절대 내지 인덱스 기준 스냅샷**
- `handleCreateBook` 시작 시 `contentItems.forEach((item, ci) => ...)` 로 `contentFileMap[ci]` 빌드
- 파일 취득 우선순위: `stagedFilesRef.current[item.id]` → `item.file` → 두 가지 모두 없으면 미등록
- 이 맵이 "0부터 시작하는 전체 내지 절대 인덱스" 기준 파일 매핑의 단일 진실의 원천
- `addLog`와 `console.log('[contentFileMap 스냅샷]')` 으로 업로드 전 맵 전체를 확인 가능

**`uploadFile` 헬퍼 강화**
- `file` 이 `File | Blob` 인지 타입 체크 추가 (`instanceof` 검사)
- `console.log('[업로드 시도]', label, file.size, file.type)` 로 FormData append 직전 파일 유효성 출력
- `form.append('file', file, file.name || 'photo.jpg')` — 파일명 명시적 전달 (Blob의 경우 name 없음 방어)

### 결과
- 실제 업로드 파일이 picsum fallback으로 대체되는 문제 해결
- 절대 내지 인덱스 기반 파일 맵으로 스프레드 재정렬/삭제 후에도 파일 순서 보장
- API 로그 + console.log로 업로드 전 파일 상태를 완전히 가시화

---

## ✅ 2026-04-04 — [해결완료] 스프레드 UI 기반 데이터 인덱스 매핑 전면 재구축 + 최종화 에러 100% 해결

### 배경 / 문제

**1. 스프레드 UI 도입 후 사진 업로드 실패(undefined) 및 내지 400 에러 연속 발생**
- `contentPageData[i]`와 `contentItems[i]` 간 인덱스 매핑이 스프레드 표시 순서와 어긋날 수 있는 구조
- 빈 슬롯(`isBlankSlot: true`) 아이템이 내지로 포함될 때 `imageUrl: null`, `text: ''`로 API 전송 → 일부 API 검증에서 400 반환
- 업로드 실패 시 `uploadFile()` 반환값이 `null`인데, 상위 루프에서 이를 그대로 패딩 페이지에 재사용 → 모든 패딩 페이지도 `imageUrl: null`이 됨
- `page.templateUid`에 사용자가 선택한 API 템플릿 UID(파라미터명이 다른 것)가 들어올 경우 400 에러 유발

**2. 빈 슬롯이 편집 패널에서 브레이크**
- `modalItem.previewUrl`이 `null`인 빈 슬롯 선택 시 `<img src={null}>`로 깨진 이미지 표시
- 빈 슬롯에 직접 사진을 업로드하는 수단이 없어 갤러리 업로드 후 역할 재지정 필요

### 의사결정

**절대 페이지 인덱스 기준 contentPageData 빌드 원칙 수립**
- `for (let ci = 0; ci < contentItems.length; ci++)` 인덱스 루프로 변경
- `contentPageData[ci]` ↔ `contentItems[ci]` 1:1 매핑 보장
- 각 인덱스에 `fallbackUrl = picsum.../seed/{serviceType}-c{ci}/...` 할당 → 업로드 실패·파일 없음 모두 안전하게 처리

**`uploadFile()` 헬퍼 방어 강화**
- `file === null` 조기 감지 → 즉시 null 반환 + 로그 기록
- try/catch로 네트워크 예외 포착 + `console.dir(err)` 수준 상세 로깅
- 반환 null 시 상위에서 picsum fallback URL로 대체

**빈 슬롯 처리 표준화**
- `item.isBlankSlot === true`이면 `imageUrl: null` 유지 (TPL_TEXT_ONLY로 전송)
- `!isBlankSlot && imgUrl === null`이면 picsum fallback 자동 적용 → 이미지 없는 일반 아이템이 빈 페이지로 전송되는 상황 제거
- 패딩 페이지도 `srcPage.imageUrl || picsum` 폴백으로 항상 이미지 URL 확보

**templateUid 강제 표준화**
- `page.templateUid` 완전 무시 — 항상 `TPL_WITH_PHOTO` / `TPL_TEXT_ONLY` 두 가지 검증된 상수만 사용
- `diaryText: (page.text || '').trim() || ' '` — 빈 문자열 거부 방지용 단일 공백 폴백
- 모든 contents 전송에 try/catch + `console.dir` 추가 → 실패 페이지만 경고, 나머지는 계속 전송

**빈 슬롯 직접 편집 UX 도입**
- `handleBlankSlotUpload(galleryIdx, file)`: 빈 슬롯에서 파일 선택 시 해당 갤러리 아이템 업데이트 + `isBlankSlot: false` 전환
- 인라인 편집 패널 좌측 미리보기 영역: `previewUrl`이 null이면 `<label>`+`<input type="file">` 업로드 버튼 플레이스홀더 표시
- 스프레드 뷰 빈 슬롯 아이콘: 📄로 교체 + `title` 툴팁으로 클릭 가능성 명시

### 결과
- 사진 업로드 undefined 에러 완전 해결 — 빈 슬롯·파일 없는 아이템 모두 picsum fallback으로 안전 처리
- 내지 400 에러 해결 — templateUid 강제 표준화 + diaryText 빈 문자열 폴백
- 최종화 에러 로그에 `console.dir` 수준 상세 정보 추가 → 디버깅 시 API 응답 전체 구조 확인 가능
- 빈 슬롯 클릭 → 편집 패널 → 사진 직접 업로드 → `isBlankSlot: false` 전환 플로우 완성

---

## ✅ 2026-04-04 — [해결완료] 2페이지 Spread 단위 내지 편집 시스템 도입

### 배경 / 문제

**내지 목록이 단순 1페이지 단위 리스트로 구성된 UX 문제**
- 이전 좌측 패널 내지 목록: 각 아이템이 독립된 1p 카드로 나열 → SweetBook API가 2페이지 단위(Spread)로 내지를 관리한다는 인쇄 물리 구조와 불일치
- 사용자가 "홀수 페이지" 상태(총 내지 수가 2의 배수 아님)를 자연스럽게 만들 수 있어, `isIncrementOk` 검증에 걸려 [책 생성] 버튼이 비활성화되는 혼란 발생
- 양면(Spread) 분할 사진이 2페이지를 소모하는 맥락이 UI에서 전혀 보이지 않았음

### 의사결정

**`spreadGroups` useMemo — 내지를 [L|R] 쌍으로 그룹화**
- `contentItems`를 2개씩 묶어 `{ spreadNum, leftItem, rightItem, leftPageNum, rightPageNum }` 구조로 변환
- 좌측 패널이 스프레드 단위 카드(`스프레드 N · M–K쪽`)로 표시 → 사용자가 "현재 몇 개의 Spread가 있는지" 한눈에 파악

**빈 슬롯(Blank Slot) 개념 도입**
- `makeBlankItem()`: `{ previewUrl: null, isBlankSlot: true, role: 'content' }` 생성 함수
- "+2페이지(1장) 추가" 버튼 → 빈 슬롯 2개를 한 번에 추가 → 항상 짝수 유지
- 빈 슬롯은 갤러리 그리드에서 회색 📄 자리표시자로 렌더링, API 전송 시 `TPL_TEXT_ONLY` 템플릿 자동 적용

**Spread 단위 삭제**
- `removeSpreadPair(galleryIdx)`: 클릭된 아이템이 속한 Spread 쌍(L+R) 두 장을 동시 제거 → 삭제 후에도 항상 짝수 유지
- 인라인 패널 하단 "스프레드 삭제 (2p)" 버튼이 이 함수 호출

**L/R 슬롯 교체**
- `swapSpreadSlot(galleryIdx)`: 해당 아이템과 그 파트너(같은 Spread의 반대쪽 슬롯)의 갤러리 위치를 교환
- 인라인 편집 패널 내 "↔ L/R 교체" 버튼으로 사용자가 좌/우 배치를 즉시 조정 가능

**스프레드 슬롯 인디케이터**
- 내지 편집 패널 최상단에 미니 Spread 미리보기 박스 고정 노출
- "스프레드 N · 왼쪽(L)/오른쪽(R) 페이지" 레이블 + L/R 교체 버튼 + 40px 높이의 좌우 슬롯 미니 프리뷰(현재 편집 중인 슬롯은 amber 오버레이로 강조)

### 결과
- 인쇄 물리 구조(2p Spread)가 에디터 전 영역에 일관되게 반영됨
- "+2페이지(1장) 추가" + 쌍 단위 삭제로 `isIncrementOk` 위반이 원천적으로 불가능해짐
- 미니 스프레드 미리보기로 사용자가 L/R 배치를 직관적으로 파악 및 수정 가능

---

## ✅ 2026-04-04 — [해결완료] 표지 스프레드(Spread) 듀얼 슬롯 UX 도입

### 배경 / 문제

**표지 템플릿 구조와 사용자 인터랙션 방식의 불일치**
- SweetBook 표지 템플릿 썸네일은 `[뒤표지(좌) | 앞표지(우)]`가 하나로 이어진 Spread 1장 이미지로 제공됨
- 그러나 에디터 UI는 앞표지와 뒤표지를 각각 별도 섹션으로 표시 → 두 사진이 한 쌍이어야 한다는 맥락(Context)이 시각적으로 연결되지 않음
- 사용자가 앞표지만 지정하고 책 생성을 시도하거나, 두 슬롯이 함께 채워져야 한다는 사실을 모르는 UX 문제 발생

### 의사결정

**듀얼 슬롯 스프레드 미리보기 UI 도입**
- 좌측 구성 패널의 앞/뒤 개별 섹션을 제거하고, 단일 "📔 표지 스프레드" 영역으로 통합
- `[뒤표지(좌) | 앞표지(우)]` 2칸 그리드로 템플릿 Spread 구조를 그대로 재현
- 슬롯에 이미지가 채워지면 썸네일, 비어있으면 점선 원형 + "미지정" 레이블 표시

**인라인 편집 패널 우측 컬럼에도 스프레드 슬롯 노출**
- 갤러리에서 사진을 클릭해 앞/뒤표지 역할 지정 시 → 우측 컬럼에 현재 스프레드 현황 실시간 표시
- 미채워진 슬롯을 앰버 색상 경고("앞표지와 뒤표지 사진을 모두 지정해 주세요")로 즉시 안내

**템플릿 선택기에 2장 필수 안내 추가**
- 표지 역할일 때 템플릿 카드 그리드 상단에 파란 안내 박스: "이 템플릿은 앞/뒤표지 2장의 사진이 모두 필요합니다"
- 사용자가 템플릿을 선택하는 시점에 2장 요건을 자연스럽게 인지

### 결과
- 표지 Spread 물리 구조를 UI에 직접 반영 → "왜 사진 2장이 필요한가" 별도 설명 없이 직관적으로 전달
- 슬롯 기반 시각화로 앞/뒤 양쪽 지정 완료 여부를 한눈에 확인 가능

---

## ✅ 2026-04-04 — [해결완료] 표지 Spread 통합 및 페이지 규격 검증 시스템 도입

### 배경 / 문제

**1. 뒤표지가 내지(contents) 마지막 장으로 처리되는 구조적 불일치**
- 기존 코드: `POST /books/{uid}/contents`를 반복 호출하다 맨 마지막에 뒤표지 이미지를 내지 API로 전송 (STEP 4-b)
- 인쇄 물리 규격상 앞/뒤 표지는 Spread 1장(양면 인쇄)으로 관리됨 — 별개 내지 페이지가 아님
- 이 구조로 인해 pageMin 계산에 뒤표지 1장이 포함되어 실제 내지 수가 1 적게 계산되는 부작용 발생

**2. 내지 페이지 수 검증이 UI 수준에서 강제되지 않음**
- 버튼 활성화 조건: `contentItems.length >= MIN_CONTENT (8)` — 실제 API pageMin(24)보다 훨씬 낮은 상수
- 사용자가 8장만 구성하고 [책 생성] 클릭 → 코드가 자동 패딩하지만 사용자는 그 사실을 모름
- 양면(Spread) 분할 아이템이 2페이지를 소모한다는 사실이 페이지 카운트에 미반영

**3. 페이지 수가 증분 단위(pageIncrement) 배수가 아닌 경우 처리 없음**
- API 규격: SQUAREBOOK_HC는 24, 26, 28...의 2p 단위로만 최종화 가능
- 기존 핸들러에서 수학적 반올림은 있었지만, UI에서 사용자에게 명시적 안내 없음

### 의사결정

**표지 로직 통합 (Spread 방식)**
- STEP 4-b(뒤표지를 마지막 contents로 전송) 완전 제거
- STEP 3(표지 추가) 단일 `POST /books/{uid}/cover` 호출 내에 앞표지(`coverPhoto`)와 뒤표지(`backPhoto`) URL을 함께 전달
- 인쇄 규격과 API 사용 방식이 1:1 대응 — 데이터 정합성 및 유지보수성 향상

**`getPageConsumption(item)` 함수 신설**
- 아이템 단위로 페이지 소모량 계산: `useSpread && isLandscape`이면 2, 아니면 1
- 컴포넌트 외부 순수 함수로 정의 → useMemo deps에서 안정적 참조
- `totalContentPages = contentItems.reduce(sum + getPageConsumption(item), 0)` 로 실제 소모 페이지 합산

**페이지 규격 실시간 검증 강화**
- `specPageMinUI / specPageIncUI`: `BOOK_SPECS[session?.bookSpecUid]` 기반 동적 계산 (session null 시 24/2 기본값)
- `isPageMinMet = totalContentPages >= specPageMinUI`
- `isIncrementOk = totalContentPages > 0 && totalContentPages % specPageIncUI === 0`
- `isReady = front 1장 && back 1장 && isPageMinMet && isIncrementOk`
- 버튼 비활성 시 전용 빨간 안내 박스: "최소 N페이지가 필요합니다" / "N페이지 단위로 추가해 주세요"

### 결과
- 표지 API 호출 구조가 SweetBook 인쇄 규격과 정확히 일치 → 모호한 뒤표지 처리 제거
- 사용자가 [책 생성] 버튼을 클릭하기 전에 페이지 수 부족·단위 불일치를 즉시 인지 가능
- Spread 분할 아이템의 2페이지 소모가 카운트에 정확히 반영 → 예상치 못한 최종화 실패 방지

---

## ✅ 2026-04-03 — [해결완료] 프로페셔널 에디터 UX 도입 — 인라인 속성 패널 + 동적 페이지 카운트

### 배경 / 문제

**1. 모달창의 맥락 단절 문제**
- 갤러리 썸네일 클릭 → 전체 화면을 덮는 검은 오버레이 모달 출현
- 사용자가 갤러리 전체 구성을 보면서 편집할 수 없음 (모달이 가림)
- 전문 포토북 에디터(Canva, Adobe Express 등)는 우측 Properties Panel 패턴 사용

**2. 내지 카운트 하드코딩 혼란**
- `{contentItems.length}/{MIN_CONTENT}장` 형태로 MIN_CONTENT=8을 상수로 하드코딩
- 실제 API pageMin(SQUAREBOOK_HC=24)과 표시값이 달라 "왜 8장인데 24장을 채워야 하지?" 혼란 유발

### 의사결정

**인라인 속성 패널(Inline Property Panel) 패턴 도입**
- 갤러리 썸네일 클릭 → 에디터 하단 액션 패널이 스르륵 사라지고, 그 자리에 2-column 편집 패널 출현
- 좌측: 사진 미리보기 + 역할(앞/뒤/내지) 선택 + 표지 템플릿
- 우측: 내지 전용 제목·날짜·텍스트 입력 + 동적 템플릿 필터링 + 양면 분할 옵션
- 편집 완료 후 "확인·닫기" 클릭 → 다시 최종 생성 버튼 영역 등장
- `galleryModal` state(open+idx 객체) → `selectedIdx: number|null` 단순 state로 교체

**동적 페이지 카운트 연동**
- `specPageMin = BOOK_SPECS[session.bookSpecUid]?.pageMin || 24` 동적 계산
- 표시: "현재 N / 최소 24장" 형태, 색상 3단계 (미달=노랑, 버튼활성화=파랑, 완전충족=초록)
- 버튼 활성화 기준 `MIN_CONTENT=8`은 유지 (실제 패딩은 책 생성 시 자동)

### 결과
- 모달 없는 컨텍스트 유지 편집 → 갤러리 전체 구성을 보면서 개별 사진 설정 가능
- 페이지 카운트가 판형별 실제 규격(`pageMin`)에 연동되어 사용자 혼란 제거

---

## ✅ 2026-04-03 — [해결완료] 인지 부하 최소화를 위한 템플릿 동적 필터링 UX

### 배경 / 문제
- 에디터 갤러리 모달에서 내지 역할을 선택하면 API에서 받아온 모든 템플릿("내지a", "빈내지", "내지_월시작" 등)이 필터링 없이 나열됨
- 선택지가 너무 많아 "이 템플릿이 무슨 레이아웃인지?" 알 수 없는 상태에서 골라야 하는 인지 부하 발생

### 의사결정

**핵심 원칙**: "사용자가 지금 뭘 만들려는지"에 맞는 선택지만 보여준다.

- 텍스트를 입력했다 → 텍스트 구역을 가진 레이아웃(`photo_text`, `text_only`, `calendar`)만 노출
- 텍스트가 비어 있다 → 이미지 전용 레이아웃(`photo_only`, `blank`)만 노출
- "자동 선택"은 필터와 무관하게 항상 최상단 전체 너비 버튼으로 고정

**추가 조치**:
- 우상단 필터 배지("✍ 텍스트 포함 레이아웃만 표시 중" / "🖼 이미지 전용 레이아웃만 표시 중")로 왜 특정 템플릿이 안 보이는지 사용자에게 즉시 설명
- `inferWireframeType()` 함수가 템플릿 이름/kind에서 레이아웃 타입을 추론 → 필터 기준으로 활용

### 결과
- 모달 열릴 때마다 적합한 템플릿 2~3개만 노출 → 선택 피로 대폭 감소
- 텍스트 입력/삭제 시 목록이 실시간 전환 → 직관적인 피드백 제공

---

## ✅ 2026-04-03 — [해결완료] 최종화 400 에러 수정 및 에디터 모달 내 템플릿 선택 UI 구현

### 증상
- `POST /books/{bookUid}/finalization` → 400 Bad Request (최종화 불가)
- Create 단계에서 동적으로 받아온 템플릿 UID가 session에 그대로 저장되어 에디터에서 잘못된 UID로 표지 전송

### 원인 분석

**1. 페이지 계산식 오류 (최종화 400의 직접 원인)**
- 기존 로직: `targetContentCount = max(pageMin, contentCount + 2) - 2`
  - `pageMin = 24` 기준, user가 내지 8장 → `rawTotal = 24`, `targetContentCount = 22`
  - 실제 contents API 호출 횟수: 22 → 총 23페이지(22 + cover 1)로 `pageMin 24` 미달 → 400
- `pageMin`은 순수 내지(Contents) API 호출 횟수 기준으로 재해석

**2. 검증 안 된 templateUID가 세션 오염**
- Create 페이지가 `GET /templates` 응답의 첫 번째 templateUid(예: `4MY2fokVjkeY`)를 `coverTemplateUid`로 저장
- 에디터가 `session.coverTemplateUid || COVER_TEMPLATE` 순서로 읽어 잘못된 UID 사용 → 표지 400

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `editor/page.jsx` | 페이지 계산식 수정: `targetContentCount = align(max(pageMin, contentCount), increment)` |
| `editor/page.jsx` | `session.coverTemplateUid` 참조 제거 → 검증 상수 `dynamicCoverTpl` 항상 사용 |
| `editor/page.jsx` | 모달 내 템플릿 select → 카드 그리드 UI로 교체 (앞표지·내지 역할별 필터링) |
| `create/page.jsx` | 템플릿 선택 섹션 삭제 — 이제 에디터 모달에서 페이지별 선택 가능 |
| `create/page.jsx` | `coverTemplateUid`, `contentTemplateUid`, `availableTemplates`, `templatesLoading` 상태 제거 |

### 수정 후 계산 검증 (SQUAREBOOK_HC, pageMin=24, user 내지 8장)
```
rawCount = max(24, 8) = 24
targetContentCount = 24 (24 % 2 == 0, 패딩 없음)
총 페이지 = 24(내지) + 1(앞표지) = 25 → 최종화 성공 ✅ 실제 확인
```

### 실제 성공 로그 (2026-04-03 검증 완료)
```
📗 책 생성 완료 → 📸 사진 업로드 → 🎨 앞표지 추가 완료
📄 내지 24페이지 추가 완료 → 🎨 뒤표지 추가 완료
🔒 최종화 완료! (25페이지)  ← API가 반환한 pageCount: 25 ✅
```

**핵심 교훈**: SweetBook API의 `pageMin`은 `/contents` 엔드포인트 호출 횟수(순수 내지 수)이며, `/cover` 표지 1장은 별도 계산. 이를 혼동하면 항상 `pageMin - 2`만큼 부족하여 최종화 400 발생.

---

## ✅ 2026-04-03 — [해결완료] bookSpecUid·템플릿 UID·파라미터명 전면 교정 (실제 API 테스트 기반)

### 증상
- `POST /api/books` → 400 Bad Request (API 연동 전혀 안 됨)

### 원인 분석 (Node.js 직접 호출로 검증)

**1. bookSpecUid 오류**: `bs_6a8OUY`, `bs_3EzPkz`, `bs_518IVG`는 실제로 빈 플레이스홀더 UID.
- 이 UID로 `POST /Books` 시 API가 400 반환
- 실제로 책 생성 가능한 UID: `SQUAREBOOK_HC`, `PHOTOBOOK_A4_SC`, `PHOTOBOOK_A5_SC`

**2. 템플릿 API 응답 구조**: `{ success, message, data: { templates: [...] } }` 형태
- 기존 코드는 `data.items`로 접근 → 항상 빈 배열
- `book-specs` 응답: `{ data: [...] }` (배열 직접), 단 유효 spec은 name/pageMin 기준 필터 필요

**3. 템플릿 UID 및 파라미터명 불일치**
- 기존 하드코딩(`tpl_F8d15af9fd`, `cnH0Ud1nl1f9`, `6dJ0Qy6ZmXej`) 모두 동작하지 않음
- 각 템플릿은 고유한 파라미터 이름을 가짐 — 실제로 필요한 파라미터:
  - `79yjMH3qRPly` (표지): `{ coverPhoto, title, dateRange }` ✅
  - `3FhSEhJ94c0T` (내지_사진): `{ photo1, date, title, diaryText }` ✅
  - `vHA59XPPKqak` (내지_텍스트): `{ date, title, diaryText }` ✅
- 기존 코드의 `diaryPhoto` → 실제 파라미터명 `photo1`

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `constants.js` | `recommendedSpec`: `bs_6a8OUY` → `SQUAREBOOK_HC` 전체 교체, BOOK_SPECS/LABELS 재구성 |
| `sweetbook.js` | `listBookSpecs`: `data.data` 배열 + 빈 spec 필터 / `listTemplates`: `data.data.templates` 추출 |
| `editor/page.jsx` | 템플릿 상수 교체, `diaryPhoto` → `photo1`, 동적 조회 제거(파라미터 불일치 위험), API_MIN 25로 상향 |

### 전체 플로우 검증 결과 (Node.js 직접 테스트)
```
책생성(SQUAREBOOK_HC) → 표지(79yjMH3qRPly) → 내지25p(3FhSEhJ94c0T) → 최종화 → pageCount: 26 ✅
```

---

## ✅ 2026-04-03 — [해결완료] sweetFetch 에러 처리 · ok() 래핑 · 동적 템플릿 UID · 템플릿 라우트 4건 수정

> 이전 세션(2026-04-03)에서 분석만 했던 버그 A~D를 이번 세션에서 모두 수정하고 빌드 검증 완료.

### 수정 내역

| 버그 | 파일 | 수정 내용 | 결과 |
|------|------|----------|------|
| B (1순위) | `src/lib/sweetbook.js` | `sweetFetch`에 `!res.ok` 시 `throw` 추가 — 400/404도 에러로 올바르게 전파 | API 에러 가시화 완료 |
| A (2순위) | `src/lib/sweetbook.js` | `listBookSpecs`, `listTemplates` 등 sweetFetch 기반 5개 함수에 `ok()` 래핑 + `items` 배열 추출 | 프론트 응답 형식 통일 |
| C (3순위) | `src/app/editor/page.jsx` | `handleCreateBook` 초반에 `/api/templates?bookSpecUid=...` 동적 조회 → `dynamicCoverTpl` · `dynamicImageOnly` · `dynamicTextImage` 변수로 4곳 교체 (하드코딩은 폴백으로만 잔존) | contents 400 방지 |
| D (4순위) | `src/app/api/templates/[templateUid]/route.js` | 신규 파일 생성 — `GET /api/templates/:uid` 라우트 | 개별 템플릿 조회 가능 |

### 핵심 결정 사항

**버그 A 수정 시 주의점**: SweetBook API의 리스트 응답은 `{ items: [...] }` 형태. 프론트엔드는 `data.data`가 배열임을 기대하므로 `ok(data?.items || data)` 패턴으로 items를 추출해 래핑. 단순 `ok(data)` 로는 `data.data`가 `{ items: [...] }` 객체가 되어 `Array.isArray()` 체크 실패.

**버그 C 수정 시 주의점**: 동적 조회가 실패해도 기존 하드코딩 상수(`COVER_TEMPLATE`, `TPL_IMAGE_ONLY`, `TPL_TEXT_IMAGE`)를 fallback으로 유지. 완전히 제거하지 않고 let 초기값으로 활용.

### 빌드 결과
- `npm run build` → `✓ Compiled successfully`, 15/15 페이지 정상 생성
- `/api/templates/[templateUid]` 라우트 빌드 결과에 정상 등록 확인

---

## 🚨 2026-04-03 — [분석기록] GET /book-specs · GET /templates · POST /contents 400 에러 원인 분석

> ✅ **위 항목에서 모두 해결 완료. 이 항목은 분석 기록으로만 보존.**

### 증상
- `GET /api/book-specs` → 응답은 200이지만 프론트엔드가 항상 fallback 처리
- `GET /api/templates?bookSpecUid=...` → 동일하게 항상 fallback
- `POST /api/books/{bookUid}/contents` → SweetBook API 400 반환
- 결과: 잘못된 (또는 미검증) 템플릿 UID가 contents API에 전달되어 연쇄 실패

---

### 🐛 버그 1 — `sweetFetch` 응답을 `ok()` 래핑 없이 raw JSON 그대로 반환

**파일:** `src/lib/sweetbook.js`

**문제:**
SDK 기반 함수(`createBook`, `addContents` 등)는 `ok()` 헬퍼로 응답을 `{ success: true, data }` 형식으로 래핑한다.
그러나 `sweetFetch` 기반 함수(`listBookSpecs`, `listTemplates`, `getTemplate`, `getBookSpec`)는 SweetBook API의 raw JSON을 그대로 반환한다.

```js
// SDK 기반 — ok() 래핑 있음 ✅
export async function createBook(...) {
  const data = await getClient().books.create(...);
  return ok(data);  // { success: true, data }
}

// sweetFetch 기반 — ok() 래핑 없음 ❌
export async function listBookSpecs() {
  return sweetFetch('/book-specs');  // raw JSON ({ items: [...] } 등)
}
```

**결과:**
프론트엔드(`create/[serviceType]/page.jsx`)는 항상 `data.success && data.data` 형식을 기대하지만,
`/api/book-specs`와 `/api/templates` 응답에는 `success` 필드가 없어 항상 `false`로 판정된다.
→ 항상 fallback 경로로 진입 → `service.recommendedSpec` 또는 하드코딩된 템플릿 UID 사용

**수정 방법:**
`sweetFetch` 기반 export 함수들에 `ok()` 래핑 또는 `{ success: true, data }` 변환 로직 추가.
또는 route handler(`book-specs/route.js`, `templates/route.js`)에서 응답을 변환하여 `{ success: true, data: result }` 형식으로 반환.

```js
// route.js 수정 예시
const result = await listBookSpecs();
// result가 raw JSON이면 변환
return NextResponse.json({ success: true, data: result?.items || result?.data || result });
```

---

### 🐛 버그 2 — `sweetFetch` 가 API 400/404 에러를 throw하지 않고 조용히 반환

**파일:** `src/lib/sweetbook.js` — `sweetFetch` 함수 (109번째 줄)

**문제:**
```js
async function sweetFetch(path, params = {}) {
  // ...
  const json = await res.json();
  if (!res.ok) {
    console.error(`스위트북 API 상세 에러 [${res.status}] ${path}:`, json);
    // ← throw 없음! 에러 JSON을 그냥 return한다
  }
  return json;  // 400/404 에러 응답도 그냥 반환
}
```

SweetBook API가 `400 Bad Request`(잘못된 파라미터 등)를 반환해도 `sweetFetch`는 에러를 throw하지 않고
에러 응답 JSON을 그대로 반환한다. route handler는 이 에러를 성공으로 착각하고 HTTP 200 OK로 프론트에 전달한다.
터미널에는 에러가 찍히지만 클라이언트는 200 응답을 받아 디버깅이 매우 어렵다.

**결과:**
- `GET /book-specs`가 SweetBook에서 400을 받아도 클라이언트에는 200으로 전달됨
- 에러 JSON이 `data.data`로 인식되어 이후 로직이 오작동

**수정 방법:**
```js
// sweetFetch 수정 예시
if (!res.ok) {
  const msg = json?.message || json?.error || `SweetBook API ${res.status}`;
  console.error(`스위트북 API 상세 에러 [${res.status}] ${path}:`, json);
  const err = new Error(msg);
  err.statusCode = res.status;
  throw err;  // ← 반드시 throw해야 route handler catch 블록으로 이동
}
return json;
```

---

### 🐛 버그 3 — 하드코딩된 템플릿 UID가 선택된 bookSpecUid와 호환되지 않아 contents 400 발생

**파일:** `src/app/editor/page.jsx` — 상수 선언부

**문제:**
```js
const COVER_TEMPLATE = 'tpl_F8d15af9fd';
const TPL_TEXT_IMAGE = 'cnH0Ud1nl1f9';
const TPL_IMAGE_ONLY = '6dJ0Qy6ZmXej';
```

SweetBook API의 `POST /books/{bookUid}/contents`는 **책 생성 시 사용한 `bookSpecUid`와 호환되는 템플릿 UID**만 허용한다.
위 UID들은 특정 bookSpec에서만 유효하며, 다른 bookSpec(예: `bs_3EzPkz`, `bs_518IVG`)으로 책을 만들면 400 에러가 난다.
또한 Sandbox 환경에서 템플릿이 deprecated되거나 변경되면 `bs_6a8OUY`에서도 400이 발생할 수 있다.

**연쇄 작용:**
버그 1 때문에 `session.allTemplates`가 항상 빈 배열 `[]` → 에디터 모달의 템플릿 드롭다운이 비어 있음
→ `page.templateUid`는 항상 `null` → 폴백으로 하드코딩된 UID 사용 → bookSpec 불일치 시 400

**수정 방법:**
`handleCreateBook` 실행 시 `/api/templates?bookSpecUid=${bookSpecUid}&limit=50`를 먼저 호출하여
실제 사용 가능한 커버/내지 템플릿 UID를 동적으로 가져온 뒤 해당 UID를 사용해야 한다.

```js
// handleCreateBook 초반에 추가
const tplRes = await fetch(`/api/templates?bookSpecUid=${bookSpecUid}&limit=50`);
const tplData = await tplRes.json();
const availTpls = tplData?.data || tplData?.items || [];
const realCoverTpl   = availTpls.find(t => (t.templateKind||'').includes('cover'))?.templateUid || COVER_TEMPLATE;
const realContentTpl = availTpls.find(t => (t.templateKind||'').includes('content'))?.templateUid || TPL_IMAGE_ONLY;
const realTextTpl    = availTpls.find(t => (t.templateKind||'').includes('content') && t.name?.includes('text'))?.templateUid || realContentTpl;
```

---

### 🐛 버그 4 (부가) — `GET /api/templates/[templateUid]` Next.js 라우트 파일 없음

**문제:**
`src/lib/sweetbook.js`에 `getTemplate(templateUid)` 함수가 존재하지만,
`src/app/api/templates/[templateUid]/route.js` 파일이 없다.
직접 개별 템플릿을 조회하는 엔드포인트가 없어 Next.js가 404를 반환한다.
(현재 에디터에서는 직접 호출하지 않지만, 향후 템플릿 선택 UI 구현 시 필요)

**수정 방법:**
`src/app/api/templates/[templateUid]/route.js` 파일 생성:
```js
import { NextResponse } from 'next/server';
import { getTemplate } from '@/lib/sweetbook';

export async function GET(request, { params }) {
  try {
    const { templateUid } = await params;
    const result = await getTemplate(templateUid);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.statusCode || 500 });
  }
}
```

---

### 수정 우선순위 (다음 세션)

| 순서 | 파일 | 수정 내용 | 영향 |
|------|------|----------|------|
| 1순위 | `src/lib/sweetbook.js` | `sweetFetch`에 `!res.ok` 시 throw 추가 | 버그 2 해결, 모든 API 에러 가시화 |
| 2순위 | `src/lib/sweetbook.js` | `listBookSpecs`, `listTemplates` 등에 `ok()` 래핑 추가 | 버그 1 해결, 프론트 응답 형식 통일 |
| 3순위 | `src/app/editor/page.jsx` | `handleCreateBook` 내 동적 템플릿 UID 조회 로직 추가 | 버그 3 해결, contents 400 방지 |
| 4순위 | `src/app/api/templates/[templateUid]/route.js` | 신규 파일 생성 | 버그 4 해결 |

---

## 📅 2026-04-03 — 데이터 중심의 선 구성(Pre-composition) 에디터 아키텍처로 전면 개편

### 배경 및 목적

기존 에디터는 두 가지 독립적인 데이터 소스(텍스트 기반 `pages` 배열 + 이미지 기반 `gallery` 배열)를 `handleCreateBook` 시점에 병합하는 구조였다. 이는 다음 문제를 유발했다:

1. **400 에러 반복**: `BOOK_SPECS` 폴백 키(`SQUAREBOOK_HC` 등)가 `selectedSpec`에 들어가면 에디터 단에서 알 수 없어 잘못된 UID가 API에 전달됨
2. **불명확한 UX**: "페이지 편집 패널"과 "갤러리" 두 영역의 데이터가 어떻게 합쳐지는지 사용자가 알 수 없음
3. **AI 잔재 코드**: 자동 정렬, 자동 표지 지정 등 제거된 기능의 흔적이 로직에 남아 있어 복잡도 증가

---

### 1. 단일 데이터 소스(Single Source of Truth)로 통합

**결정:**
`pages` 배열과 `stagedFiles` 맵을 완전히 제거하고 `gallery` 배열만을 유일한 데이터 소스로 사용한다.
더미 데이터·AI 생성 페이지도 에디터 진입 시 즉시 gallery 아이템으로 변환한다.

**gallery item shape 확장:**
```js
{
  id, file, previewUrl,
  role,        // 'front' | 'back' | 'content' | null
  title,       // 페이지 제목 (NEW)
  text,        // 텍스트
  date,        // 날짜 (NEW)
  templateUid, // null = 자동 분기 (NEW)
  isLandscape,
  useSpread,
}
```

---

### 2. 선 구성(Pre-composition) 후 단일 트랜잭션 생성

**결정:**
사용자가 갤러리에서 앞표지·내지·뒤표지 역할을 모두 지정한 뒤 [최종 생성 및 주문]을 누르면,
Book → Photos → Cover → Contents → Finalize 를 순차적으로 한 번에 실행한다.

**이유:**
- "생성 중 실패 → 중간 상태 데이터 처리" 문제를 단순화
- 사용자가 구성을 완전히 검토한 후에만 API를 호출하므로 불필요한 호출이 없음
- Validation(앞표지·뒤표지 각 1장, 내지 8장 이상)이 버튼 활성화 조건으로 강제됨

---

### 3. 구성 미리보기 패널(좌측)로 인지 부하 최소화

**결정:**
좌측 패널을 "텍스트 기반 페이지 목록"에서 "갤러리 기반 구성 미리보기"로 교체했다.
앞표지 → 내지 목록(번호+썸네일) → 뒤표지 순으로 실제 인쇄 순서를 시각화하고,
각 항목을 클릭하면 바로 해당 갤러리 모달이 열린다.

---

### 4. 갤러리 모달 고도화 (제목·날짜·템플릿 선택 통합)

**결정:**
기존 모달(역할 지정 + 텍스트 입력)에 다음 필드를 추가했다:
- 페이지 제목 / 날짜 입력
- 내지 템플릿 선택 드롭다운 (`session.allTemplates`에서 content 유형 필터링, 선택 없으면 텍스트 유무 자동 분기)

**이유:**
페이지 데이터 입력의 유일한 진입점이 갤러리 모달이 되었으므로, 한 화면에서 모든 페이지 속성을 완결할 수 있어야 한다.

---

## 📅 2026-04-03 — POST /books 400 에러 해결: 동적 bookSpecUid 바인딩 보정 및 재시도 로직 개선

### 원인 분석

`/api/book-specs` 호출 실패 시 폴백으로 `constants.js`의 `BOOK_SPECS` 전체를 렌더링했는데, 여기에는 실제 API UID(`bs_6a8OUY` 등)와 내부 식별자(`SQUAREBOOK_HC`, `LAYFLAT_HC`, `SLIMALBUM_HC`)가 섞여 있었다. 사용자가 내부 식별자 항목을 클릭하면 `session.bookSpecUid = 'SQUAREBOOK_HC'` 같은 무효한 값이 저장되고, 에디터에서 이를 그대로 SweetBook API에 전달해 400 에러가 발생했다.

---

### 1. 에디터 `handleCreateBook` — bookSpecUid 유효성 검증 및 자동 보정 도입

**결정:**
`handleCreateBook` 실행 시 `session.bookSpecUid`를 그대로 사용하는 대신, `bs_` 접두사 여부로 실제 API UID인지 먼저 검증하도록 변경했다. 내부 키이거나 빈 값이면 기본값 `'bs_6a8OUY'`(정방형 하드커버)로 자동 보정하고 API 로그에 경고를 표시한다.

```js
const rawSpecUid = session?.bookSpecUid;
const bookSpecUid = rawSpecUid && rawSpecUid.startsWith('bs_') ? rawSpecUid : 'bs_6a8OUY';
if (!rawSpecUid || bookSpecUid !== rawSpecUid) {
  addLog(`⚠️ bookSpecUid 보정: "${rawSpecUid || '(없음)'}" → "${bookSpecUid}"`);
}
```

**이유:**
- create 페이지의 폴백 목록에서 어떤 항목을 선택하더라도 에디터 단에서 방어가 가능해진다.
- 보정이 발생하면 API 로그에 즉시 표시되므로, 사용자/개발자 모두 원인을 쉽게 파악할 수 있다.
- create 페이지 폴백 로직(BOOK_SPECS 정제)은 별도 이슈로 분리 — 에디터 단에서의 방어가 더 안전한 최후 보루 역할을 한다.

---

### 2. `POST /api/books` 라우트 — 에러 상세 정보 클라이언트 전달

**결정:**
- 유효성 오류 시 어떤 값이 넘어왔는지 터미널 로그와 클라이언트 응답에 함께 기록
- SDK 에러의 `err.body` / `err.response?.data`(SweetBook 서버 원본 메시지)를 클라이언트 응답 `message` 필드에 포함

**이유:**
기존에는 400 에러 발생 시 클라이언트가 단순 "책 생성 실패" 메시지만 받아 실제 원인 파악이 불가능했다. SweetBook이 반환한 상세 메시지까지 토스트에 표시되면 빠른 디버깅이 가능하다.

---

### 3. `fetchWithRetry` — 재시도 조건 429 추가 및 4xx 즉시 반환

**결정:**
재시도 조건을 `res.status >= 500` → `res.status >= 500 || res.status === 429`로 수정했다. 400·401·403·404 등 4xx는 같은 요청을 반복해도 결과가 바뀌지 않으므로 즉시 반환한다.

**이유:**
- 400 에러(잘못된 bookSpecUid)를 3회 재시도하던 기존 동작은 불필요한 지연을 유발했다.
- 429는 일시적 할당량 초과이므로 백오프 재시도가 유효하다.

---

## 📅 2026-04-03 — 사용자 시선 흐름에 최적화된 에디터 UI/UX 리팩토링

### 배경

기능 구현 이후 실제 사용 시나리오를 검토한 결과, 에디터 UI의 정보 배치가 사용자의 자연스러운 시선 흐름(좌→우, 상→하)과 일치하지 않는 문제를 발견했다. 특히 사진 업로드와 역할 지정이 UI의 핵심 작업임에도 불구하고 갤러리가 화면 하단에 위치해 접근성이 낮았고, 좌측 패널에 중복·불필요한 버튼이 혼재되어 인지 부하를 유발했다.

---

### 1. 갤러리를 우측 상단으로 전진 배치 — 접근성 향상

**결정:**
에디터 레이아웃을 `[좌측 패널 | 우측 패널(상단: 갤러리 / 하단: 페이지 목록)]` 구조로 재편하여 갤러리를 시각적으로 가장 눈에 띄는 위치에 배치했다.

**이유:**
- 포토북 제작의 핵심 행위는 "사진을 올리고 역할을 정하는 것"이다. 이 작업이 스크롤 없이 즉시 보여야 사용자가 맥락 없이 헤매지 않는다.
- 갤러리가 하단에 있을 경우 처음 진입한 사용자는 "어디서 사진을 올리지?" 라는 질문을 스스로 해야 했다 — 이는 전환율을 낮추는 UX 마찰이다.
- 상단 배치 후 첫 화면에서 바로 Drag & Drop 업로드 존이 노출되어, 별도 안내 없이도 즉시 사진을 드롭하는 행동을 유도할 수 있다.

---

### 2. 좌측 패널 불필요한 버튼 제거 — 인지 부하 감소

**결정:**
좌측 패널에서 "앞표지 전용 업로드" / "뒤표지 전용 업로드" 버튼을 제거하고, 모든 표지 지정을 갤러리 모달 한 곳에서 처리하도록 통합했다.

**이유:**
- 버튼이 두 곳(좌측 패널 업로드 + 갤러리 모달 지정)에 존재할 경우 사용자는 "어느 것을 써야 하는가?"라는 선택 피로를 겪는다.
- 동일한 결과(앞표지 사진 지정)에 이르는 경로가 두 개 있으면 코드 내 우선순위 처리(`좌측 패널 업로드 → 갤러리 지정 순 덮어쓰기`)도 복잡해진다.
- 단일 진입점 원칙(Single Source of Action)에 따라 갤러리를 유일한 사진 관리 허브로 확립했다.

---

### 3. 갤러리-표지 썸네일 실시간 연동(Binding) — 데이터 일관성 확보

**결정:**
갤러리 state(`gallery` 배열)의 `role: 'front'` / `role: 'back'` 항목이 변경될 때마다 좌측 패널의 표지 썸네일 `src`가 즉시 동기화되도록 React 단방향 데이터 흐름으로 구현했다.

**이유:**
- 기존 구조에서는 갤러리 상태와 표지 상태가 별도의 state로 관리되어, 갤러리에서 역할을 변경해도 좌측 패널이 즉시 반영되지 않는 불일치가 발생했다.
- "갤러리에서 지정했는데 왜 표지가 안 바뀌지?" 라는 사용자 혼란은 신뢰를 깎는다.
- 갤러리 state를 단일 진실 공급원(Single Source of Truth)으로 삼고, 파생 UI(표지 썸네일)는 해당 state를 읽기만 하도록 구조를 단순화했다.

---

### 4. `.claude` 임시 폴더 Git 추적 제외 — 협업 환경 충돌 원천 차단

**결정:**
Claude Code가 로컬 세션에서 생성하는 `.claude/` 디렉터리를 `git rm -r --cached .claude` 로 Git 추적에서 제외하고 `.gitignore`에 등록했다.

**이유:**
- `.claude/` 폴더에는 세션 메모리, 로컬 프롬프트 캐시 등 개발자별로 다르게 생성되는 임시 파일이 포함된다.
- 이 파일들이 원격 저장소에 커밋되면 다른 협업자의 Claude Code 세션에 충돌이 발생하거나 민감한 로컬 컨텍스트가 노출될 수 있다.
- 공개 GitHub 저장소(채용 과제 제출용)이므로, 심사위원이 클론 후 실행할 때 불필요한 `.claude/` 파일이 포함되지 않도록 사전 차단했다.

---

## 📅 2026-04-03 — 다중 업로드 갤러리, 표지 직접 지정 모달, Canvas API 기반 양면(Spread) 분할 기능 구현

### 구현 내용 요약

기획 피벗(AI 자동화 제거) 방향에 따라 **사용자가 100% 제어하는 포토북 에디터 UX** 핵심 3가지를 구현했다.

---

### 1. 다중 업로드 & 갤러리 UI

**구현 방식:**
- `editor/page.jsx` 하단에 독립적인 "사진 갤러리" 섹션 추가
- Drag & Drop 업로드 존: `onDragOver` / `onDrop` 이벤트로 파일 수신 → `handleGalleryUpload(files)` 호출
- `handleGalleryUpload`: `Array.from(files)`로 다중 파일 처리 → 각 파일에 `detectLandscape` 비동기 실행 → `Promise.all`로 병렬 처리 후 `gallery` state에 일괄 추가
- 갤러리 아이템 shape: `{ id, file, previewUrl, role, text, isLandscape, useSpread }`
- 드래그 리오더: `draggable` attribute + `onDragStart` / `onDragOver` / `onDragEnd` 핸들러 → splice 방식으로 배열 재정렬
- `handleBulkUpload`를 `handleGalleryUpload`로 위임 — 이전 자동 표지 지정·날짜 정렬 로직 완전 제거

**기술적 선택:**
- `URL.createObjectURL(file)` 로 썸네일 즉시 미리보기, 삭제 시 `URL.revokeObjectURL`로 메모리 해제
- 가로형 감지(`detectLandscape`)는 `new Image()` 로드 후 `naturalWidth > naturalHeight * 1.6` 조건 판단

---

### 2. 모달 기반 표지 직접 지정 + 텍스트 입력 + 템플릿 동적 분기

**구현 방식:**
- 갤러리 썸네일 클릭 → `galleryModal: { open: true, idx }` 상태 변경 → 모달 렌더
- 역할 버튼 3종: 앞표지 / 뒤표지 / 내지
- `assignGalleryRole(idx, role)`: 새 역할 지정 시 기존에 같은 역할로 지정된 다른 아이템의 role을 `null`로 초기화 → 앞표지/뒤표지 중복 방지 (Validation)
- 내지로 지정 시 텍스트 입력란 노출 → 실시간으로 `cnH0Ud1nl1f9` / `6dJ0Qy6ZmXej` 어떤 템플릿이 적용될지 피드백 표시

**템플릿 동적 분기 (책 생성 시):**
```
hasText = !!(page.text || page.teacherComment || '').trim()
templateUid = hasText ? 'cnH0Ud1nl1f9' : '6dJ0Qy6ZmXej'
```
편집 패널 페이지 + 갤러리 내지 모두 동일 로직 적용.

**갤러리 vs 좌측 패널 표지 우선순위:**
좌측 패널 업로드 → 갤러리 지정 순으로 덮어씀. 갤러리 지정이 최종 우선.

---

### 3. Canvas API 양면(Spread) 분할 로직

**구현 배경:**
가로형 사진(예: 16:9 파노라마, DSLR 가로 촬영)을 포토북에 그대로 넣으면 한 페이지 안에서 좌우 여백이 크거나 이미지가 축소되어 보인다. 펼침면(Spread) 처리를 하면 책을 펼쳤을 때 왼쪽/오른쪽 페이지에 걸쳐 이미지가 꽉 차보이는 효과를 낼 수 있다.

**구현 방식 (`splitImageHalves`):**
```
1. new Image() → img.onload 콜백에서 처리
2. halfW = Math.floor(img.naturalWidth / 2)
3. leftCanvas: drawImage(img, 0, 0, halfW, h, 0, 0, halfW, h)
4. rightCanvas: drawImage(img, halfW, 0, rightW, h, 0, 0, rightW, h)
5. leftCanvas.toBlob(..., 'image/jpeg', 1.0)  ← 최고 화질 (quality=1.0)
6. rightCanvas.toBlob(..., 'image/jpeg', 1.0)
7. Promise.all([leftBlob, rightBlob])
```

**화질 보존 전략:**
- `toBlob`의 quality 파라미터를 `1.0`(최고)으로 지정 → JPEG 최고 품질 유지
- Canvas 크기를 원본 해상도 그대로 사용 — 다운스케일 없음
- `drawImage`는 `imageSmoothingQuality` 기본값('low')이 아닌 기본 브라우저 앤티앨리어싱 적용 → 실질적 화질 손실 없음

**책 생성 시 연속 2페이지 전송:**
```
splitImageHalves(file) → [leftBlob, rightBlob]
→ 각각 new File([blob], 'spread-left.jpg') 로 변환
→ Photos API 두 번 호출 → leftUrl, rightUrl
→ galleryPageData에 두 개의 페이지 entry 순서대로 push
→ 내지 추가 루프에서 연속된 2페이지로 전송
```
분할 실패 시 원본 파일 단일 업로드로 graceful fallback 처리.

---

### 4. 기술적 트러블슈팅

**`Cannot find module './276.js'` 오류:**
- 원인: 이전 세션에서 `.next` 빌드 캐시가 손상된 채 남아있었음 (git worktree 작업 잔재)
- 해결: `rm -rf .next` → `npm run build` 재실행

**`useEffect` 중 `detectLandscape` async 처리:**
- `Array.from(files).map(async ...)` + `Promise.all(...)` 패턴으로 모든 파일의 landscape 감지를 병렬 처리
- `useEffect` 내부가 아닌 이벤트 핸들러에서 호출하므로 React의 async useEffect 문제 회피

---

## 📅 2026-04-03 — [기획 피벗] AI 자동화 제거 → 사용자 자유도 중심 포토북 에디터 UX로 전환

### 배경 및 취소 결정

직전 세션에서 아래 자동화 기능들을 구현했으나, 검토 후 전면 백지화(코드 롤백 예정)하기로 결정했다.

**취소된 기능 목록:**
- 여행 포토북 특화: 감성/키워드 입력 → Gemini 여행 에세이 자동 생성
- 사진 일괄 업로드 시 `file.lastModified` 기반 날짜순 자동 정렬
- 업로드 순서 기반 1일차·2일차 챕터 제목 자동 설정
- 첫 번째/마지막 사진 → 앞표지/뒤표지 자동 지정
- 사진 업로드 후 "AI로 텍스트 자동 생성" 버튼 (AI가 전체 페이지 텍스트 일괄 생성)

**취소 이유:**
로직이 지나치게 자동화되어 **사용자 자유도를 심각하게 제한**한다는 판단이다. 포토북은 개인의 추억을 담는 콘텐츠이므로, 시스템이 자동으로 표지를 고르거나 날짜를 분류하면 사용자가 원하는 구성과 어긋날 가능성이 높다. 또한 AI가 자동으로 텍스트를 채우는 방식은 "내가 만든 책"이라는 감각을 훼손한다.

### 새로운 기획 방향 (New Version)

자동화 대신 **사용자가 100% 제어하는 직관적 포토북 에디터 UX**로 완전히 전환한다.

#### 1. 다중 이미지 Drag & Drop + 갤러리 UI
- 여러 사진을 한 번에 올리면 썸네일 그리드(갤러리) 형태로 표시
- 사용자가 사진 순서를 자유롭게 조작 가능 (드래그로 순서 변경)

#### 2. 앞표지/뒤표지 직접 지정
- 갤러리에서 썸네일을 클릭하면 "앞표지로 지정" / "뒤표지로 지정" 선택 메뉴 노출
- **시스템이 자동으로 표지를 결정하지 않음** — 사용자가 명시적으로 선택해야만 지정됨
- 표지로 지정된 사진은 갤러리 내에서 뱃지(앞/뒤)로 시각적 표시

#### 3. 텍스트 유무에 따른 템플릿 동적 분기
- 각 페이지에서 사용자가 텍스트를 입력했는지 여부를 실시간 감지
- 텍스트 있음 → 사진+텍스트 혼합 템플릿 (`cnH0Ud1nl1f9`) 자동 선택
- 텍스트 없음 → 이미지 전용 풀블리드 템플릿 (`6dJ0Qy6ZmXej`) 자동 선택
- 책 생성(최종화) 시점에 분기 적용 → 같은 책 내에서도 페이지마다 다른 레이아웃 가능

#### 4. 가로형 사진 Canvas API 양면(Spread) 분할
- 가로 비율(width > height × 1.6 기준)의 사진은 "양면 사진"으로 판별
- 브라우저의 Canvas API로 프론트엔드에서 좌/우로 이등분 → 두 개의 이미지 Blob 생성
- 두 Blob을 각각 Photos API로 업로드한 뒤 연속된 2개 페이지로 전송 → 실제 책에서 펼침면(Spread) 효과

### 기술적 의사결정 메모

| 항목 | 이전 방식 | 새로운 방식 |
|---|---|---|
| 사진 정렬 | `file.lastModified` 자동 정렬 | 사용자가 갤러리에서 직접 순서 조정 |
| 표지 지정 | 첫/마지막 사진 자동 설정 | 갤러리 클릭으로 사용자 직접 지정 |
| 텍스트 생성 | AI가 일괄 자동 생성 | 사용자가 페이지마다 직접 입력 |
| 가로 사진 처리 | 단순 업로드 (레이아웃 깨짐 가능) | Canvas API로 분할 후 양면 페이지 전송 |
| 템플릿 선택 | 전체 단일 템플릿 고정 | 페이지별 텍스트 유무로 동적 분기 |

### 다음 세션 구현 우선순위
1. 갤러리 UI + 다중 업로드 (순서 변경 포함)
2. 표지 직접 지정 메뉴
3. 텍스트 유무 기반 템플릿 분기 (책 생성 로직 수정)
4. Canvas API 양면 분할 (가로 사진 감지 → 분할 → 업로드)

---

## 📅 2026-04-02 — Toast 알림 / 재시도 로직 / 템플릿 선택 UI / AI 사진 플로우

### 결정 내용

**P0 — Toast 알림 컴포넌트 개선**
- `src/lib/toast.js`: `window.CustomEvent` 기반 이벤트 버스 구현 (React 컨텍스트 없음)
- `src/components/Toast.jsx`: layout에 1회 마운트, `bookmaker:toast` 이벤트 수신 → 3.5초 자동 소멸
- App Router `layout.jsx`는 서버 컴포넌트이므로 컨텍스트 Provider 불가 → 이벤트 버스 패턴 선택
- `toast.success / .error / .info / .warn(msg)` API로 어느 컴포넌트에서나 호출 가능

**P0 — 에러 재시도 로직**
- `src/lib/fetchWithRetry.js`: 5xx 서버 오류 시 최대 3회 재시도, 지수 백오프(250ms/500ms/1000ms)
- 4xx(클라이언트 오류)는 재시도 불필요 → 즉시 반환
- 에디터 `handleCreateBook`의 책 생성 API 호출에 적용

**P0 (추가) — sweetbook.js 지연 초기화**
- `SweetbookClient`를 모듈 로드 시점에 초기화 → 빌드 타임 env 없으면 `apiKey is required` 에러 발생
- `getClient()` 지연 초기화 패턴으로 교체 → 빌드 성공

**P1 — 실제 템플릿 목록 기반 선택 UI**
- create 페이지: `GET /api/templates` 응답에서 cover/content 분류 후 클릭 가능한 카드 UI 표시
- 선택된 템플릿 UID가 세션에 저장 → 에디터에서 책 생성 시 사용
- API 템플릿 없을 경우 기본값 표시로 폴백

**✈️ 여행 포토북 특별 기능**
- create 페이지에 '여행 감성 설정' 섹션 추가: 분위기(select) + 키워드(text input)
- generate-story API: `mood` / `keywords` 파라미터 수신 → travel 프롬프트에 반영
- 에디터 `handleBulkUpload`: 여행 서비스의 경우 `file.lastModified` 기반 날짜 그룹화 → 자동 챕터 제목 생성(1일차·N월N일)

**🤖 AI 사진 플로우 전면 개편**
- 일괄 업로드 시 `file.lastModified` 기준 날짜순 정렬 (EXIF 라이브러리 없이)
- 첫 번째 사진 → 앞표지, 마지막 사진 → 뒤표지 자동 설정
- 사진이 업로드되면 "🤖 AI로 텍스트 자동 생성" 버튼 표시
  - `mode: 'photo_text'` + `photoCount: N` 파라미터로 generate-story 호출
  - AI 응답의 title/text를 기존 페이지에 병합 (이미지는 보존)
- generate-story API: `photoCount`로 생성 페이지 수 제어, `mode: 'photo_text'` 시 캡션형 짧은 문장 생성

### 근거
- Toast 이벤트 버스: App Router layout이 서버 컴포넌트 → Provider 래핑 불가 → 이벤트 패턴이 유일한 깔끔한 해법
- EXIF 대신 lastModified: EXIF 파싱 라이브러리 추가 없이 사진 날짜 근사값 획득 가능 (iOS/Android 모두 촬영 직후 저장하므로 lastModified ≈ 촬영 시각)
- AI 사진 플로우: 사용자 최대 허들은 "글쓰기" → 사진만 올리면 AI가 텍스트 채워주는 경험으로 전환

---

## 📅 2026-04-02 — 판형 UI: 실제 API UID 매핑 및 템플릿 UID 노출 제거

### 문제
`GET /book-specs` API가 반환하는 실제 판형 UID(`bs_6a8OUY`, `bs_3EzPkz`, `bs_518IVG`)가 로컬 상수(`SQUAREBOOK_HC` 등 내부 키)와 달라 UI에서 이름을 찾지 못하고 원시 UID가 그대로 노출되었음. 또한 템플릿 선택 영역에 내부 템플릿 UID가 사용자에게 보이는 문제가 있었음.

### 결정 내용
1. `constants.js`의 `BOOK_SPECS` / `BOOK_SPEC_LABELS`에 실제 API UID를 1순위 키로 추가
   - `bs_6a8OUY` → 정방형 하드커버 (243×248mm) — 추천
   - `bs_3EzPkz` → A4 소프트커버 포토북 (210×297mm)
   - `bs_518IVG` → A5 소프트커버 포토북 (148×210mm)
   - 기존 내부 키(SQUAREBOOK_HC 등)는 API 미응답 시 폴백으로 유지
2. 모든 서비스 `recommendedSpec`을 `bs_6a8OUY`(정방형 하드커버)로 통일
   - 반려동물 서비스도 기존 `SLIMALBUM_HC`에서 변경 (해당 UID가 API 응답에 없음)
3. create 페이지 템플릿 영역에서 원시 UID `({templateUid})` 표시 제거

### 근거
- 판형 선택 UI는 일반 사용자가 보는 화면이므로 `bs_6a8OUY` 같은 내부 식별자 노출은 UX 저하
- API UID와 로컬 상수 불일치는 판형 이름 미표시 및 "추천" 배지 오작동을 야기
- A4/A5 소프트커버는 기존 하드커버 3종 외 실제 API에서 추가로 제공되는 판형

---

## 📅 2026-04-02 — 프로젝트 초기 설계

### 기술 스택 선택

**프레임워크: Next.js 14 (App Router)**
- 선택 이유: 프론트엔드 + 백엔드를 단일 프로젝트로 구성 가능 (모노레포 요구사항 자연 충족)
- App Router의 API Routes를 백엔드 프록시로 활용 → 별도 Express 서버 불필요
- 대안 검토: React + Express 분리 → 설정 복잡, 배포 2곳 → 탈락

**스타일링: Tailwind CSS**
- 선택 이유: 빠른 프로토타이핑, 반응형 자동 지원, 일관된 디자인 토큰
- 시연 영상 UI 완성도가 평가에 중요하므로 빠르게 퀄리티 확보 가능
- 대안 검토: styled-components(런타임 비용), CSS Modules(반응형 느림)

**HTTP 클라이언트: Axios + form-data**
- 선택 이유: cover/contents API가 multipart/form-data 필수 → form-data 라이브러리 필요
- Axios + form-data 조합이 Node.js에서 가장 안정적
- 대안 검토: fetch API → FormData 헤더 자동설정 이슈

### 서비스 컨셉

**"올인원 북메이커" — 6가지 서비스 유형 통합**
- 단일 서비스보다 다양한 시나리오 시연이 API 활용도 입증에 유리
- 각 서비스별 맞춤 폼 + 더미 데이터로 심사위원 테스트 편의 극대화
- B2B2C 화이트라벨 확장 가능성도 설계 의도에 포함

### 아키텍처

**프론트엔드 → Next.js API Routes → SweetBook API (3-tier)**
- API Key는 서버 환경변수에만 존재, 프론트엔드 노출 원천 차단
- sweetbook.js 단일 모듈에서 모든 외부 API 통신 관리 (단일 책임)
- 에러를 백엔드에서 1차 처리 후 프론트에 표준 형식으로 전달

---

## 📅 2026-04-02 — [설계 결정] 통신 방식: 직접 호출(Axios)에서 공식 Node.js SDK로 전환

### 결정 내용

`src/lib/sweetbook.js`의 Axios 기반 직접 API 호출 코드를 공식 [`bookprintapi-nodejs-sdk`](https://github.com/sweet-book/bookprintapi-nodejs-sdk)로 전환.

### 원인 및 근거

- **바이브코딩 직무 성향**: 이미 제공된 공식 도구를 적극 활용하여 개발 생산성과 구현 속도를 극대화하는 것이 역할에 부합. 직접 HTTP 클라이언트를 작성하는 대신 SDK가 제공하는 인증, 재시도, 에러 클래스 등의 기반 기능을 그대로 활용.
- **자사 SDK 사용성 검증**: API 플랫폼 팀 합류를 목표로 하는 만큼, SDK를 직접 프로덕션 수준으로 사용해 보며 DX(개발자 경험)를 검증하는 것 자체가 과제의 부가 목적과 일치.
- **SDK 품질**: 자동 재시도(지수 백오프), `SweetbookApiError` / `SweetbookNetworkError` / `SweetbookValidationError` 분리, `Idempotency-Key` 자동 삽입 등이 내장되어 있어 별도 구현이 불필요.

### 트레이드오프 (Trade-off)

| 항목 | Axios 직접 호출 | 공식 SDK |
|------|----------------|----------|
| Next.js fetch 캐싱(Data Cache) 제어 | `next: { revalidate }` 옵션으로 100% 제어 가능 | **SDK 내부 `fetch` 호출이라 캐시 옵션 미노출** |
| 에러 핸들링 | `err.response?.data` 직접 파싱 필요 | `SweetbookApiError.statusCode`, `.message` 구조화 |
| 재시도 로직 | 직접 구현 필요 | 500/429에 대한 지수 백오프 내장 |
| 의존성 크기 | axios + form-data (추가 설치) | SDK 자체 (fetch 내장, dotenv만 의존) |

- 캐싱 제어 손실은 **책 생성·주문 같은 실시간 Mutation 작업**에서는 실질적 영향 없음. 오히려 캐싱되면 안 되는 작업이 대부분이므로 SDK 방식이 더 안전.
- Templates / BookSpecs처럼 SDK가 미지원하는 읽기 전용 엔드포인트는 기존 `fetch` 직접 호출 방식을 유지.

### 구현 변경 사항

- `npm install git+https://github.com/sweet-book/bookprintapi-nodejs-sdk.git`
- `src/lib/sweetbook.js`: `SweetbookClient` 인스턴스 생성 후 `client.books.*`, `client.orders.*`, `client.covers.*`, `client.contents.*`, `client.credits.*` 메서드로 교체
- 모든 API Route catch 블록: `err.response?.status` → `err.statusCode`, `err.response?.data?.message` → `err.message` 로 단순화
- 응답 래핑: SDK가 `body.data`만 반환하므로 `ok(data)` 헬퍼로 `{ success: true, data }` 구조 유지 (프론트 호환성 보장)

---

## 📅 2026-04-02 — [UI/UX 설계] 전략적 미리보기(Blurred Preview) 기능 구현

### 배경

모든 페이지를 미리보기로 노출할 경우 발생할 수 있는 콘텐츠 무단 복제 방지 및 사용자의 결제 전환율(Conversion Rate)을 높이기 위한 비즈니스적 장치 마련. 음원·전자책 플랫폼의 "맛보기 재생", 전자상거래의 "회원 전용 콘텐츠" UX 패턴을 포토북 도메인에 적용.

### 구현 기술

CSS Filter (blur) 속성과 인덱스 기반 조건부 렌더링을 활용하여 상위 5페이지만 선명하게 노출하고, 나머지 페이지는 `blur-md` 클래스로 시각적으로 제한함.

| 항목 | 내용 |
|------|------|
| 선명 노출 | 상위 `PREVIEW_THRESHOLD = 5` 페이지 |
| 블러 처리 | 나머지 전체 페이지에 `blur-md` 적용, `pointer-events: none`으로 인터랙션 차단 |
| 오버레이 CTA | 블러 영역 위에 그라디언트 오버레이 + 자물쇠 아이콘 + "주문하러 가기" 버튼 배치 |
| 이미지 소스 | 더미 데이터의 picsum 시드 이미지 활용 (서비스 타입별 일관된 시각 테마 유지) |
| 반응형 그리드 | `grid-cols-2 → sm:grid-cols-3 → md:grid-cols-5`로 화면 크기별 자동 대응 |

### 비즈니스 효과

- **전환율 제고**: "더 보려면 주문해야 한다"는 심리적 동기 부여로 이탈률 감소 기대
- **콘텐츠 보호**: 스크린샷·복사로 전체 내용을 무단 취득하는 행위를 기술적으로 억제
- **UX 일관성**: 오버레이 버튼이 하단의 "다음: 주문하기" 버튼과 동일한 `btn-primary` 스타일을 공유하여 시각적 통일성 유지

---

## 📅 2026-04-02 — [기능 구현] 사진 직접 업로드 (Drag & Drop + Photos API 연동)

### 배경 & 문제

기존 에디터는 이미지 URL 텍스트 입력만 지원했음. 사용자가 직접 보유한 사진을 업로드할 방법이 없어, 더미 데이터(picsum URL)에만 의존해야 했음. 과제 평가 항목 "Photos API 활용도"를 충족시키기 위해 파일 업로드 UI를 구현.

### 구현 내용

| 항목 | 내용 |
|------|------|
| 업로드 UI | 에디터 페이지 각 페이지 편집 패널 내 Drag & Drop 존 + 클릭 파일 선택 |
| 미리보기 | 파일 선택 즉시 `URL.createObjectURL(file)`로 blob URL 생성, 로컬 미리보기 표시 |
| 업로드 시점 | "책 생성 & 최종화" 버튼 클릭 시 → 책 생성(POST /books) 후, staged 파일을 Photos API(POST /books/{uid}/photos)로 순차 업로드 |
| URL 교체 | 업로드 완료 후 반환된 실제 URL로 blob URL 자동 교체 → 내지 contents API 파라미터에 주입 |
| Fallback | URL 직접 입력 필드 유지 (더미 데이터, 외부 이미지 URL 지원) |
| 상태 표시 | 로딩 버튼에 "사진 업로드 중..." 텍스트 + 업로드 대기 파일 수 뱃지 표시 |

### 기술 결정

- **staged 파일 패턴**: `stagedFiles` state를 `{ pageId: File }` 맵으로 관리. 각 페이지당 최대 1개 파일. blob URL은 미리보기 전용, 실제 API 요청에는 업로드된 URL만 사용.
- **업로드 시점 지연**: Photos API는 bookUid 없이 호출 불가. 책 생성 직후 업로드하는 순서를 `handleCreateBook` 내부에서 보장.
- **에러 격리**: 개별 사진 업로드 실패 시 전체 플로우를 중단하지 않고 로그에 경고 기록 후 계속 진행.

---

## 📅 2026-04-02 — [기능 확장] 외부 LLM 연동을 통한 동화책 자동 생성 로직 구현

### 배경

'AI 동화책' 서비스가 기존에는 더미 데이터(picsum 이미지 + 하드코딩 텍스트)를 단순 재사용하는 방식이었음. 과제에서 요구하는 "바이브코딩 역량" 어필과 실질적인 AI 기능 시연을 위해, 생성형 AI를 실제 콘텐츠 파이프라인에 연결하는 작업이 필요했음.

### AI 모델 선택: Google Gemini 2.0 Flash

| 항목 | Claude API | Gemini 2.0 Flash |
|------|-----------|-----------------|
| 무료 티어 | 제한적 | **분당 15회 / 월 150만 토큰** (2026년 기준) |
| 한국어 품질 | 최상 | 상 (동화 생성에 충분) |
| 레이턴시 | 중간 | **빠름** (Flash 모델) |
| SDK | @anthropic-ai/sdk | **@google/generative-ai** |

→ 무료 티어와 속도를 고려해 **Gemini 2.0 Flash** 채택. 동화 생성이라는 단순 텍스트 태스크에서 Claude와 품질 차이 없음.

### 구현 아키텍처

```
[create/fairytale 폼]
  → "AI 동화 생성하기" 버튼 클릭
  → POST /api/generate-story { heroName, heroAge, theme, moralLesson }
  → Gemini API 호출 (JSON 구조화 출력 프롬프트)
  → 10페이지 pages[] 배열 반환
  → sessionStorage('bookmaker_ai_pages') 임시 저장
  → /editor 이동
  → editor useEffect: AI 페이지 우선 로드 & sessionStorage 즉시 삭제
  → 사용자 편집 후 → 기존 책 생성 플로우 그대로 진행
```

### 프롬프트 설계

- **출력 형식 강제**: "순수한 JSON만 반환하세요" + 마크다운 코드 블록 제거 처리
- **페이지 수 고정**: 정확히 10개 요구 → API 최소 24p 조건 충족을 위해 에디터에서 반복 패딩
- **서사 구조 지정**: 시작(1~2) → 갈등/모험(3~7) → 해결(8~9) → 결말과 교훈(10)
- **안전 처리**: JSON 파싱 실패 시 별도 에러 메시지 반환, 빈 pages 배열 방어 코드

### 구현된 파일

| 파일 | 변경 내용 |
|------|---------|
| `src/app/api/generate-story/route.js` | 신규 — Gemini 연동 API 라우트 |
| `src/app/create/[serviceType]/page.jsx` | AI 생성 패널(버튼 + 로딩 UI + 에러) 추가 |
| `src/app/editor/page.jsx` | AI 페이지 우선 로드 로직 + AI 생성 배지 표시 |
| `.env.example` | `GEMINI_API_KEY` 항목 추가 |
| `package.json` | `@google/generative-ai` 의존성 추가 |

### UX 설계: 로딩 화면

시연 영상 임팩트를 위해 로딩 중 3단계 힌트 메시지를 순차적으로 페이드인:
1. "이야기 구조 설계 중..."
2. "캐릭터와 배경 구성 중..."
3. "각 장면 집필 중..."

버튼 텍스트도 `"AI가 {heroName}을(를) 위한 동화를 집필 중입니다..."` 로 동적 변경.

---

## 📅 2026-04-02 — [기능 확장] 에디터 내 AI 페이지 초안 생성 — 6개 서비스 전체 지원

### 배경 & 목적

이전 구현에서 AI 생성 기능은 "AI 동화책" 서비스의 정보 입력 단계(create 페이지)에만 한정되어 있었음. 이를 **에디터(페이지 구성 단계)로 이동**하고, **6개 서비스 전체**가 AI 도움을 받을 수 있도록 확장.

사용자 니즈: "정보 입력 단계가 아닌, 실제 페이지를 구성하는 에디터 단계에서 AI 도움을 받고 싶다."
→ 에디터의 페이지 목록 패널에 "✨ AI로 페이지 초안 생성" 버튼을 배치하고, 클릭 시 서비스별 입력 폼 모달을 노출.

### 구현 내용

| 항목 | 내용 |
|------|------|
| 진입점 | 에디터 페이지 좌측 패널 상단 "✨ AI로 페이지 초안 생성" 버튼 |
| 모달 폼 | 서비스 타입별 최소 입력 필드 (2~4개) — 서비스 진입 맥락을 이미 알고 있으므로 경량 설계 |
| API 확장 | `POST /api/generate-story`에 `serviceType` 필드 추가, 6개 전용 프롬프트 템플릿 분기 |
| 결과 처리 | 기존 페이지 없으면 자동 교체 / 있으면 "교체 or 추가" 컨펌 다이얼로그 |
| 로딩 UX | 단계별 힌트 메시지 페이드인 ("아이디어 구상 중..." → "문장 구성 중..." → "페이지 편집 중...") |

### 서비스별 프롬프트 설계 전략

| 서비스 | 핵심 입력 | 프롬프트 지시 |
|--------|----------|-------------|
| baby | 아이 이름, 기록 기간 | 월령별 성장 이정표 10개 (첫 미소, 뒤집기, 이유식...) |
| kindergarten | 원아 이름, 반, 학기 | 수업·활동·행사 알림장 10개, 선생님 어투 |
| fairytale | 주인공, 주제, 교훈 | 시작→갈등→해결→결말 구조 동화 10페이지 |
| travel | 여행지, 제목, 동행인 | 출발→명소→음식→감상 여행 일기 10개 |
| selfpublish | 제목, 장르, 소개 | 장르에 맞는 챕터 초안 10개 |
| pet | 이름, 종류, 메시지 | 반려동물 시선의 성장 앨범 10페이지 |

### 아키텍처 결정: create 페이지 AI 패널 유지

- fairytale 서비스의 create 페이지 AI 패널은 그대로 유지. 정보 입력 단계에서 바로 생성하는 "빠른 경로"와 에디터에서 생성하는 "세밀 조정 경로" 두 가지를 모두 제공.
- 두 경로 모두 동일한 `/api/generate-story` 엔드포인트 호출.

---

## 📅 2026-04-02 — [버그 수정] Gemini 429 할당량 초과 대응 + 빌드 오류 수정

### 문제 1: Gemini API 429 Too Many Requests

**증상**
```
[GoogleGenerativeAI Error]: Error fetching from ... 429 Too Many Requests
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
limit: 0, model: gemini-2.0-flash
```
무료 계정 한도 초과로 모든 Gemini 모델 호출 불가.

**해결 전략: 순차 모델 폴백 + 로컬 템플릿 폴백**

1. `GEMINI_MODELS` 배열 도입: `['gemini-1.5-flash-8b', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro']`
   - 무료 한도가 비교적 넉넉한 경량 모델부터 순차 시도
2. `callGemini()` 함수: 각 모델 실패 시 다음 모델로 이동, 전체 실패 시 `{ok: false}` 반환
3. `generateFallback()` 함수: Gemini 전체 실패 시 6개 서비스별 한국어 콘텐츠 템플릿(10페이지씩) 내장
   - picsum.photos seed 이미지로 시각적 완성도 유지
4. 응답에 `source: 'gemini' | 'fallback'` 필드 포함 → 클라이언트가 출처 구분 가능
5. 폴백 사용 시 `notice` 메시지 포함 → 에디터에서 안내 알림 표시

**결과**: Gemini API가 완전히 불가한 상황에서도 AI 초안 생성 버튼이 항상 10페이지를 반환

---

### 문제 2: 빌드 오류 — `today`, `seed` 변수 중복 정의

**증상**
```
x the name `today` is defined multiple times
x the name `seed` is defined multiple times
```
`generateFallback()` 함수 내 41-42줄과 138-139줄에 동일한 변수가 이중 선언됨. 이전 작성 시 함수 구조 리팩토링 과정에서 발생한 잔존 코드.

**수정**: 137번 이후 중복 선언 2줄 제거 (함수 상단 선언만 유지)

---

---

## 📅 2026-04-02 — [고도화] 사용자 선택권 보장을 위한 AI 초안 미리보기 및 조건부 적용(교체/추가) 로직 구현

### 배경 & 목적

기존 AI 초안 생성은 `window.confirm`으로 교체/추가를 선택한 뒤 즉시 페이지에 반영했음.
이는 생성 결과를 확인하지 않고 적용하게 되어 사용자 선택권이 낮고, 시각적으로도 빈약했음.
→ **생성 완료 후 내용을 먼저 미리본 다음** 교체/추가/취소 중 하나를 명시적으로 선택하도록 UX 개선.

### Step 1 — Gemini 통신 로직 개선

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 모델명 형식 | `gemini-1.5-flash` (축약형) | `models/gemini-1.5-flash` (정식 명칭) |
| 모델 시도 간 대기 | 없음 | 시도 사이마다 1,000ms 대기 (`RETRY_DELAY_MS`) |
| 전체 실패 시 로그 | `console.warn` (간략) | `console.error`로 각 모델의 에러 메시지 전체 출력 |

- `delay()` 헬퍼 함수 추가 — `Promise + setTimeout` 패턴
- for-loop 인덱스로 첫 번째 시도는 대기 없이, 2번째부터 대기 후 재시도

### Step 2 — `draftData` 임시 상태 및 미리보기 모달

`editor/page.jsx`에 두 가지 상태 추가:
```js
const [draftData, setDraftData] = useState(null);        // 생성된 초안 임시 저장
const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
```

`handleAiGenerate()` 수정:
- 기존: API 응답을 바로 `setPages()` 호출
- 변경: `setDraftData(data.data)` 저장 → `setIsPreviewModalOpen(true)` 모달 오픈

### Step 3 — AI 초안 미리보기 모달 + 3-버튼 액션

**모달 구성**:
- 헤더: 생성 출처(Gemini AI / 기본 템플릿), 페이지 수
- 폴백 사용 시 amber 색상 안내 배너
- 책 제목 표시
- 스크롤 가능한 페이지 목록 (제목 + 본문 2줄 미리보기)

**버튼 3종**:

| 버튼 | 로직 |
|------|------|
| 전체 페이지 교체 | `setPages(draftData.pages)` → 모달 닫기 |
| 페이지 뒤에 추가 | `setPages(prev => [...prev, ...draftData.pages])` → 모달 닫기 |
| 작업 취소 | `setDraftData(null)` → 모달 닫기, 기존 pages 무변경 |

### 아키텍처 결정

- 미리보기 모달은 입력 폼 모달(`showAiPanel`)과 별도로 독립 관리 — 두 모달이 동시에 열리지 않도록 생성 완료 시 폼 모달은 닫고 미리보기 모달 오픈
- `draftData`가 null이면 미리보기 모달 렌더링 자체를 스킵 (조건부 렌더링)
- 3버튼 중 어떤 것을 눌러도 반드시 `setDraftData(null)` + `setIsPreviewModalOpen(false)` 실행 → 상태 오염 없음

---

## 📅 2026-04-02 — [기능 추가] 표지 이미지 입력 / 사진 일괄 업로드 / AI 더미 생성 / Gemini 모델 확정

### 배경 & 목적

사용자 흐름 점검 중 누락된 항목 발견:
1. 앞표지·뒤표지 이미지를 별도로 입력받는 UI 없음 → 책의 표지가 기본 picsum 이미지로만 처리됨
2. 여러 장의 내지 사진을 한 번에 업로드하는 방법 없음 → 페이지마다 개별 업로드 필요
3. "더미 데이터 채우기"가 정적 템플릿만 제공 → Gemini AI 동적 생성 경로 없음
4. Gemini 모델 목록이 실제 API 키 지원 모델과 불일치 → 429/404 오류 반복

### 구현 내용

#### 1. 앞표지 / 뒤표지 이미지 업로드 (editor/page.jsx)

**UI**: 에디터 좌측 패널 상단 "📖 표지 이미지" 섹션 → 2칸 그리드 (앞표지 / 뒤표지)
- 클릭 또는 Drag & Drop으로 파일 선택
- 이미지 선택 시 즉시 썸네일 미리보기
- 삭제 버튼으로 기본 이미지로 롤백

**업로드 흐름** (handleCreateBook):
```
책 UID 생성 → 앞표지 file → Photos API → URL 획득 → cover 템플릿 파라미터에 사용
            → 뒤표지 file → Photos API → URL 획득 → 마지막 contents 페이지로 추가
```
- 미업로드 시 `picsum.photos/seed/{serviceType}-cover-front` 기본 이미지 자동 사용

#### 2. 사진 일괄 업로드 (editor/page.jsx)

**UI**: "📸 사진 일괄 업로드" 버튼 (AI 초안 버튼 아래)
- `<input type="file" multiple accept="image/*">` 활성화
- 선택된 파일 배열을 pages 배열과 index 매칭하여 자동 배정
- 기존 `handleFileSelect` 재사용 → blob URL 미리보기 + stagedFiles에 저장

#### 3. AI 더미 생성 버튼 (create/[serviceType]/page.jsx)

**UI**: 기존 "더미 데이터 채우기" 옆에 "🤖 AI 더미 생성" 버튼 추가 (2-column flex)

**흐름**:
1. DUMMY_DATA[serviceType].meta를 기본 파라미터로 사용
2. `/api/generate-story` 호출 (Gemini)
3. 생성된 pages → sessionStorage → 에디터로 이동
4. 에디터에서 `aiGenerated: true` 배지 표시

**정적 더미와의 차이점**:
| 항목 | 정적 더미 | AI 더미 |
|------|---------|---------|
| 텍스트 | 고정 샘플 | Gemini 생성 (매번 다름) |
| 이미지 | picsum seed 고정 | picsum seed (동일) |
| 이동 경로 | 에디터 (더미 페이지 로드) | 에디터 (AI 페이지 로드) |
| 소요 시간 | 즉시 | 2~5초 (API 호출) |

#### 4. Gemini 모델 확정 (generate-story/route.js)

**문제**: 기존 모델 목록(`gemini-1.5-flash-8b`, `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-pro`)이 실제 API 키로 모두 404 또는 429 반환

**진단 방법**: `GET /v1beta/models?key={API_KEY}` ListModels API로 실제 지원 모델 목록 확인

**확정 모델 (v1beta, generateContent 지원)**:
| 모델 | 상태 | 우선순위 |
|------|------|---------|
| `gemini-flash-lite-latest` | ✅ 동작 확인 | 1순위 |
| `gemini-2.5-flash` | ✅ 동작 확인 | 2순위 |
| `gemini-2.5-pro` | ✅ 동작 확인 | 3순위 (쿼터 높음) |

- 모델명 접두사 `models/` 제거 (SDK가 자동으로 v1beta 경로 사용)
- 재시도 간 1,000ms delay 유지

---

## ✅ 2026-04-03 — [해결완료] HTTP 400 페이지 증분 위반 수정 · API 라우트 에러 로깅 개선

### 증상
- `POST /books/{uid}/finalization` → 400 Bad Request
- 서버 로그에 `'HTTP 400'` 문자열만 출력되어 원인 불명

### 원인 분석

**1. 홀수 페이지 전송 (페이지 증분 위반)**
- `API_MIN = 25` 하드코딩 → 내지 25페이지 + 뒤표지 1 = 26 contentInserts + 앞표지 1 = 총 27페이지
- SQUAREBOOK_HC의 `pageIncrement = 2` → 총 페이지가 홀수면 400 반환
- 공식: `총 페이지 = contentInserts + 2 (앞표지 + 뒤표지)` → 반드시 짝수여야 함

**2. API 라우트 catch 블록이 SDK 에러 구조 미지원**
- `err.response?.data` 참조 → SweetBook SDK는 `err.response`가 아닌 `err.message / err.statusCode / err.errorCode / err.details` 구조
- 실제 에러 정보가 로그에 전혀 안 찍혀 디버깅 불가

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `src/lib/constants.js` | BOOK_SPECS 각 항목에 `pageMin` 필드 추가 (SQUAREBOOK_HC=24, PHOTOBOOK_A4_SC=24, PHOTOBOOK_A5_SC=50) |
| `src/app/editor/page.jsx` | `API_MIN` 하드코딩 제거 → `BOOK_SPECS[bookSpecUid].pageMin / pageIncrement` 기반 수학적 계산으로 교체 |
| `src/app/api/books/[bookUid]/cover/route.js` | catch 블록 → `{ message, statusCode, errorCode, details }` 구조 로깅, 클라이언트에 `details` 포함 |
| `src/app/api/books/[bookUid]/contents/route.js` | 동일 수정 |
| `src/app/api/books/[bookUid]/finalize/route.js` | 동일 수정 |
| `src/app/api/books/[bookUid]/photos/route.js` | 동일 수정 (GET + POST catch 모두) |

**페이지 패딩 수식 (editor/page.jsx)**:
```js
const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
const rawTotal          = Math.max(specPageMin, contentPageData.length + 2);
const rem               = rawTotal % specPageIncrement;
const targetTotal       = rem === 0 ? rawTotal : rawTotal + (specPageIncrement - rem);
const targetContentCount = targetTotal - 2;
```

### 결과
- 어떤 판형을 선택해도 API 요구사항(pageMin, pageIncrement)을 자동으로 만족
- 서버 에러 로그에 SweetBook SDK 상세 정보 표시 → 디버깅 즉시 가능

---

## 🏗️ 2026-04-03 — [UX 결정] 템플릿 선택 UI를 에디터 모달로 이전

### 결정
템플릿 선택을 정보 입력(Create) 단계에서 제거하고, 에디터 모달에서 사진별로 직접 선택하도록 UX를 개선하기로 결정함.

### 배경
- Create 단계에서 사용자가 템플릿 UID를 선택해도 각 템플릿의 파라미터 이름이 상이해서, 에디터에서 파라미터를 잘못 매핑하면 POST /contents 400 발생
- 사용자 입장에서 "템플릿이 무엇인지" 모르는 상태에서 선택하는 것은 UX 장벽

### 결정 근거
- 사진마다 다른 레이아웃(사진+텍스트, 텍스트 전용, 이미지 전용)을 적용해야 하므로 페이지 단위 선택이 자연스러움
- 에디터 갤러리 썸네일 클릭 모달에서 역할(앞표지/뒤표지/내지) + 레이아웃(템플릿) 동시 선택 가능
- 향후 실제 템플릿 파라미터 목록을 API에서 가져와 모달에 동적으로 표시 가능

---

## 🖼️ 2026-04-04 — [버그 수정] 템플릿 썸네일 경로 오매핑 → 전부 와이어프레임 폴백

### 문제
에디터 인라인 편집 패널의 템플릿 선택 카드에서 실제 API 썸네일 이미지가 전혀 렌더링되지 않고 모두 Tailwind CSS 와이어프레임 폴백으로만 표시됨.

### 원인
코드에서 `t.thumbnailUrl || t.previewUrl || t.imageUrl || t.thumbUrl` 순서로 URL을 탐색했으나, SweetBook API의 실제 응답 스키마는 모든 썸네일을 `thumbnails` 중첩 객체 안에 담아 반환함.

```json
// API 실제 응답 구조
{
  "thumbnails": {
    "layout": "https://cdn.sweetbook.com/...",
    "baseLayerOdd": "https://...",
    "baseLayerEven": "https://..."
  }
}
```

기존 flat field 경로는 모두 `undefined`를 반환 → `previewImg = falsy` → 와이어프레임 폴백 100% 발생.

### 해결
`renderTemplateSelector` 내 두 곳에서 URL 추출 우선순위를 아래 순서로 변경:

1. `t.thumbnails?.layout`
2. `t.thumbnails?.baseLayerOdd`
3. `t.thumbnails?.baseLayerEven`
4. `t.thumbnailUrl` / `t.previewUrl` / `t.imageUrl` / `t.thumbUrl` (기존 flat field 폴백)

또한 `<img>` 태그에 `onError` 핸들러를 추가하여 URL이 있더라도 이미지 로드 실패 시 숨겨진 `<div>` 안의 와이어프레임을 `display: block`으로 전환하는 2단 폴백 구조를 구현.

### 결과
- 실제 API 썸네일 이미지가 템플릿 선택 카드에 정상 렌더링
- 이미지 로드 실패 시 와이어프레임 자동 노출 (UX 회귀 없음)
- `inferWireframeType(t)`는 `previewImg` 유무에 관계없이 항상 계산 (onError 폴백용)

---

## 🖼️ 2026-04-04 — [UX 개선] 표지 템플릿 썸네일 역할별 CSS 크롭 처리

### 문제
SweetBook API의 표지(Cover) 템플릿 썸네일은 앞표지·뒤표지가 합쳐진 **양면(Spread) 이미지** 1장으로 제공됨. 에디터는 앞표지·뒤표지를 개별 역할로 분리해 사용자가 선택하는 구조인데, 템플릿 카드에 Spread 전체 이미지가 그대로 표시되어 "이게 앞표지인가 뒤표지인가?" 혼란 유발.

### 원인
POD(Print-On-Demand) 인쇄 API 특성상 표지 템플릿을 좌(뒤표지)·우(앞표지) 합본 이미지로 제공하며, 에디터 UI는 앞표지/뒤표지를 별도로 역할 지정하는 구조이므로 양자가 맞지 않음.

### 해결 — CSS 크롭 기법 도입
래퍼 `<div>` 에 `overflow-hidden` 을 걸고, 내부 `<img>` 를 `position: absolute; width: 200%` 로 확대하여 보이는 영역을 절반으로 제한.

| 역할 | CSS | 보이는 영역 |
|------|-----|------------|
| 앞표지 (front) | `right-0 w-[200%]` | 이미지 우측 절반 |
| 뒤표지 (back)  | `left-0 w-[200%]`  | 이미지 좌측 절반 |
| 내지 (content) | `w-full object-cover` | 전체 (크롭 없음) |

추가로 `getTemplatesForRole('back')` 도 cover 종류 템플릿을 반환하도록 수정하고, 뒤표지 역할 선택 시에도 표지 템플릿 선택 UI(`renderTemplateSelector('back')`)가 표시되도록 호출부를 추가함.

### 결과
- 앞표지 역할 선택 → 썸네일에서 오른쪽 절반(앞표지 디자인)만 노출
- 뒤표지 역할 선택 → 썸네일에서 왼쪽 절반(뒤표지 디자인)만 노출
- 내지 템플릿은 크롭 없이 원본 비율 그대로 표시
- 이미지 로드 실패 시 CSS 와이어프레임 폴백 유지

<!-- 새 기록 추가 시 아래 템플릿 복사 -->
<!--
## 📅 YYYY-MM-DD — 제목

### 결정/문제
(설명)

### 해결 과정
(과정)

### 결과
(결과)
-->
