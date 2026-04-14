/**
 * main.ts — OpenClaw HQ ESC-HQ Style
 *
 * No Three.js. Pure DOM + CSS.
 * Characters: SVG mascots in index.html, animated via CSS classes.
 * Interactions: bubble show/hide, class toggle for status.
 */
import './style.css';

const GW_BASE = (import.meta.env['VITE_GATEWAY_URL'] as string | undefined) ?? 'http://localhost:3100';
const GW_WS   = GW_BASE.replace(/^http/, 'ws') + '/ws';
const VRAM_MB = 16376;

/* ── Agent config ─────────────────────────────── */
interface AgentCfg {
  id: string;
  heroName: string;
  role: string;
  lore: string;
  model: string;
  accentColor: string;
  superPowers: string[];
  capabilities: string[];
}

const AGENTS: AgentCfg[] = [
  { id:'accountant', heroName:'Owl 🦉', role:'會計總管',
    lore:'戴著金絲眼鏡的毛絨雪鴞，手裡拿著小算盤。象徵睿智與帳目精確。',
    model:'Claude Opus', accentColor:'#EAB308',
    superPowers:['精確無誤','財務透視','稅法大典'],
    capabilities:['ledger_write','tax_calculation'] },
  { id:'finance', heroName:'Lion 🦁', role:'財務總管',
    lore:'留著柔順鬃毛的毛絨雄獅，穿著條紋西裝背心。象徵資金實力與威嚴。',
    model:'Gemini Pro', accentColor:'#F59E0B',
    superPowers:['資金調度','風險投資','霸主氣場'],
    capabilities:['loan_approval','investment_strategy'] },
  { id:'guardian', heroName:'Bear 🐻', role:'法務/保險',
    lore:'體型寬大的毛絨棕熊，帶著保險盾牌徽章。象徵堅如磐石的防護。',
    model:'Claude Sonnet', accentColor:'#8B5CF6',
    superPowers:['堅毅護盾','風險隔離','安穩如山'],
    capabilities:['insurance_plan','risk_assessment'] },
  { id:'lex', heroName:'Fox 🦊', role:'合約專家',
    lore:'精明俐落的毛絨赤狐，拿著放大鏡與羽毛筆。象徵合約細節的敏銳度。',
    model:'Claude Sonnet', accentColor:'#38BDF8',
    superPowers:['條文透視','滴水不漏','狡黠談判'],
    capabilities:['contract_review','legal_advice'] },
  { id:'scout', heroName:'Shiba 🐕', role:'無人機/外勤',
    lore:'戴著飛行風鏡與小背包的毛絨柴犬。象徵忠誠、高活動力。',
    model:'Gemini Flash', accentColor:'#F97316',
    superPowers:['萬里神查','飛行特技','不知疲倦'],
    capabilities:['uav_flight','site_inspection'] },
  { id:'zora', heroName:'Sheep 🐑', role:'NGO/志工',
    lore:'毛茸茸且雪白的綿羊，脖子上掛著愛心名牌。象徵溫柔與社福照顧。',
    model:'Claude Sonnet', accentColor:'#10B981',
    superPowers:['治癒之光','心靈傾聽','無私奉獻'],
    capabilities:['volunteer_management','donation_receipt'] },
  { id:'titan', heroName:'Elephant 🐘', role:'建築/BIM',
    lore:'穩重厚實的毛絨大象，帶著建築藍圖。象徵大型工程的基礎與穩固。',
    model:'Claude Sonnet', accentColor:'#64748B',
    superPowers:['重型結構','三維透視','穩如泰山'],
    capabilities:['bim_structure','clash_detection'] },
  { id:'lumi', heroName:'Cat 🐈', role:'室內設計',
    lore:'純白優雅的毛絨波斯貓，佩戴著調色盤。象徵極致的美學與品味。',
    model:'Claude Sonnet', accentColor:'#EC4899',
    superPowers:['光影魔術','色彩美學','高級品味'],
    capabilities:['interior_design','spatial_planning'] },
  { id:'rusty', heroName:'Raccoon 🦝', role:'估算/工務',
    lore:'古靈精怪的毛絨浣熊，帶著計算機。象徵精打細算與物料掌控。',
    model:'Claude Sonnet', accentColor:'#84CC16',
    superPowers:['精密算盤','資源回收','材料精通'],
    capabilities:['quantity_surveying','cost_calc'] }
];

