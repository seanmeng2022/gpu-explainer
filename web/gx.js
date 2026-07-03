// GX —— GPU Explainer 共享动画工具(建立在 GSAP 之上,四个页面共用)
// 页面引入顺序:
//   <script src="vendor/gsap.min.js"></script>
//   <script src="vendor/ScrollTrigger.min.js"></script>
//   <script src="vendor/MotionPathPlugin.min.js"></script>
//   <script src="gx.js"></script>
//
// API:
//   GX.controls(host, tl, {labels:true})  给 GSAP timeline 生成统一控件条 ↺ ≪ ▶/⏸ ≫ 1×
//   GX.overlay(container)                 容器内绝对定位 SVG 层(跨元素飞行画布),返回 <svg>
//   GX.center(el, refEl)                  el 中心点相对 refEl 的坐标 {x,y}
//   GX.arc(a, b, bend)                    a→b 的二次贝塞尔 path d 字符串(bend 弯曲度,可负)
//   GX.roll(el, to, {dur,decimals,prefix,suffix})  数字滚动
//   GX.flash(el, color)                   短促发光脉冲(强调"此处发生了事情")
//   GX.reduced()                          prefers-reduced-motion
//   GX.autoplayOnVisible(el, tl)          滚到视口自动播放一次(reduced-motion 时跳到终态)
(function () {
  'use strict';
  if (window.gsap) {
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);
  }
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const syncRM = () => document.documentElement.classList.toggle('gx-reduced', RM.matches);
  if (RM.addEventListener) RM.addEventListener('change', syncRM);
  syncRM();

  // ---- 控件条样式(注入一次)----
  if (!document.getElementById('gxstyle')) {
    const st = document.createElement('style');
    st.id = 'gxstyle';
    st.textContent = `
    .gx-ctl{display:flex;gap:6px;align-items:center;margin:10px 0 2px;flex-wrap:wrap}
    .gx-btn{font-family:"Space Mono",monospace;font-size:11px;line-height:1;padding:6px 11px;border-radius:6px;cursor:pointer;
      background:var(--panel,#111816);color:var(--ink,#d8e6e0);border:1px solid var(--line,#223330);
      transition:border-color .15s,color .15s,background .15s}
    .gx-btn:hover{border-color:var(--phos,#3dff9a);color:var(--phos,#3dff9a)}
    .gx-btn:focus-visible{outline:2px solid var(--phos,#3dff9a);outline-offset:1px}
    .gx-btn.gx-main{border-color:color-mix(in srgb,var(--phos,#3dff9a) 55%,transparent);color:var(--phos,#3dff9a)}
    .gx-note{font-family:"Space Mono",monospace;font-size:10px;color:var(--dim,#6f857d);margin-left:4px}
    .gx-badge{display:inline-flex;align-items:center;gap:5px;font-family:"Space Mono",monospace;font-size:9.5px;
      letter-spacing:.14em;color:var(--phos,#3dff9a);border:1px solid color-mix(in srgb,var(--phos,#3dff9a) 40%,transparent);
      border-radius:4px;padding:2.5px 7px;text-transform:uppercase;vertical-align:2px}
    .gx-badge::before{content:"▶";font-size:7.5px}
    html.gx-reduced .gx-hidewhenreduced{display:none}`;
    document.head.appendChild(st);
  }

  // ---- timeline 播放控件 ----
  function controls(host, tl, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'gx-ctl';
    const btn = (txt, title, fn, cls) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gx-btn' + (cls ? ' ' + cls : '');
      b.textContent = txt; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', fn); wrap.appendChild(b); return b;
    };
    btn('↺', '重播', () => tl.restart());
    const labelTimes = () => Object.values(tl.labels || {}).sort((a, b) => a - b);
    // 步进 seek:很多时间线用 .call() 改 DOM 状态,直接 pause(t) 不触发途中回调,
    // 画面会"没反应"。这里先无声回到 0,再带回调地推进到目标,状态得以重建
    // (要求回调幂等——GX 体系下的动画都满足)。
    const gotoLabel = ts => {
      tl.pause();
      const t = Math.max(0, Math.min(ts, tl.duration()));
      tl.time(0, true);
      tl.time(t, false);
    };
    if (opts.labels) {
      btn('≪', '上一步', () => {
        const ts = labelTimes().reverse().find(t => t < tl.time() - .05);
        gotoLabel(ts != null ? ts : 0);
      });
    }
    const bPlay = btn('▶', '播放 / 暂停', () => {
      if (tl.paused() || !tl.isActive()) {
        if (tl.progress() >= 1 && !tl.repeat()) tl.restart(); else tl.play();
      } else tl.pause();
    }, 'gx-main');
    if (opts.labels) {
      btn('≫', '下一步', () => {
        const ts = labelTimes().find(t => t > tl.time() + .05);
        gotoLabel(ts != null ? ts : tl.duration());
      });
    }
    const speeds = [.5, 1, 2]; let si = 1;
    const bSp = btn('1×', '播放速度', () => {
      si = (si + 1) % speeds.length; tl.timeScale(speeds[si]); bSp.textContent = speeds[si] + '×';
    });
    const sync = () => { bPlay.textContent = (tl.isActive() && !tl.paused()) ? '⏸' : '▶'; };
    ['onStart', 'onComplete', 'onInterrupt'].forEach(() => {});
    tl.eventCallback('onUpdate', () => { sync(); if (opts.onUpdate) opts.onUpdate(tl); });
    tl.eventCallback('onComplete', sync);
    wrap.addEventListener('click', () => requestAnimationFrame(sync));
    sync();
    host.appendChild(wrap);
    return wrap;
  }

  // ---- SVG overlay(跨元素飞行画布)----
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs, parent) {
    const el = document.createElementNS(SVGNS, name);
    for (const k in (attrs || {})) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function overlay(container) {
    let svg = container.querySelector(':scope > svg.gx-overlay');
    if (svg) return svg;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    svg = svgEl('svg', { class: 'gx-overlay' });
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:5';
    container.appendChild(svg);
    return svg;
  }
  function center(el, refEl) {
    const r = el.getBoundingClientRect(), o = refEl.getBoundingClientRect();
    return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top };
  }
  function arc(a, b, bend) {
    bend = bend == null ? .25 : bend;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    return `M ${a.x} ${a.y} Q ${mx - dy * bend} ${my + dx * bend} ${b.x} ${b.y}`;
  }

  // ---- 数字滚动 ----
  function roll(el, to, o) {
    o = o || {};
    const dec = o.decimals || 0, pre = o.prefix || '', suf = o.suffix || '';
    const from = parseFloat(String(el.textContent || '').replace(/[^\d.\-]/g, '')) || 0;
    const obj = { v: from };
    if (RM.matches) { el.textContent = pre + to.toFixed(dec) + suf; return; }
    gsap.to(obj, {
      v: to, duration: o.dur != null ? o.dur : .5, ease: 'power2.out', overwrite: true,
      onUpdate: () => { el.textContent = pre + obj.v.toFixed(dec) + suf; },
    });
  }

  // ---- 发光脉冲 ----
  function flash(el, color) {
    color = color || getComputedStyle(document.documentElement).getPropertyValue('--phos').trim() || '#3dff9a';
    gsap.fromTo(el, { boxShadow: `0 0 0 0 ${color}00` },
      { boxShadow: `0 0 18px 2px ${color}66`, duration: .18, yoyo: true, repeat: 1, clearProps: 'boxShadow' });
  }

  // ---- 滚动到视口自动播放一次 ----
  function autoplayOnVisible(el, tl) {
    tl.pause(0);
    if (RM.matches) { tl.progress(1).pause(); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(en => { if (en.isIntersecting) { tl.play(0); io.unobserve(en.target); } });
    }, { threshold: .35 });
    io.observe(el);
  }

  window.GX = { controls, overlay, svgEl, center, arc, roll, flash, autoplayOnVisible, reduced: () => RM.matches };
})();
