"use client";

/**
 * Root-level fallback. Must define its own <html>/<body> because the root
 * layout itself failed. Shows the error message for diagnosis.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            maxWidth: 560,
            margin: "80px auto",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 24, color: "#0f172a" }}>
            VietJourney gặp lỗi khi tải trang
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            {error.message || "Unknown error"}
            {error.digest ? ` · digest ${error.digest}` : ""}
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Hãy chụp lại thông báo này và gửi cho đội phát triển.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              background: "#1d4ed8",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "10px 20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
