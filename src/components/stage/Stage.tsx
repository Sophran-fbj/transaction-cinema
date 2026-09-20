'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { SceneRenderer } from '@/components/scenes/SceneRenderer'
import { useScenePlayer } from '@/lib/player/useScenePlayer'
import type { Story } from '@/lib/story/types'

const SCENE_LABELS: Record<Story['scenes'][number]['type'], string> = {
  opening: 'Opening',
  transfer: 'Transfer',
  approval: 'Approval',
  swapV3: 'Swap',
  revert: 'Revert',
  gas: 'Gas',
  outro: 'Receipt',
}

// The theater: letterbox stage, subtitles, chapter timeline, controls.
// The stage keeps a 26rem height floor until `lg`: the outro's receipt ticket
// needs ~420px, which a 16:9 letterbox only provides above ~900px width.
// Below `sm` the box is additionally 4:3 (taller than wide screens); from
// `lg` up the pure widescreen ratio returns.
export function Stage({ story }: { story: Story }) {
  const durations = useMemo(() => story.scenes.map((s) => s.durationMs), [story])
  const player = useScenePlayer(durations)
  const scene = story.scenes[player.index]

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative aspect-[4/3] min-h-[27rem] w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/60 sm:aspect-video lg:min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={player.index}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SceneRenderer
              scene={scene}
              cast={story.cast}
              facts={story.facts}
              status={story.status}
              txHash={story.txHash}
              onReplay={player.restart}
            />
          </motion.div>
        </AnimatePresence>

        {/* paused overlay — hidden when the film is over so the receipt stays clean */}
        {!player.playing && !player.finished && (
          <button
            type="button"
            onClick={player.toggle}
            aria-label="Play"
            className="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <span className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* subtitles — caption first on phones; from `sm` up the caption stays
          optically centered between the scene counter and a balancing spacer */}
      <div className="mt-4 grid min-h-14 items-center gap-1.5 text-center sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <span className="order-2 text-[10px] tracking-[0.25em] text-zinc-500 uppercase sm:order-none sm:text-left">
          Scene {player.index + 1}/{story.scenes.length} · {SCENE_LABELS[scene.type]}
        </span>
        <p aria-live="polite" className="order-1 text-sm leading-snug text-zinc-300 sm:order-none">
          {scene.caption.line}
          {scene.caption.sub && (
            <span className="mt-0.5 block text-xs text-zinc-500">{scene.caption.sub}</span>
          )}
        </p>
        <span aria-hidden className="hidden sm:block" />
      </div>

      {/* chapter timeline: jump to a scene. The button is a 24px-tall hit
          target (WCAG 2.2) around a 6px bar; per-frame fill runs through a
          MotionValue so this section never re-renders for progress alone. */}
      <div className="mt-2 flex gap-1.5" role="group" aria-label="Chapter timeline">
        {story.scenes.map((s, i) => {
          const isPast = i < player.index
          const isActive = i === player.index
          return (
            <button
              key={i}
              type="button"
              onClick={() => player.jumpTo(i)}
              aria-label={`Scene ${i + 1} of ${story.scenes.length}: ${SCENE_LABELS[s.type]}`}
              aria-current={isActive ? 'true' : undefined}
              className="group flex h-6 flex-1 cursor-pointer items-center"
            >
              <span
                className={`h-1.5 w-full overflow-hidden rounded-full transition-colors ${
                  isPast ? 'bg-amber-300/80' : 'bg-white/10 group-hover:bg-white/20'
                }`}
              >
                {isActive && (
                  <motion.span
                    className="block h-full w-full origin-left rounded-full bg-amber-300/80 transition-colors group-hover:bg-amber-200"
                    style={{ scaleX: player.progress }}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* controls */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.playing ? 'Pause' : 'Play'}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition-colors hover:bg-white/10"
        >
          {player.playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={player.restart}
          aria-label="Replay"
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition-colors hover:bg-white/10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
    </div>
  )
}
