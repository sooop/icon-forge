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


## 명령줄(CLI): 다른 프로젝트에서 아이콘 만들기
웹앱과 같은 렌더 로직을 터미널에서 쓴다. **Node 18+ 만 있으면 되고** 설치·네트워크가 필요 없다
(래스터화는 resvg WASM, Lucide 아이콘 데이터·라이선스는 파일 안에 내장).

### 1. CLI 파일 만들기 (icon-forge 저장소에서, 한 번)
```
npm install
npm run build:cli
```
`skill/icon-forge/scripts/icon-forge.mjs`(약 3.8MB, 단일 파일)가 생긴다. 이 파일 하나가 CLI 전체다.
코드를 바꿨다면 다시 빌드한다.

### 2. 다른 프로젝트에서 실행
셋 중 편한 방법을 고른다.

- **절대 경로로 직접 실행**(설정 없음): `node D:/projects/icon-forge/skill/icon-forge/scripts/icon-forge.mjs --icon rocket --out public`
- **파일 복사**: `icon-forge.mjs` 를 대상 프로젝트의 `tools/` 등에 복사해 `node tools/icon-forge.mjs ...` 로 실행. 저장소에 커밋해 두면 팀원도 같은 명령을 쓴다.
- **셸 별칭**: `alias icon-forge='node /경로/icon-forge/skill/icon-forge/scripts/icon-forge.mjs'`

아래 예시는 `icon-forge` 를 위 방법 중 하나로 부른 것으로 적는다.

### 3. 명령
```
icon-forge search mail               # 아이콘 이름 찾기(영어 키워드, --limit N)
icon-forge --icon mail --out public  # 생성(기본 프리셋: 브라우저 확장)
icon-forge --help                    # 전체 옵션
```

| 옵션 | 설명 | 기본 |
|---|---|---|
| `--icon <이름>` | Lucide 이름(kebab/Pascal, 별칭 허용). `--config` 가 없으면 필수 | — |
| `--color` | 아이콘 선 색 `#rrggbb`(`#fff` 도 가능) | `#d7141e` |
| `--stroke` | 24px 기준 선 굵기 0.5~3.5 | 2 |
| `--no-auto-stroke` | 작은 크기 선 굵기 자동 보정 끄기 | 켜짐 |
| `--bg none\|square\|circle` | 배경 모양 | none(투명) |
| `--bg-color` | 배경색(주면 `--bg` 없이도 square) | `#ffffff` |
| `--gradient [끝색]` | 배경 그라데이션 | 꺼짐 |
| `--radius` / `--padding` | square 둥글기 % / 배경 안쪽 여백 % | 22 / 배경이 있으면 square 20·circle 24 |
| `--shadow`, `--no-soften` | 그림자, 32px 이하 약화 끄기 | 꺼짐, 약화 켜짐 |
| `--presets` | `extension,favicon,pwa,apple,custom` 쉼표 구분 또는 `all` | extension |
| `--sizes 24,64,256` | custom 프리셋 크기(1~1024). 주면 custom 자동 포함 | — |
| `--out <폴더>` | 출력 폴더(같은 이름 파일은 덮어씀) | `./icons` |
| `--svg-only` | PNG 없이 `icon.svg` 만 | — |
| `--config <파일>` | 웹앱이 내보낸 `icon-forge.json` 재사용(명령줄 옵션이 우선) | — |
| `--json` | 결과를 JSON 으로 출력(스크립트·에이전트용) | — |

### 4. 예시
```
# PWA + favicon: 파란 그라데이션 사각 배경, 흰 로켓
icon-forge --icon rocket --color "#fff" --bg square --bg-color "#2563eb" --gradient "#7c3aed" --presets pwa,favicon --out public

# 확장 프로그램 아이콘(16/32/48/128), 투명 배경
icon-forge --icon mailbox --color "#d7141e" --out extension/icons

# 웹앱에서 다듬은 설정을 그대로 재생성
icon-forge --config icon-forge.json --presets all --out public/icons
```
생성물은 웹앱 zip 과 같은 구성이다: 프리셋별 폴더(`extension/`, `favicon/`, `pwa/`, `apple/`, `custom/`)의 PNG·ico 와
붙여넣기용 조각(`manifest-icons.json`, `link-tags.html`), 그리고 `icon.svg`, `icon-forge.json`, `LICENSE-lucide.txt`(지우지 않는다).
오류 시 종료 코드 1 과 한국어 메시지를 낸다(예: 없는 아이콘 이름이면 비슷한 이름을 제안).

## Claude 스킬
`npm run pack:skill` 로 claude.ai 업로드용 `dist-cli/icon-forge-skill.zip` 을 만든다(`skill/icon-forge/SKILL.md` + CLI).
claude.ai 는 설정 > 기능에서 zip 을 올리고, Claude Code 는 `skill/icon-forge` 폴더를 `~/.claude/skills/` 에 복사한다.