/* ── Interaction scripts ───────────────────── */
const SCRIPTS = [
  { from:'lex',        to:'titan',        a:'Fox 🦊: 大象，這份 BIM 藍圖的建照進度合約卡住了。',  b:'Elephant 🐘: 沒問題，我來標記法定空地基準點給你。' },
  { from:'rusty',      to:'finance',      a:'Raccoon 🦝: 獅子！鋼筋盤價明起調漲，建議提早鎖定預算。', b:'Lion 🦁: 收到，資金已為你調度完畢。' },
  { from:'zora',       to:'scout',        a:'Sheep 🐑: 柴犬！偏鄉物資需要無人機空投確認地形！',     b:'Shiba 🐕: 汪！無人機滿電，馬上出發！' },
  { from:'lumi',       to:'titan',        a:'Cat 🐈: 喵，這個空調管線會破壞我的天花板美學。',      b:'Elephant 🐘: 我來挪動風管，留出 15 公分的空間。' },
  { from:'guardian',   to:'accountant',   a:'Bear 🐻: 員工團險需續約，請撥款。',                 b:'Owl 🦉: 帳戶無誤。安全第一，准予放行。' },
];

/* ── State ────────────────────────────────── */
type Status = 'idle'|'working'|'thinking'|'talking'|'offline';
const statMap  = new Map<string,{ status:Status; taskCount:number }>();
const chatMap  = new Map<string,{who:string;text:string;t:string}[]>();
let selectedId: string|null = null;
let totalEvt   = 0;
let isInteract = false;

for (const a of AGENTS) {
  statMap.set(a.id, { status:'idle', taskCount:0 });
  chatMap.set(a.id, []);
}

/* ── UI helpers ───────────────────────────── */
const $ = (id:string) => document.getElementById(id)!;
const $$ = (sel:string) => document.querySelector(sel) as HTMLElement|null;

function slog(msg:string, lv:'ok'|'warn'|'err'|'info'='info'): void {
  const t = new Date().toLocaleTimeString('zh-TW',{hour12:false});
  const el = document.createElement('div');
  el.className = `sl ${lv}`;
  el.innerHTML = `<span class="sl-t">[${t}]</span><span class="sl-m">${msg}</span>`;
  $('slstream').appendChild(el);
  $('slstream').scrollTop = 9999;
  while ($('slstream').children.length > 150) $('slstream').removeChild($('slstream').children[0]!);
}

