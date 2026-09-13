# 크루 티셔츠 + 인증률 최종 배너 (로컬)

생성일: 2026-09-08
생성 방식: 내장 image_gen 도구. 사진 두 장은 의상과 단체 분위기 참고용으로 사용.
첨부 JPEG 중 다중 이미지(MPO) 메타데이터가 있는 파일은 이미지 생성 도구 호환을 위해 임시 PNG로 변환한 뒤 사용했습니다. 원본 사진은 public 폴더에 복사하지 않았습니다.

## 결과물

- 원본 일러스트: `output/imagegen/han-river-crew-ghibli-v2.png`
- 웹용 배경: `public/images/poc/hello-2027/han-river-crew-ghibli-v2.webp` (1918×820, 210,040 bytes)
- 실제 인증률 UI: `app/poc/hello-2027/hello-2027-crew-banner.tsx`
- 반응형 스타일: `app/poc/hello-2027/hello-2027-crew-banner.module.css`
- 로컬 최종 미리보기: http://127.0.0.1:3000/preview/crew-banner
- 로컬 대시보드: 첫 슬라이드가 위 컴포넌트를 사용하도록 연결했습니다.
- 배포하지 않았습니다. 기존 배경 이미지와 다른 광고 슬라이드는 보존했습니다.

## 최종 구성

왼쪽에는 크루명, 오늘의 인증률, 실제 집계에서 계산한 백분율, 진행 막대, 인증 인원, 상태별 응원 문구를 표시합니다. 오른쪽은 제공된 사진의 검은 티셔츠·흰 등판 그래픽·모자를 반영한 5명의 러너와 한강 배경입니다.

백분율은 이미지에 굽지 않고 실제 대시보드의 `completedToday / participantCount`로 계산합니다. 인증 여부 집계 기준은 변경하지 않습니다.
미리보기 68%는 디자인 검수용 예시(25명 중 17명)이며 운영 데이터가 아닙니다. 미리보기 페이지는 개발 환경에서만 열립니다.

숫자·UI를 이미지 위에 별도로 렌더링하므로 화면 폭에 따라 함께 재배치됩니다. 물리 전광판 좌표에 맞추던 방식은 새 첫 배너에 사용하지 않습니다.

## 최종 이미지 생성 프롬프트

```text
Use case: compositing
Asset type: final panoramic website hero artwork, approximately 21:9, 1920x820.
Inputs: Image 1 is the base artwork/composition and style reference to retain. Image 2 is the running crew's clothing and back-of-shirt graphic reference. Image 3 is the same crew's hats, clothing, varied builds and friendly group atmosphere reference. The photos are references to adapt into painted characters, not photos to paste.
Primary request: Recreate Image 1's luminous Han River morning in a Studio Ghibli-inspired hand-painted watercolor/gouache animation style, but replace the generic three runners with a small group of five adult running friends inspired by the two photos, all wearing their authentic loose black crew T-shirts. Render the distinctive white fine-line roughly circular/spiraling organic back graphic on the shirts faithful to the photographed design, with the tiny word "Persistence" beneath it where visible. Do not replace this with a sports brand logo or generic white circle.
Characters: mostly rear or rear three-quarter views jogging casually together on the curving riverside path, with black running shorts or pale gray/soft sage shorts, white socks and running shoes, varied white, pale sky-blue, black and muted sage caps from the photographs. Natural anatomically plausible running strides, all five fully visible, not a posed lineup. One closer central runner should show the shirt's back graphic clearly. Use stylized original painted faces only, no need for exact portrait likeness.
Preserve: beautiful warm pale ivory morning light, airy blue Han River, distant bridge and soft Seoul skyline/Namsan silhouette, green foliage at right, organic brushwork, delicate paper texture, calm encouraging mood. Keep the full panoramic composition and open low-contrast left 42 percent of water and sky so actual participation statistics can be added as separate HTML UI.
Composition: the five friends fit completely within the right 48 percent, with breathing room around heads and feet, no cropped bodies. Perspective makes the two farthest slightly smaller. The river and landscape remain prominent; not a giant foreground crowd. No physical billboard or sign.
Text: only the tiny authentic "Persistence" on shirts. Do not render any titles, dashboard typography, percentages, dates or statistics anywhere. The developer will overlay live Korean certification-rate UI later, this file is the background layer of that final banner.
Avoid: photoreal collage, vector flat art, pixel art, 3D, black gloomy atmosphere, red sunset, garbled shirt graphics, watermark, unrelated logos, extra people in the empty left area.
```

