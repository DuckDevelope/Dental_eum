/**
 * 이음 기공소 — v4 메인 스크립트 (영상 hero + 다크/라이트 교차 섹션)
 *
 * 박사님 결정 (2026-04-26): 아모레퍼시픽 톤으로 분위기 전환.
 *  • Hero: CAD 영상 풀스크린 자동재생 + grain·vignette overlay
 *  • 후속 섹션: 다크/라이트 교차, 스크롤 진입 시 fade-up reveal
 *  • 기존 frame sequence(v3.x)는 frames-hero.js / frames-hero.css로 보존
 *
 * 가벼운 책임만:
 *  - video autoplay 보조 (브라우저 차단 시 user gesture로 재시도)
 *  - IntersectionObserver 기반 섹션 reveal (.visible 토글)
 *  - hero scroll hint 페이드 (스크롤 시작 시 사라짐)
 *  - reduced-motion 대응
 */

(function () {
  'use strict';

  /* ============================================================
     CONFIG
  ============================================================ */
  const REVEAL_THRESHOLD = 0.12;
  const REVEAL_ROOT_MARGIN = '0px 0px -8% 0px';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     VIDEO autoplay — v4.3: 박사님 통찰("v4.0 작업풍경은 자동재생 잘 됐다")
       v4.1 ensurePlay() 동시 호출 + v4.2 IntersectionObserver 둘 다
       회귀 원인. main.js는 영상에 명시 play() 호출하지 않고
       <video autoplay muted loop playsinline> 속성만으로 브라우저 기본
       동작에 맡긴다(이게 v4.0에서 동작했던 동작).
       단 자동재생 정책상 차단된 환경(드물게)을 위해 첫 user gesture
       발생 시 paused video를 silent하게 복구.
       reduced-motion 시 모든 영상 정지.
  ============================================================ */
  function initVideos() {
    const allVideos = document.querySelectorAll('video');
    if (!allVideos.length) return;

    if (reducedMotion) {
      allVideos.forEach(v => { try { v.removeAttribute('autoplay'); v.pause(); } catch {} });
      console.log('[EUM] reduced-motion: videos paused');
      return;
    }

    // 첫 paint 후 잠깐 뒤에 paused 영상이 있으면 user gesture fallback armed.
    setTimeout(() => {
      const stuck = [...document.querySelectorAll('video')].filter(v => v.paused);
      if (stuck.length === 0) {
        console.log('[EUM] all videos auto-playing');
        return;
      }
      console.log(`[EUM] ${stuck.length} video(s) paused — armed user-gesture fallback`);
      const recover = () => {
        document.querySelectorAll('video').forEach(v => {
          if (v.paused) v.play().catch(() => {});
        });
      };
      window.addEventListener('click',      recover, { once: true });
      window.addEventListener('touchstart', recover, { once: true, passive: true });
      window.addEventListener('keydown',    recover, { once: true });
      window.addEventListener('scroll',     recover, { once: true, passive: true });
    }, 800);
  }

  /* ============================================================
     SECTION REVEAL — IntersectionObserver
  ============================================================ */
  function initReveals() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN });

    targets.forEach(el => io.observe(el));
  }

  /* ============================================================
     HERO SCROLL HINT — 스크롤 시작 시 페이드아웃
  ============================================================ */
  function initScrollHint() {
    const hint = document.querySelector('.hero__scroll-hint');
    if (!hint) return;

    let hidden = false;
    const onScroll = () => {
      if (!hidden && window.scrollY > 80) {
        hint.classList.add('is-hidden');
        hidden = true;
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ============================================================
     ENTRY
  ============================================================ */
  function init() {
    initVideos();
    initReveals();
    initScrollHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
