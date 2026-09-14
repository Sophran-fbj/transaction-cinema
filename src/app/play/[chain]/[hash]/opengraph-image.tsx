import { ImageResponse } from 'next/og'

// Dynamic OG card for share links. Deliberately static-styled: no RPC calls
// in the image generator — just the cinema chrome and the tx hash.
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ chain: string; hash: string }>
}) {
  const { hash } = await params

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ fontSize: 18, letterSpacing: 12, color: '#fcd34d', textTransform: 'uppercase' }}>
          transaction cinema
        </div>
        <div style={{ marginTop: 28, fontSize: 32 }}>{hash}</div>
        <div style={{ marginTop: 28, fontSize: 20, color: '#71717a' }}>
          a short animated story, decoded from raw RPC data
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
