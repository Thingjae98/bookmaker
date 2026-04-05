# ARCHITECTURE_GUIDE.md — 템플릿 시스템 아키텍처 가이드

> SweetBook API 명세 기반 카테고리(Category) 중심 Top-Down 템플릿 아키텍처

---

## 1. API 템플릿 데이터 구조

### GET /templates 응답 필드 (SweetBook Sandbox)

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `templateUid` | string | 고유 식별자 | `79yjMH3qRPly` |
| `templateName` | string | 내부 이름 | `내지a_contain`, `표지` |
| `templateKind` | string | **핵심 분류** — `cover` / `content` / `divider` / `publish` | `cover` |
| `theme` | string\|null | **카테고리 그룹명** — API가 제공하는 공식 테마 식별자 | `일기장A`, `알림장B`, `구글포토북C` |
| `category` | null | 현재 Sandbox에서 항상 null (미사용) | — |
| `bookSpecUid` | string | 판형 UID | `SQUAREBOOK_HC` |

### GET /templates/{uid} 상세 응답 (추가 필드)

| 필드 | 타입 | 설명 |
|------|------|------|
| `parameters.definitions` | object | 파라미터 정의 — `{ [paramName]: { binding, type, required, description } }` |
| `parameters.definitions[key].binding` | string | `file` (이미지), `text` (문자열), `rowGallery` (이미지 배열), `collageGallery` (콜라주) |
| `thumbnails.layout` | string | 썸네일 이미지 URL |

---

## 2. 카테고리 기반 그룹화 아키텍처

### 2-1. 그룹화 기준: API `theme` 필드 (문자열 파싱 금지)

```
API 응답 → theme 필드로 1차 그룹 → templateKind로 2차 분류 → parameters.binding으로 3차 세분화
```

**절대 규칙**: `templateName.split('_')[0]` 같은 문자열 파싱은 사용하지 않는다. API의 `theme` 필드만 신뢰한다.

### 2-2. 카테고리 그룹 구조

```javascript
{
  '일기장A': {
    name: '일기장A',
    label: '일기장 A',
    covers:    [],   // templateKind === 'cover'
    withPhoto: [],   // templateKind === 'content' + file binding 있음
    textOnly:  [],   // templateKind === 'content' + file binding 없음 (text만)
    blank:     [],   // templateKind === 'content' + parameters 없음
    all:       [],   // 전체 (cover + content)
  },
  // ...
}
```

### 2-3. 실제 API 카테고리 분포 (SQUAREBOOK_HC, 2026-04-05 기준)

| 카테고리 (theme) | cover | content | divider | publish | 합계 |
|------------------|-------|---------|---------|---------|------|
| 일기장A | 1 | 3 | 1 | 1 | 6 |
| 일기장B | 1 | 4 | 1 | 1 | 7 |
| 알림장A | 1 | 3 | 1 | 1 | 6 |
| 알림장B | 1 | 3 | 1 | 1 | 6 |
| 알림장C | 1 | 3 | 1 | 1 | 6 |
| 구글포토북A | 1 | 3 | 1 | 1 | 6 |
| 구글포토북B | 1 | 2 | 1 | 1 | 5 |
| 구글포토북C | 1 | 3 | 1 | 1 | 6 |
| 공용 | 0 | 1 | 0 | 0 | 1 |
| (null) | 0 | 1 | 0 | 0 | 1 |

---

## 3. 서비스 → 카테고리 추천 매핑

| 서비스 | key | 추천 카테고리 |
|--------|-----|-------------|
| 육아 일기 | baby | 일기장A |
| 유치원 알림장 | kindergarten | 알림장B |
| AI 동화책 | fairytale | 일기장B |
| 여행 포토북 | travel | 구글포토북A |
| 감성 에세이 | selfpublish | 구글포토북B |
| 반려동물 앨범 | pet | 구글포토북C |

---

## 4. Parameters 기반 안전 바인딩

### 4-1. 표지 (cover) 파라미터 패턴

| 파라미터 | binding | 매핑 |
|---------|---------|------|
| `coverPhoto` | file | 앞표지 이미지 URL |
| `frontPhoto` | file | 앞표지 이미지 URL |
| `backPhoto` | file | 뒤표지 이미지 URL |
| `title` / `spineTitle` | text | 책 제목 |
| `dateRange` / `periodText` | text | 날짜 범위 |
| `subtitle` | text | 서비스 부제목 |
| `childName` | text | 아이 이름 |
| `schoolName` | text | 학교/반 이름 |
| `volumeLabel` | text | 학기 정보 |

### 4-2. 내지 (content) 파라미터 패턴

| 파라미터 | binding | 매핑 |
|---------|---------|------|
| `photo1` / `photo` | file | 페이지 이미지 URL |
| `date` / `dayLabel` / `dateLabel` | text | 날짜 |
| `title` | text | 소제목 |
| `diaryText` | text | 본문 텍스트 |
| `monthNum` / `month` | text | 월 |
| `dayNum` | text | 일 |
| `year` | text | 연도 |
| `bookTitle` | text | 책 제목 |
| `photos` | rowGallery | 이미지 URL 배열 |
| `collagePhotos` | collageGallery | 이미지 URL 배열 |

### 4-3. templateKind 검증 규칙

```
POST /books/{uid}/cover     → templateKind === 'cover' 인 템플릿만 허용
POST /books/{uid}/contents  → templateKind === 'content' 인 템플릿만 허용
```

---

## 5. 에디터 UI 구조

### Category Switcher (카테고리 스위처)

- 위치: 에디터 하단 액션 패널 (사진 미선택 시) + 인라인 편집 패널
- 카드 그리드: 각 카테고리의 대표 썸네일 + 라벨 + 템플릿 수
- 추천 배지: 서비스 타입에 맞는 카테고리에 "추천" 뱃지 표시
- 선택 효과: 선택된 카테고리에 warm 색상 테두리 + "적용" 뱃지

### 데이터 흐름

```
1. create 페이지: GET /templates?bookSpecUid=... → sessionStorage에 allTemplates 저장
2. editor 마운트: allTemplates → 각 템플릿 상세 조회 (parameters 보강)
3. buildCategoryGroups(): theme + templateKind 기반 그룹화
4. Category Switcher: 사용자 카테고리 선택
5. handleCreateBook: categoryToTplMap() → 선택 카테고리의 UID + parameters.definitions 기반 바인딩
```
