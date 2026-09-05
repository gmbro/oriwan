"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#f4f7fb", color: "#191f28", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 20, boxSizing: "border-box" }}>
          <section style={{ width: "100%", maxWidth: 460, padding: 28, borderRadius: 28, background: "white", boxShadow: "0 20px 60px rgba(27,45,74,.12)", textAlign: "center", boxSizing: "border-box" }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>잠시 문제가 생겼어요</h1>
            <p style={{ margin: "12px 0 0", color: "#6b7684", fontSize: 14, lineHeight: 1.65 }}>페이지를 새로 불러오면 대부분 해결됩니다.</p>
            <button type="button" onClick={reset} style={{ width: "100%", minHeight: 48, marginTop: 24, border: 0, borderRadius: 16, background: "#2563eb", color: "white", fontWeight: 800, cursor: "pointer" }}>다시 불러오기</button>
          </section>
        </main>
      </body>
    </html>
  );
}
