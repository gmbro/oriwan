# 새 Mac에서 개발 이어가기

Node.js 24와 Git을 준비한다. iCloud Desktop 대신 `~/Developer` 사용을 권장한다.

```sh
mkdir -p ~/Developer
cd ~/Developer
git clone https://github.com/gmbro/oriwan.git
cd oriwan
npm ci
cp .env.local.example .env.local
# 환경변수 빈 값을 채운 뒤
npm run dev:local
```

http://127.0.0.1:3000/4th/dashboard 에서 확인한다. 이전 Mac의 node_modules·.next·심볼릭 링크는 복사하지 않는다. 비밀키는 비밀번호 관리 도구나 본인 Vercel 계정에서 복원한다.

```sh
npx vercel@59.11.7 login
npx vercel@59.11.7 link --project twtt --scope gmbros-projects
npx vercel@59.11.7 env pull .env.local --environment=development
```

Development 설정이 없으면 개발용 설정을 별도로 등록한다. SITE_URL과 NEXT_PUBLIC_SITE_URL은 로컬 주소로 맞추고 Supabase 허용 Redirect URL에 `http://127.0.0.1:3000/api/auth/callback`을 확인한다. 운영 DB를 연결하면 로컬 변경도 운영 데이터에 반영된다. Mac 복원 목적으로 운영 DB 스키마를 재실행하지 않는다.

```sh
npm test
npm run typecheck
npm run build
```

라이브 업로드·OCR 검사를 포함해 후보를 배포하고 검증한 후 승격한다.

```sh
npx vercel@59.11.7 deploy --prod --skip-domain --yes --logs --build-env TWTT_VERIFY_MEMBER_UPLOAD=1
npx vercel@59.11.7 promote <검증한-후보-URL> --yes
```

`TWTT_QUOTES_MODE`는 일회성 데이터 교체용이므로 일반 배포에서 설정하지 않는다. 소스·공개 이미지·테스트·마이그레이션·기획은 Git에 보관한다. 카카오/Supabase 콘솔 설정, 비밀키, DB·Storage 데이터는 clone만으로 복원되지 않는다.
