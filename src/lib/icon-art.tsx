/** Sat+ app icon artwork for ImageResponse (green tile with a white plus). */
export function IconArt({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const pad = maskable ? size * 0.18 : 0;
  const inner = size - pad * 2;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#16a35a" : "transparent" }}>
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: maskable ? 0 : inner * 0.24,
          background: "linear-gradient(135deg, #22b866, #128a4b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={inner * 0.56} height={inner * 0.56} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round">
          <path d="M12 4.5v15M4.5 12h15" />
        </svg>
      </div>
    </div>
  );
}
