---
name: icon-forge
description: Lucide 아이콘으로 앱 아이콘 세트(브라우저 확장 16/32/48/128, favicon.ico, PWA 192/512 + maskable, Apple touch 180, 임의 크기 PNG, SVG)를 만든다. 사용자가 아이콘·파비콘·앱 아이콘·확장 프로그램 아이콘·PWA 아이콘 제작을 요청하거나, 만들고 있는 웹앱·아티팩트·확장에 쓸 아이콘이 필요할 때 사용한다. 네트워크·패키지 설치 없이 Node 만으로 실행된다.
---

# Icon Forge

Lucide(1,500+개) 아이콘에 색·배경·그라데이션을 입혀 용도별 PNG/ICO/SVG 를 만든다.
번들된 `scripts/icon-forge.mjs` 하나로 동작한다(Node 18+, 설치·네트워크 불필요).

## 절차

1. **아이콘 고르기** — 사용자의 앱 성격에서 은유가 맞는 후보를 2~3개 뽑아 이름을 확인한다.
   ```
   node scripts/icon-forge.mjs search <키워드> --limit 20
   ```
   영어 키워드로 검색한다(예: mail, rocket, chart). 없는 이름을 넣으면 오류에 비슷한 이름이 나온다.
2. **스타일 정하기** — 아래 "예쁘게 만드는 기준"을 따른다. 사용자가 색을 말하지 않았으면 앱 분위기에 맞춰 직접 정하고, 고른 값을 알려 준다.
3. **생성** — 출력 폴더는 사용자가 정한 곳, 없으면 `icons`.
   ```
   node scripts/icon-forge.mjs --icon rocket --color "#ffffff" --bg square --bg-color "#2563eb" --gradient "#7c3aed" --presets pwa,favicon --out ./icons
   ```
4. **확인** — 생성된 큰 PNG(`pwa/icon-512.png` 등)를 이미지로 열어 모양을 본다. 선이 겹치거나 대비가 약하면 색·`--padding`·`--stroke` 를 조정해 다시 만든다.
5. 결과 파일 경로와 붙여넣기 조각(`manifest-icons.json`, `link-tags.html`)을 사용자에게 안내한다.

## 주요 옵션

| 옵션 | 설명 |
|---|---|
| `--icon <이름>` | Lucide 이름(kebab/Pascal, 별칭 허용) |
| `--color` | 아이콘 선 색 `#rrggbb` |
| `--bg none\|square\|circle` | 배경 모양. 기본 투명 |
| `--bg-color`, `--gradient [끝색]` | 배경색, 그라데이션 |
| `--radius`, `--padding`, `--stroke`, `--shadow` | 둥글기(%), 여백(%), 선 굵기, 그림자 |
| `--presets` | `extension,favicon,pwa,apple,custom` 또는 `all`. 기본 extension |
| `--sizes 24,64,256` | 임의 크기 PNG(1~1024) |
| `--svg-only` | `icon.svg` 만 생성 |
| `--config icon-forge.json` | 웹앱(Icon Forge)에서 내보낸 설정 재사용 |
| `--json` | 결과를 JSON 으로 출력 |

전체 도움말: `node scripts/icon-forge.mjs --help`

## 예쁘게 만드는 기준

- **대비**: 배경이 진하면 아이콘은 흰색, 배경이 밝으면 아이콘은 진한 색. 한 아이콘에 색은 2개(아이콘+배경)까지.
- **그라데이션**: 같은 계열에서 색상 20~40° 정도 이동한 두 색(예: `#2563eb`→`#7c3aed`)이 자연스럽다. 정반대 색은 피한다.
- **배경 모양**: 앱 아이콘·PWA는 `square`(radius 22 기본), 프로필·뱃지 느낌은 `circle`. 파비콘만 필요하면 투명 배경 + 진한 색 아이콘이 탭에서 가장 잘 읽힌다.
- **여백**: 배경이 있으면 도구가 자동으로 20%(square)/24%(circle) 여백을 둔다. 복잡한 아이콘은 `--padding` 을 줄이지 말고 `--stroke 1.75` 로 가늘게 한다.
- **작은 크기**: 16px 에서 읽히는지가 기준이다. 디테일이 많은 아이콘은 피하고, 도구가 16~32px 에서 선 굵기를 자동 보정한다(`--no-auto-stroke` 로 끔).
- Apple touch·maskable 은 도구가 규칙(불투명 배경, 안전 영역 60%)을 자동 적용한다. 따로 손대지 않는다.

## 주의

- 출력 폴더에 같은 이름의 파일이 있으면 덮어쓴다. 사용자의 기존 아이콘이 있는 폴더라면 먼저 알린다.
- Lucide 라이선스(ISC)에 따라 `LICENSE-lucide.txt` 가 함께 생성된다. 지우지 않는다.
