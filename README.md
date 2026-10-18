# Icon Forge

Lucide 아이콘으로 브라우저 확장·Favicon·PWA·Apple touch 아이콘을 만들어 zip 으로 내려받는 도구.
모든 렌더링(SVG → canvas → PNG)과 zip 생성은 브라우저 안에서 이루어진다.

- `npm run dev` — 개발 서버
- `npm run build` — 타입 검사 + `dist/index.html` 단일 파일 생성(오프라인에서 더블클릭으로 실행)
- `npm test` — 로직 테스트(선 굵기 보정, SVG, ico, 프리셋·zip, 설정 저장)

## 출력 프리셋
확장(16/32/48/128), Favicon(.ico + 16/32), PWA(192/512 + maskable), Apple touch(180), 직접 지정 크기.
zip 에는 설정 `icon-forge.json`(불러오기 가능)과 Lucide 라이선스가 함께 들어간다.

## 렌더 규칙
- 선 굵기 자동 보정: 렌더링 선이 1.67px 아래로 가늘어지지 않도록 올린다(16px → 2.5, 상한 3.5).
- 32px 이하: 그림자 끄기, 그라데이션 약화(옵션).
- maskable: 아이콘을 안전 영역(60%) 안으로 줄이고 꽉 찬 배경. apple: 투명이면 흰 배경 강제.
