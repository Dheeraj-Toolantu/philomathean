import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Play, Quote, X } from 'lucide-react'
import { TESTIMONIALS } from './testimonialData'
import './testimonials.css'

const SPEED = 0.45 // pixels per frame for the auto-scroll

// "What Students Say": a row of video cards that scrolls by itself (pausing on hover, focus or touch).
// Clicking a card plays the video in a pop-up player.
export function Testimonials() {
  const [mountNode, setMountNode] = useState(null)
  const [playing, setPlaying] = useState(null)
  const track = useRef(null)
  const paused = useRef(false)

  // The section sits just before the "Start Your Journey Today" banner, as before.
  useEffect(() => {
    const cta = document.querySelector('.cta')
    if (!cta) return undefined
    const node = document.createElement('div')
    cta.parentNode.insertBefore(node, cta)
    const frame = window.requestAnimationFrame(() => setMountNode(node))
    return () => { window.cancelAnimationFrame(frame); node.remove() }
  }, [])

  // Auto-scroll. The list is rendered twice, so jumping back by half its width loops seamlessly.
  useEffect(() => {
    const element = track.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let frame
    let position = element.scrollLeft
    const step = () => {
      if (!paused.current && !playing) {
        const half = element.scrollWidth / 2
        position = Math.abs(element.scrollLeft - position) > 2 ? element.scrollLeft : position // the visitor scrolled by hand
        position += SPEED
        if (position >= half) position -= half
        element.scrollLeft = position
      }
      frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [mountNode, playing])

  const nudge = (direction) => {
    paused.current = true
    window.setTimeout(() => { paused.current = false }, 1200)
    const element = track.current
    const card = element?.querySelector('.ts-card')
    if (!element || !card) return
    const half = element.scrollWidth / 2
    let next = element.scrollLeft + direction * (card.offsetWidth + 20)
    if (next < 0) next += half
    if (next >= half) next -= half
    element.scrollTo({ left: next, behavior: 'smooth' })
  }
  const pause = () => { paused.current = true }
  const resume = () => { paused.current = false }

  if (!mountNode) return null
  return createPortal(<section className="testimonials ts-section" id="testimonials">
    <div className="testimonial-intro section-intro centered"><div className="pill testimonial-pill">Testimonials</div><h2><span className="testimonial-word-what">What</span> <span className="testimonial-word-students">Students</span> <span className="testimonial-word-say">Say</span></h2><p>Hear directly from the students and families who have experienced the Philomathean difference.</p></div>
    <div className="ts-stage">
      <div className="ts-heading"><span>Watch their stories</span><div className="ts-controls"><button type="button" onClick={() => nudge(-1)} aria-label="Previous stories"><ChevronLeft size={20} /></button><button type="button" onClick={() => nudge(1)} aria-label="More stories"><ChevronRight size={20} /></button></div></div>
      <div className="ts-track" ref={track} onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume} onTouchStart={pause} onTouchEnd={() => window.setTimeout(resume, 2500)}>
        {[0, 1].map((copy) => TESTIMONIALS.map((story, index) => <button type="button" className="ts-card" key={`${copy}-${index}`} onClick={() => setPlaying(story)} aria-label={`Play ${story.name}'s story`} tabIndex={copy ? -1 : 0} aria-hidden={copy ? 'true' : undefined}>
          <span className="ts-thumb"><img src={story.thumbnail} alt="" loading="lazy" /><span className="ts-play"><Play size={22} fill="currentColor" /></span><span className="ts-duration">Video</span></span>
          <span className="ts-body"><Quote size={18} aria-hidden="true" /><strong>{story.name}</strong><small>{story.detail}</small></span>
        </button>))}
      </div>
    </div>
    {playing && <VideoDialog story={playing} onClose={() => setPlaying(null)} />}
  </section>, mountNode)
}

function VideoDialog({ story, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(<div className="ts-overlay" onMouseDown={onClose}>
    <div className="ts-dialog" role="dialog" aria-modal="true" aria-label={`${story.name}'s story`} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="ts-close" onClick={onClose} aria-label="Close video"><X size={20} /></button>
      <video src={story.video} poster={story.thumbnail} controls autoPlay playsInline />
      <div className="ts-dialog-caption"><strong>{story.name}</strong><span>{story.detail}</span></div>
    </div>
  </div>, document.body)
}
