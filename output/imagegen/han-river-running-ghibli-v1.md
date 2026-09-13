# 한강 러닝 코스 배너 — 지브리풍 v1

- 생성 방식: 내장 image_gen 도구 (CLI/API fallback 미사용).
- 선택안: 1번 한강 러닝 코스.
- 원본: `output/imagegen/han-river-running-ghibli-v1.png`.
- 웹용: `public/images/poc/hello-2027/han-river-running-ghibli-v1.webp`.
- 생성된 원본을 보존하고, 크롭/리사이즈 없이 WebP(quality 86)로 인코딩했습니다.
- 인증률 숫자와 문구는 이미지에 포함하지 않았습니다. 왼쪽의 낮은 대비 영역은 별도 반응형 UI를 위한 여백입니다.
- 이번 요청은 이미지 생성 및 로컬 저장만 수행합니다. 기존 배너 파일/화면 연결은 변경하지 않았고 배포하지 않았습니다.

## 최종 생성 프롬프트

```text
Use case: stylized-concept
Asset type: a production-ready panoramic website hero background illustration for a Korean running crew's daily participation dashboard.
Primary request: Option 1, a bright Han River running course, in Studio Ghibli-inspired hand-painted Japanese animation background style. An original scene, no existing characters.
Scene/backdrop: a peaceful morning beside Seoul's broad blue Han River, a distant softly painted bridge and hazy low skyline with a very subtle Namsan hill/tower, a gently curving riverside jogging course along the right bank, fresh soft green trees and grass.
Subject: three small everyday adult runners with full bodies visible, naturally jogging along the curved path on the right half, wearing simple muted blue, cream and soft coral running clothes. The landscape is the hero, not the people.
Style/medium: exquisite hand-painted watercolor and gouache animation background, organic brushwork, fine paper texture, softly drawn people, luminous air, warm and uplifting Ghibli atmosphere, cinematic yet calm and understated; not pixel art, not vector, not 3D.
Composition/framing: extra-wide landscape banner about 21:9 (ideally 2400x1024). A unified full-bleed landscape. Keep the left 40 percent visually quiet and low-contrast with pale sky and softly illuminated open river, naturally usable for separately rendered UI statistics. Put the curving path and runners in the right 55 percent, comfortably inside the crop-safe area. Do not make a blank rectangle, panel, card, sign or billboard for this space. Maintain a beautiful image on its own.
Lighting/mood: gentle golden morning sunlight, pale ivory clouds, clear soft blue river and sky, muted sage greens, a little warm cream, welcoming and encouraging.
Constraints: artwork only; absolutely no text, Korean or English lettering, numbers, percentages, logos, watermarks, typography, UI, frames, physical billboards or advertising signs. No embedded dashboard elements. Avoid overcrowding, hard saturation, sunset reds, overly busy foreground or large close-up characters.
```

