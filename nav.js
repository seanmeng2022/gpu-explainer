// 共享左侧菜单栏 —— 两个页面都 <script src=".../nav.js"> 引入。
// 加新页面：只需在下面 PAGES 数组里加一行，并在新页面引入本脚本。
//
// 用法（在各页面 <body> 末尾）：
//   根页面 :  <script src="nav.js"      data-base="."  data-active="principle"></script>
//   web 页面: <script src="../nav.js"   data-base=".." data-active="realtrace"></script>
(function () {
  // ---- 页面注册表（新增页面只改这里）----
  const PAGES = [
    { id: 'principle', icon: '◈', label: '原理动画',   desc: 'CPU·PCIe·GPU·NVLink', href: 'index.html' },
    { id: 'realtrace', icon: '◉', label: '真实数据流', desc: 'DeepSeek MoE · 实测 trace', href: 'web/index.html', live: true },
    // 例：{ id:'kvcache', icon:'▣', label:'KV Cache', desc:'Decode 显存增长', href:'web/kvcache.html' },
  ];
  const REPO = 'https://github.com/seanmeng2022/gpu-explainer';

  const me = document.currentScript;
  const base = (me && me.getAttribute('data-base')) || '.';
  const active = (me && me.getAttribute('data-active')) || '';
  const href = p => (base === '.' ? p : base + '/' + p);

  // ---- 样式（带 id，避免重复注入）----
  if (!document.getElementById('navstyle')) {
    const css = `
    :root{ --navw:236px; }
    body{ padding-left:var(--navw); transition:padding-left .2s; }
    #sidenav{position:fixed;top:0;left:0;bottom:0;width:var(--navw);z-index:500;
      background:linear-gradient(180deg,#0d1413,#0a0e0d);border-right:1px solid var(--line,#223330);
      display:flex;flex-direction:column;padding:22px 16px 16px;overflow-y:auto;}
    #sidenav .brand{display:flex;align-items:center;gap:10px;margin:0 6px 22px;text-decoration:none}
    #sidenav .brand .bdot{width:9px;height:9px;border-radius:50%;background:var(--phos,#3dff9a);box-shadow:0 0 12px var(--phos,#3dff9a);flex-shrink:0;animation:navpulse 1.6s infinite}
    @keyframes navpulse{0%,100%{opacity:1}50%{opacity:.3}}
    #sidenav .brand .bt{font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.22em;color:var(--phos,#3dff9a);text-transform:uppercase;line-height:1.3}
    #sidenav .navlabel{font-family:"Space Mono",monospace;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim,#6f857d);margin:4px 8px 9px}
    #sidenav .navlist{display:flex;flex-direction:column;gap:6px;flex:1}
    #sidenav a.item{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;border-radius:9px;text-decoration:none;
      border:1px solid transparent;transition:.15s;position:relative}
    #sidenav a.item:hover{background:var(--panel,#111816);border-color:var(--line,#223330)}
    #sidenav a.item .ic{font-size:15px;line-height:1.1;color:var(--dim,#6f857d);margin-top:1px;transition:.15s}
    #sidenav a.item .tx{min-width:0}
    #sidenav a.item .nm{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:13.5px;color:var(--ink,#d8e6e0);line-height:1.2}
    #sidenav a.item .ds{font-family:"Space Mono",monospace;font-size:10px;color:var(--dim,#6f857d);margin-top:2px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #sidenav a.item .liv{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--amber,#ffb13d);box-shadow:0 0 7px var(--amber,#ffb13d);margin-left:6px;vertical-align:middle}
    #sidenav a.item.on{background:color-mix(in srgb,var(--phos,#3dff9a) 12%,var(--panel,#111816));border-color:var(--phos,#3dff9a)}
    #sidenav a.item.on::before{content:"";position:absolute;left:-16px;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--phos,#3dff9a);box-shadow:0 0 10px var(--phos,#3dff9a)}
    #sidenav a.item.on .ic{color:var(--phos,#3dff9a)}
    #sidenav a.item.on .nm{color:var(--phos,#3dff9a)}
    #sidenav .navfoot{margin-top:14px;padding-top:14px;border-top:1px solid var(--line,#223330);font-family:"Space Mono",monospace;font-size:10px;color:var(--dim,#6f857d);line-height:1.6}
    #sidenav .navfoot a{color:var(--cyan,#39d0ff);text-decoration:none}
    #sidenav .navfoot a:hover{text-decoration:underline}
    /* 移动端：变成顶部横条 */
    #navtoggle{display:none}
    @media(max-width:980px){
      :root{--navw:0px}
      body{padding-left:0;padding-top:54px}
      #sidenav{flex-direction:row;align-items:center;bottom:auto;right:0;width:auto;height:54px;padding:0 14px;
        border-right:none;border-bottom:1px solid var(--line,#223330);overflow:visible;gap:14px}
      #sidenav .brand{margin:0;flex-shrink:0}
      #sidenav .navlabel,#sidenav .navfoot{display:none}
      #sidenav .navlist{flex-direction:row;gap:6px;flex:0;overflow-x:auto}
      #sidenav a.item{padding:7px 11px;align-items:center}
      #sidenav a.item .ds{display:none}
      #sidenav a.item.on::before{display:none}
    }`;
    const st = document.createElement('style');
    st.id = 'navstyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- DOM ----
  const items = PAGES.map(p => {
    const on = p.id === active ? ' on' : '';
    const live = p.live ? '<span class="liv" title="实测数据"></span>' : '';
    return `<a class="item${on}" href="${href(p.href)}">
      <span class="ic">${p.icon}</span>
      <span class="tx"><span class="nm">${p.label}${live}</span><span class="ds">${p.desc}</span></span>
    </a>`;
  }).join('');

  const nav = document.createElement('nav');
  nav.id = 'sidenav';
  nav.innerHTML = `
    <a class="brand" href="${href('index.html')}">
      <span class="bdot"></span>
      <span class="bt">GPU<br>EXPLAINER</span>
    </a>
    <div class="navlabel">可视化页面</div>
    <div class="navlist">${items}</div>
    <div class="navfoot">
      数据源 · SGLang torch.profiler<br>
      <a href="${REPO}" target="_blank" rel="noopener">↗ GitHub 源码</a>
    </div>`;
  document.body.insertBefore(nav, document.body.firstChild);
})();
