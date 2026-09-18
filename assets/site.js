document.documentElement.classList.replace('no-js','js');
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 860px)');
  const scrollOpts = () => ({behavior: reduce.matches ? 'auto' : 'smooth', block:'start'});
  const toast = $('#toast');
  function showToast(msg){ if (!toast) return; toast.textContent = msg; toast.classList.add('show'); clearTimeout(showToast.t); showToast.t = setTimeout(()=>toast.classList.remove('show'), 2400); }
  $$('[data-demo]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); showToast('Demo: not connected yet'); }));

  // Mobile menu: close on link tap, Escape, or outside tap.
  const menu = $('#menu');
  if (menu){
    $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open){ menu.open = false; $('summary', menu).focus(); } });
    document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  }

  // ---------- Request form (only on pages that have one) ----------
  const form = $('#roof-request');
  let current = 1, submitted = false;
  if (form){
    const steps = $$('.step', form);
    const label = $('#step-label');
    const digits = v => v.replace(/\D/g,'');
    // Georgia ZIPs: 30000-31999 and 39800-39999. Stand-in for a real coverage lookup.
    const inGeorgia = z => /^3[01]\d{3}$/.test(z) || /^39[89]\d{2}$/.test(z);

    // Steps keep their DOM, so answers survive Back and the sticky CTA.
    function goto(n, focusFirst){
      steps.forEach(s => s.classList.toggle('active', +s.dataset.step === n));
      current = n;
      label.textContent = `Step ${n} of 3`;
      for (let i=1;i<=3;i++) $('#p'+i).classList.toggle('done', i<=n);
      if (focusFirst){ const first = $('.input, .tile', steps[n-1]); first && first.focus({preventScroll:true}); }
    }

    // Selecting a concern never advances the step; Continue does.
    // Leak and storm concerns reveal one follow-up: is water entering now?
    const water = $('#f-water');
    function pickIssue(btn){
      $$('[data-issue]', form).forEach(b => b.setAttribute('aria-pressed', b===btn));
      $('#issue').value = btn.dataset.issue;
      $('#f-issue').classList.remove('invalid');
      const ask = btn.dataset.issue === 'leak' || btn.dataset.issue === 'storm';
      water.hidden = !ask;
      if (!ask){ $('#water').value = ''; $$('[data-water]', form).forEach(b => b.setAttribute('aria-pressed', 'false')); }
    }
    $$('[data-issue]', form).forEach(btn => btn.addEventListener('click', () => pickIssue(btn)));
    $$('[data-water]', form).forEach(btn => btn.addEventListener('click', () => {
      $$('[data-water]', form).forEach(b => b.setAttribute('aria-pressed', b===btn));
      $('#water').value = btn.dataset.water;
    }));
    // Service pages can preselect the matching concern. The visitor can change it.
    const pre = form.dataset.preselect; if (pre){ const b = $(`[data-issue="${pre}"]`, form); b && pickIssue(b); }

    function invalid(id, bad){ $('#'+id).classList.toggle('invalid', bad); return bad; }
    function validate(n){
      let bad = false;
      if (n===1){ bad |= invalid('f-issue', !$('#issue').value); }
      if (n===2){
        const z = $('#zip').value;
        bad |= invalid('f-zip', !/^\d{5}$/.test(z));
        const un = !bad && !inGeorgia(z);
        $('#unavail').classList.toggle('show', un);
        bad |= un;
      }
      if (n===3){
        bad |= invalid('f-name', $('#name').value.trim().length < 2);
        bad |= invalid('f-phone', digits($('#phone').value).length !== 10);
        bad |= invalid('f-consent', !$('#consent').checked);
      }
      if (bad){
        const f = $('.field.invalid', steps[n-1]);
        const target = f ? ($('.input, .tile, input', f)) : $('#unavail');
        target && target.focus({preventScroll:true});
        (f || target).scrollIntoView({behavior: reduce.matches ? 'auto' : 'smooth', block:'center'});
      }
      return !bad;
    }
    $$('[data-next]', form).forEach(b => b.addEventListener('click', () => validate(current) && goto(current+1, true)));
    $$('[data-back]', form).forEach(b => b.addEventListener('click', () => goto(current-1, false)));
    $$('.input', form).forEach(i => i.addEventListener('input', () => { i.closest('.field').classList.remove('invalid'); if (i.id==='zip') $('#unavail').classList.remove('show'); }));
    $('#consent').addEventListener('change', () => $('#f-consent').classList.remove('invalid'));
    $('#phone').addEventListener('input', e => { const d = digits(e.target.value).slice(0,10); e.target.value = d.length>6 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : d.length>3 ? `(${d.slice(0,3)}) ${d.slice(3)}` : d; });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(3)) return;
      // Attribution travels with the request. No personal data goes to analytics.
      const payload = { issue:$('#issue').value, water_entering:$('#water').value || null, zip:$('#zip').value, name:$('#name').value.trim(), phone:digits($('#phone').value), notes:$('#notes').value.trim() || null, tcpa_consent:true, exclusive:true, page_path:$('#page_path').value, page_city:$('#page_city').value || null };
      steps.forEach(s => s.classList.remove('active'));
      $('.progress', form).style.visibility='hidden'; label.textContent='Done';
      $('#payload').textContent = JSON.stringify(payload);
      $('#done').classList.add('active'); $('#done').focus({preventScroll:true});
      submitted = true; updateBar();
    });
  }

  // "Request an inspection" links: on a page with a form, return to the current step
  // without clearing answers. On a page without one, the link's href goes to the home form.
  $$('[data-to-form]').forEach(a => a.addEventListener('click', e => {
    if (!form) return;
    e.preventDefault();
    if (menu) menu.open = false;
    form.scrollIntoView(scrollOpts());
    setTimeout(() => { const first = $('.step.active .input, .step.active .tile', form); first && first.focus({preventScroll:true}); }, reduce.matches ? 0 : 450);
  }));

  // Sticky CTA: visible only when the form is off screen, hidden while a field has focus and after success.
  const bar = $('#mbar');
  let formVisible = !!form, fieldFocused = false;
  function updateBar(){
    if (!bar) return;
    const show = !wide.matches && !formVisible && !fieldFocused && !submitted;
    bar.classList.toggle('show', show);
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    bar.querySelector('a').tabIndex = show ? 0 : -1;
  }
  if (form && 'IntersectionObserver' in window){
    new IntersectionObserver(es => { formVisible = es[0].isIntersecting; updateBar(); }, {threshold:0.05}).observe(form);
  } else { formVisible = false; }
  document.addEventListener('focusin', e => { fieldFocused = !!e.target.closest('input, textarea, select'); updateBar(); });
  document.addEventListener('focusout', () => { fieldFocused = false; updateBar(); });
  wide.addEventListener('change', updateBar);
  updateBar();

  // Disclosures that are accordions on phones and open columns on wide screens.
  const autoOpen = $$('.auto-open, #more-findings');
  function syncOpen(){ if (wide.matches) autoOpen.forEach(d => d.open = true); }
  syncOpen(); wide.addEventListener('change', syncOpen);

  // Optional storm lookup: sample rows, never asks for a phone number.
  const af = $('#addr-form'), ai = $('#address');
  if (af){
    af.addEventListener('submit', e => {
      e.preventDefault();
      const v = ai.value.trim();
      const ok = v.length >= 6 && /\d/.test(v) && /[a-z]/i.test(v);
      af.classList.toggle('invalid', !ok);
      if (!ok){ ai.focus(); return; }
      $('#addr-echo').textContent = `Near ${v}`;
      $('#storm-result').classList.add('open');
      if (!wide.matches) $('#storm-result').scrollIntoView(scrollOpts());
    });
    ai.addEventListener('input', () => af.classList.remove('invalid'));
    const sc = $('#storm-cta'); sc && sc.addEventListener('click', e => { if (!form) return; e.preventDefault(); form.scrollIntoView(scrollOpts()); });
  }

  // Contractor application (demo only)
  const b2b = $('#contractor-application');
  if (b2b) b2b.addEventListener('submit', e => { e.preventDefault(); showToast('Demo: application not connected yet'); });

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target);} }), {rootMargin:'0px 0px -6% 0px', threshold:0.05}) : null;
  $$('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  setTimeout(() => $$('.rv').forEach(el => el.classList.add('in')), 2000);
})();
