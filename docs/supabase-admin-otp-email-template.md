# 스내사 4기 관리자 OTP 메일 템플릿

`/admin`의 인증번호 메일은 애플리케이션이 아니라 Supabase Auth의 **Magic Link / OTP** 템플릿에서 발송한다. 운영 프로젝트의 Supabase Dashboard에서 `Authentication → Email Templates → Magic Link`를 열고 아래 제목과 본문을 저장한다.

## 제목

```text
스내사 4기 관리자 인증번호
```

## HTML 본문

```html
<!doctype html>
<html lang="ko">
  <body style="margin:0;background:#f4f6f8;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#191f28;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;padding:36px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 24px;font-size:24px;font-weight:800;line-height:1.4;">스내사 4기 관리자 인증번호</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#4e5968;">관리자 페이지에 로그인하려면 아래 인증번호를 입력해주세요.</p>
                <p style="margin:0 0 24px;padding:18px 20px;border-radius:16px;background:#e8f3ff;font-size:32px;font-weight:800;letter-spacing:0.18em;text-align:center;color:#1b64da;">{{ .Token }}</p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#8b95a1;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 적용·검증 체크

1. `{{ .ConfirmationURL }}` 대신 `{{ .Token }}`이 본문에 남아 있는지 확인한다. 이 값이 있어야 숫자 OTP가 발송된다.
2. 제목과 본문을 저장한 뒤 `/admin`에서 한 번만 인증번호를 요청해 제목·한글·숫자 코드가 정상적으로 보이는지 확인한다.
3. 운영 프로젝트에 custom SMTP를 사용한다면 발신자명과 스팸 정책도 함께 확인한다.
4. Supabase의 Magic Link / OTP 템플릿은 프로젝트 전체에 적용된다. 현재 저장소에서 이메일 `signInWithOtp`를 호출하는 곳은 관리자 세션 API 한 곳뿐이며 Kakao 소셜 로그인 메일에는 영향을 주지 않는다.

호스팅형 Supabase는 로컬 파일을 자동으로 읽지 않는다. 이 문서는 운영 입력값의 기준본이며, 실제 반영은 Dashboard에서 저장하거나 Supabase Management API의 `mailer_subjects_magic_link`와 `mailer_templates_magic_link_content`를 갱신해야 한다. Management API를 사용할 때 access token은 저장소·채팅·로그에 남기지 않는다.