function toast(msg:string, type='info'): void {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function setWs(s:'conn'|'link'|string): void {
  const chip = $('ws-chip');
  chip.className = `chip ${s}`;
  $('ws-lbl').textContent = s==='conn'?'ONLINE':s==='link'?'LINKING...':'OFFLINE';
}

function setRunner(s:'online'|'offline'): void {
  $('runner-lbl').textContent = s==='online'?'LOCAL ONLINE':'LOCAL OFFLINE';
}

/* ── Status management ─────────────────────── */
function setStatus(id:string, status:Status, bubble?:string): void {
  const st = statMap.get(id);
  if (!st) return;
  st.status = status;
  if (bubble) st.taskCount++;

  // Update CSS class on pin element
  const pin = document.querySelector(`.agent-pin[data-id="${id}"]`) as HTMLElement|null;
  if (pin) {
    pin.className = `agent-pin ${status !== 'idle' ? status : ''}`.trim();
    pin.dataset['id'] = id;
  }

  // Update status dot in namecard
  const dot = $(`st-${id}`) as HTMLElement|null;
  if (dot) {
    dot.className = `ap-status ${status !== 'idle' ? status : ''}`.trim();
  }

  // Show/hide bubble
  const bub = $(`bub-${id}`) as HTMLElement|null;
  if (bub) {
    if (bubble) {
      bub.textContent = bubble;
      bub.classList.add('vis');
      setTimeout(() => bub.classList.remove('vis'), 5000);
    } else {
      bub.classList.remove('vis');
    }
  }

  // Refresh panel if open
  if (selectedId === id) refreshPanel();
}

/* ── Agent detail panel ────────────────────── */
function openPanel(id:string): void {
  const cfg = AGENTS.find(a => a.id === id);
  if (!cfg) return;
  selectedId = id;

  // Set character image in detail panel
  const imgEl = $('apd-img') as HTMLImageElement|null;
  if (imgEl) {
    imgEl.src = `/src/assets/char-${id}.png`;
    imgEl.alt = cfg.heroName;
  }

  $('apd-name').textContent  = cfg.heroName;
  $('apd-role').textContent  = cfg.role;
  $('apd-lore').textContent  = cfg.lore;
  $('apd-model').textContent = cfg.model;

  const st = statMap.get(id)!;
  const dot = $('apd-dot') as HTMLElement;
  dot.className = `apd-dot ${st.status !== 'idle' ? st.status : ''}`.trim();
  $('apd-stat').textContent  = st.status.toUpperCase();
  $('apd-tasks').textContent = String(st.taskCount);

  $('apd-caps').innerHTML = [
    ...cfg.superPowers.map(p => `<span class="ctag" style="border-color:color-mix(in srgb,${cfg.accentColor} 40%,transparent);color:${cfg.accentColor}">${p}</span>`),
    ...cfg.capabilities.map(c => `<span class="ctag">${c}</span>`),
  ].join('');

  refreshPanel();
  $('agent-panel').classList.remove('hidden');
}

function closePanel(): void {
  $('agent-panel').classList.add('hidden');
  selectedId = null;
}

function refreshPanel(): void {
  if (!selectedId) return;
  const msgs = chatMap.get(selectedId) ?? [];
  $('apd-chat').innerHTML = msgs.slice(-10).map(m => `
    <div class="cmsg">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span class="cmsg-who">${m.who}</span>
        <span class="cmsg-t">${m.t}</span>
      </div>${m.text}
    </div>`).join('') || '<div style="padding:4px 0;font-size:11px;color:var(--lo)">No comms yet</div>';
  $('apd-chat').scrollTop = 9999;
}

function addChat(id:string, who:string, text:string): void {
  const t = new Date().toLocaleTimeString('zh-TW',{hour12:false});
  chatMap.get(id)?.push({ who, text, t });
  if (selectedId === id) refreshPanel();
}

/* ── Chat feed panel ───────────────────────── */
function pushChatFeed(who:string, tag:string, text:string): void {
  const el = document.createElement('div');
  el.className = 'cf-msg';
  el.innerHTML = `<div><span class="cf-who">${who}</span><span class="cf-tag">[${tag}]</span></div><div class="cf-text">"${text}"</div>`;
  const feed = $('chat-feed');
  feed.appendChild(el);
  feed.scrollTop = 9999;
  while (feed.children.length > 20) feed.removeChild(feed.children[0]!);
}

/* ── Interaction trigger ───────────────────── */
async function triggerInteract(idx?:number): Promise<void> {
  if (isInteract) return;
  isInteract = true;
  const scr = idx !== undefined ? SCRIPTS[idx % SCRIPTS.length]! : SCRIPTS[Math.floor(Math.random()*SCRIPTS.length)]!;
  const fa = AGENTS.find(a=>a.id===scr.from)!;
  const ta = AGENTS.find(a=>a.id===scr.to)!;

  setStatus(scr.from, 'talking', scr.a);
  setStatus(scr.to,   'talking', scr.b);
  addChat(scr.from, fa.heroName, scr.a);
  addChat(scr.to,   ta.heroName, scr.b);

  pushChatFeed(fa.heroName, 'TALKING', scr.a);
  pushChatFeed(ta.heroName, 'REPLY',   scr.b);

  slog(`⚡ ${fa.heroName} ↔ ${ta.heroName}`, 'ok');
  toast(`⚡ ${fa.heroName} 聯絡 ${ta.heroName}！`);

  await new Promise(r => setTimeout(r, 5500));
  setStatus(scr.from, 'idle');
  setStatus(scr.to,   'idle');
  isInteract = false;
}

/* ── VRAM ─────────────────────────────────── */
async function fetchVram(): Promise<void> {
  try {
    const r = await fetch(`${GW_BASE}/vram/status`);
    const d = await r.json() as { ok:boolean; total_vram_mb:number };
    $('vram-lbl').textContent = d.ok ? `${d.total_vram_mb}/${VRAM_MB} MB` : '— MB';
  } catch { /* ignore */ }
}

async function freeVram(): Promise<void> {
  try {
    const d = await (await fetch(`${GW_BASE}/vram/free`,{method:'POST'})).json() as {message:string};
    slog(d.message,'ok'); toast(d.message); void fetchVram();
  } catch(e) { slog(String(e),'err'); }
}

/* ── Gateway WS ───────────────────────────── */
class WSClient {
  private ws: WebSocket|null = null;
  private timer: ReturnType<typeof setTimeout>|null = null;

  connect(): void {
    setWs('link');
    try { this.ws = new WebSocket(GW_WS); }
    catch(e) { slog(String(e),'err'); this.retry(); return; }

    this.ws.onopen = () => {
      setWs('conn'); slog('✓ Gateway connected','ok');
      if(this.timer){clearTimeout(this.timer);this.timer=null;}
      void fetchVram();
    };
    this.ws.onmessage = (e:MessageEvent) => {
      try {
        const m = JSON.parse(e.data as string);
        if (m.type === 'openclaw_event' && m.event) {
          totalEvt++;
          $('evcount').textContent = `${totalEvt} events`;
          const ev = m.event;

          if (ev.type === 'AGENT_STATE_UPDATE' && ev.target_agent) {
             // Convert python node name like risk_manager to HTML id risk-manager
             const agId = ev.target_agent.replace('_', '-');
             const payload = ev.payload || {};
             
             // Extract the newest thought content
             const msgs = payload.messages || [];
             let latestMsg = "";
             if (msgs.length > 0) {
                 const lastm = msgs[msgs.length - 1];
                 latestMsg = lastm.content || "";
             }
             
             // Map backend 'current_step' logic to visual 'status'
             let visualStatus: Status = "working";
             if (payload.current_step === "complete") visualStatus = "idle";
             else if (msgs.length > 0) visualStatus = "talking";

             setStatus(agId, visualStatus, latestMsg || undefined);
             
             // Add chat specifically to the side panel if valid
             if (latestMsg) {
                 const ag = AGENTS.find(a => a.id === agId);
                 const heroName = ag ? ag.heroName : agId;
                 addChat(agId, heroName, latestMsg);
                 pushChatFeed(heroName, "THINKING", latestMsg);
             }
             
             slog(`[Brain] ${agId}: ${payload.current_step}`, 'info');

          } else if (ev.type === 'TASK_QUEUED') {
             slog(`[Gateway] ${ev.payload?.task_type || 'Task'} Queued`, 'warn');
             toast(`New Task Queued!`, 'warning');
          } else if (ev.type === 'TASK_COMPLETED' || ev.type === 'NEWS_INGESTED') {
             slog(`[Gateway] Task Completed`, 'ok');
             toast(`Task Finished Successfully`, 'info');
             // Turn off all agents
             AGENTS.forEach(a => setStatus(a.id, 'idle'));
          } else if (ev.target_agent) {
             // Fallback default
             setStatus(ev.target_agent, 'working', '⚙️ Processing...');
          }
        }
      } catch (err) {
        slog(String(err), 'err');
      }
    };
    this.ws.onclose = (e:CloseEvent) => { setWs(''); slog(`WS closed (${e.code})`,'warn'); this.retry(); };
    this.ws.onerror = () => slog('WS error','err');
  }

  private retry(): void {
    if (!this.timer) this.timer = setTimeout(() => { this.timer=null; this.connect(); }, 3000);
  }
}

/* ── Main ─────────────────────────────────── */
function main(): void {
  const setLoad = (p:number, t:string) => {
    ($('lb') as HTMLElement).style.width = `${p}%`;
    ($('lt') as HTMLElement).textContent = t;
  };

  setLoad(20, 'Building ESC HQ interface...');

  // M4: 從 data-* 屬性初始化 CSS custom properties（移除 HTML inline style）
  // HTML 只需要 data-px, data-py, data-ac；此處統一套用至 CSS var(--px), var(--py), var(--ac)
  document.querySelectorAll<HTMLElement>('.agent-pin').forEach(pin => {
    const px = pin.dataset['px'];
    const py = pin.dataset['py'];
    const ac = pin.dataset['ac'];
    if (px) pin.style.setProperty('--px', px.includes('%') ? px : `${px}%`);
    if (py) pin.style.setProperty('--py', py.includes('%') ? py : `${py}%`);
    if (ac) pin.style.setProperty('--ac', ac);
  });


  document.querySelectorAll<HTMLElement>('.agent-pin').forEach(pin => {
    const id = pin.dataset['id'];
    if (!id) return;
    pin.addEventListener('click', () => {
      if (selectedId === id) closePanel();
      else openPanel(id);
    });
  });

  setLoad(60, 'Connecting to Gateway...');

  /* Buttons */
  $('btn-assemble').addEventListener('click', () => { void triggerInteract(); });
  $('btn-vram').addEventListener('click',     () => { void freeVram(); });
  $('ap-close').addEventListener('click',     closePanel);

  /* Chat panel minimise */
  let chatMin = false;
  $('cp-min').addEventListener('click', () => {
    chatMin = !chatMin;
    $('chat-panel').classList.toggle('minimised', chatMin);
    ($('cp-min') as HTMLButtonElement).textContent = chatMin ? '+' : '−';
  });

  /* Chat Input */
  $('chat-input')?.addEventListener('keydown', async (e: Event) => {
    const ev = e as KeyboardEvent;
    if (ev.key === 'Enter') {
      const el = ev.target as HTMLInputElement;
      const val = el.value.trim();
      if (!val) return;
      el.value = '';

      // Optimistic UI update
      pushChatFeed('YOU', 'CMD', val);
      slog(`[User] 發送指令: ${val}`, 'info');

      // Send to gateway
      try {
        const res = await fetch(`${GW_BASE}/agents/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: val })
        });
        if (!res.ok) throw new Error('Gateway error');
      } catch (err) {
        slog(`[User] 發送失敗: ${String(err)}`, 'err');
        toast('通訊發射失敗', 'err');
      }
    }
  });

  /* VRAM polling */
  setInterval(() => { void fetchVram(); }, 60_000);

  /* Gateway connect */
  const gw = new WSClient();
  gw.connect();

  /* Demo mode removed */

  /* Initial status removed to prevent infinite loops */

  setTimeout(() => {
    setLoad(90, 'Summoning heroes...');
    setTimeout(() => {
      setLoad(100, '✓ AVENGERS ASSEMBLED!');
      setTimeout(() => { $('loading-screen').classList.add('done'); }, 500);
    }, 400);
  }, 800);

  slog('✓ OpenClaw HQ — Warm Plush Team v2.0 ONLINE', 'ok');
  pushChatFeed('SYSTEM', 'BOOT', 'XXT-AGENT 暖色毛絨幕僚團 v2.0 已就緒。所有成員上線！');
}

main();
