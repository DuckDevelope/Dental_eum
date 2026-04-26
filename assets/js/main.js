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
     VIDEO autoplay — v4.4: reduced-motion이어도 영상은 재생
       박사님 콘솔에서 "[EUM] reduced-motion: videos paused" 확인됨.
       박사님 OS(Windows 접근성 또는 절전 등)가 prefers-reduced-motion을
       보고하고 있었음. 영상은 박사님 사이트의 핵심 콘텐츠라 reduced-motion
       이어도 autoplay 유지. (text fade-in 등 entry animation은 CSS에서
       reduced-motion 시 제거되므로 모션 자극은 충분히 줄어듦)
       main.js는 명시 play() 호출하지 않고 autoplay 속성에만 의지.
       paused 상태 영상이 있으면 user gesture로 silent 복구.
  ============================================================ */
  function initVideos() {
    const allVideos = document.querySelectorAll('video');
    if (!allVideos.length) return;

    // 첫 paint 후 잠깐 뒤에 paused 영상이 있으면 user gesture fallback armed.
    setTimeout(() => {
      const stuck = [...document.querySelectorAll('video')].filter(v => v.paused);
      if (stuck.length === 0) {
        console.log(`[EUM] all videos auto-playing (reducedMotion=${reducedMotion})`);
        return;
      }
      console.log(`[EUM] ${stuck.length}/${allVideos.length} video(s) paused — armed user-gesture fallback (reducedMotion=${reducedMotion})`);
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
     HERO PLAYLIST — v4.6: 박사님 요청 "feedback → cad → 석고모델 순환"
       hero <video data-playlist="..."> 의 ended 이벤트로 다음 src 교체.
       cross-fade(opacity)로 자연스러운 전환. 무한 순환.
  ============================================================ */
  function initHeroPlaylist() {
    const v = document.getElementById('heroVideo');
    if (!v) return;
    let playlist = [];
    try { playlist = JSON.parse(v.dataset.playlist || '[]'); } catch {}
    if (!Array.isArray(playlist) || playlist.length < 2) return;

    // loop 속성 제거 (HTML에서 미리 제거됐지만 안전장치)
    v.removeAttribute('loop');

    let idx = 0;
    const FADE_MS = 600;

    const swapTo = (i) => {
      const clip = playlist[i];
      if (!clip || !clip.src) return;
      // fade out
      v.style.transition = `opacity ${FADE_MS}ms ease-out`;
      v.style.opacity = '0';
      setTimeout(() => {
        // src 교체. <source> 자식 대신 src 속성으로 직접 설정.
        v.poster = clip.poster || '';
        v.src = clip.src;
        v.load();
        const onCanPlay = () => {
          v.play().catch(err => console.warn('[EUM] hero playlist play blocked:', err.name));
          v.style.opacity = '1';
          v.removeEventListener('canplay', onCanPlay);
        };
        v.addEventListener('canplay', onCanPlay, { once: true });
      }, FADE_MS);
    };

    v.addEventListener('ended', () => {
      idx = (idx + 1) % playlist.length;
      console.log(`[EUM] hero playlist → ${idx} (${playlist[idx].src.split('/').pop()})`);
      swapTo(idx);
    });

    console.log(`[EUM] hero playlist armed (${playlist.length} clips)`);
  }

  /* ============================================================
     ENTRY
  ============================================================ */
  function init() {
    initVideos();
    initHeroPlaylist();
    initReveals();
    initScrollHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
