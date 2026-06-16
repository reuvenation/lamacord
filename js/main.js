'use strict';

/* ---------- Шапка: тень/линия при скролле ---------- */
const header = document.querySelector('.header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- Reveal секций при прокрутке ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ============================================================
   Механический флип-таймер
   ============================================================ */
function buildDigit(parent) {
  const d = document.createElement('div');
  d.className = 'flip-digit';
  d.innerHTML =
    '<div class="upper"><span>0</span></div>' +
    '<div class="lower"><span>0</span></div>' +
    '<div class="fold-upper"><span>0</span></div>' +
    '<div class="fold-lower"><span>0</span></div>';
  d.dataset.val = '0';
  parent.appendChild(d);
  return d;
}

function flipTo(digit, val) {
  if (digit.dataset.val === val) return;
  const old = digit.dataset.val;
  const upper = digit.querySelector('.upper span');
  const lower = digit.querySelector('.lower span');
  const foldU = digit.querySelector('.fold-upper span');
  const foldL = digit.querySelector('.fold-lower span');

  upper.textContent = val;   // новое число проявляется сверху за откидной створкой
  lower.textContent = old;   // старое внизу, пока его не накроет створка
  foldU.textContent = old;   // верхняя створка падает со старым числом
  foldL.textContent = val;   // нижняя створка приходит с новым числом

  digit.dataset.val = val;
  digit.classList.remove('go');
  void digit.offsetWidth; // рестарт анимации
  digit.classList.add('go');

  const finish = () => { lower.textContent = val; };
  const foldLower = digit.querySelector('.fold-lower');
  foldLower.addEventListener('animationend', finish, { once: true });
  // подстраховка, если событие не придёт
  setTimeout(finish, 1050);
}

function setUnit(flipEl, num) {
  const str = String(num).padStart(2, '0');
  const digits = flipEl.querySelectorAll('.flip-digit');
  flipTo(digits[0], str[0]);
  flipTo(digits[1], str[1]);
}

// инициализация двух «барабанов» на каждый разряд
document.querySelectorAll('.flip').forEach((el) => {
  buildDigit(el);
  buildDigit(el);
});

// длительность акции и точка отсчёта (сохраняется в рамках вкладки)
const ACTION_SECONDS = 2 * 3600 + 45 * 60; // 2 ч 45 мин
let deadline = Number(sessionStorage.getItem('lc_deadline'));
if (!deadline || deadline < Date.now()) {
  deadline = Date.now() + ACTION_SECONDS * 1000;
  sessionStorage.setItem('lc_deadline', String(deadline));
}

const elH = document.querySelector('.flip[data-unit="h"]');
const elM = document.querySelector('.flip[data-unit="m"]');
const elS = document.querySelector('.flip[data-unit="s"]');

function tick() {
  let left = Math.round((deadline - Date.now()) / 1000);
  if (left <= 0) {
    // акция закончилась — перезапускаем новый цикл
    deadline = Date.now() + ACTION_SECONDS * 1000;
    sessionStorage.setItem('lc_deadline', String(deadline));
    left = ACTION_SECONDS;
  }
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  setUnit(elH, h);
  setUnit(elM, m);
  setUnit(elS, s);
}
tick();
setInterval(tick, 1000);

/* ============================================================
   Маска телефона + отправка заявки
   ============================================================ */
const phoneInput = document.querySelector('input[name="phone"]');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.startsWith('8')) v = '7' + v.slice(1);
    if (!v.startsWith('7')) v = '7' + v;
    v = v.slice(0, 11);
    let out = '+7';
    if (v.length > 1) out += ' (' + v.slice(1, 4);
    if (v.length >= 4) out += ') ' + v.slice(4, 7);
    if (v.length >= 7) out += '-' + v.slice(7, 9);
    if (v.length >= 9) out += '-' + v.slice(9, 11);
    e.target.value = out;
  });
}

/* ---------- Supabase: приём заявок ---------- */
const SUPABASE_URL = 'https://isjbpafvwwhjchmsadpp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamJwYWZ2d3doamNobXNhZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDE4OTUsImV4cCI6MjA5NjY3Nzg5NX0.jKpnSQx8WI0s04o4xV3arzzBpPNpTH6gqmvLvq822PM';
const form = document.getElementById('lead');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const digits = phone.replace(/\D/g, '');
    const btn = form.querySelector('button[type="submit"]');

    if (digits.length < 11) {
      phoneInput.focus();
      phoneInput.style.borderColor = 'var(--accent)';
      return;
    }

    btn.disabled = true;
    const label = btn.querySelector('span');
    const prev = label.textContent;
    label.textContent = 'Отправляем…';

    try {
      // Прямой POST в PostgREST (без тяжёлого SDK). Prefer:return=minimal —
      // сервер не возвращает тело строки → ответ быстрее.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          name,
          phone: phone.replace(/[^\d+]/g, ''),
          source: 'hero',
          user_agent: navigator.userAgent.slice(0, 300)
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      // успех → отдельная страница-«спасибо» (URL-цель для Яндекс.Метрики/Директа)
      window.location.assign('spasibo/');
      return;
    } catch (err) {
      console.error('Lead submit failed:', err);
      label.textContent = 'Ошибка, повторите';
      btn.disabled = false;
      setTimeout(() => { label.textContent = prev; }, 2200);
    }
  });
}
