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
     VIDEO autoplay 보조 — v4.1 회귀 정정 (박사님 피드백):
       v4.1에서 모든 video에 동시에 play()를 명시 호출 → 일부 브라우저가
       viewport 밖 video를 throttle/차단 → 회귀.
       v4.2 정책:
         (1) autoplay 속성으로 1차 시도 (브라우저 기본 동작 신뢰)
         (2) hero는 첫 paint에 보장되도록 한 번만 보조 호출
         (3) story 카드는 IntersectionObserver로 viewport 안 들어왔을 때 보조
         (4) reduced-motion 시 모두 정지
  ============================================================ */
  function userGestureRetry(video) {
    const once = () => {
      video.play().catch(() => {});
      window.removeEventListener('touchstart', once);
      window.removeEventListener('click', once);
      window.removeEventListener('keydown', once);
    };
    window.addEventListener('touchstart', once, { once: true, passive: true });
    window.addEventListener('click',      once, { once: true });
    window.addEventListener('keydown',    once, { once: true });
  }

  function tryPlayOnce(video, tag) {
    if (!video || video.dataset.eumPlayTried === '1') return;
    video.dataset.eumPlayTried = '1';
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => console.log(`[EUM] ${tag} playing`))
       .catch(err => {
         console.warn(`[EUM] ${tag} autoplay blocked:`, err.name);
         userGestureRetry(video);
       });
    }
  }

  function initHeroVideo() {
    const video = document.getElementById('heroVideo');
    if (!video) return;
    if (reducedMotion) {
      video.removeAttribute('autoplay');
      try { video.pause(); } catch {}
      return;
    }
    if (video.readyState >= 2) tryPlayOnce(video, 'hero');
    else video.addEventListener('canplay', () => tryPlayOnce(video, 'hero'), { once: true });
  }

  function initStoryVideos() {
    const videos = document.querySelectorAll('.story-card__media');
    if (!videos.length) return;
    if (reducedMotion) {
      videos.forEach(v => { v.removeAttribute('autoplay'); try { v.pause(); } catch {} });
      return;
    }
    if (!('IntersectionObserver' in window)) {
      videos.forEach(v => tryPlayOnce(v, 'story'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          tryPlayOnce(e.target, `story[${[...videos].indexOf(e.target)}]`);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });
    videos.forEach(v => io.observe(v));
  }

  function initVideos() {
    initHeroVideo();
    initStoryVideos();
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
