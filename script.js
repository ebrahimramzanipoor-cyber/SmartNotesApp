document.addEventListener('DOMContentLoaded', () => {
  const { LocalNotifications } = Capacitor.Plugins;

  // ساخت کانال نسخه ۲ برای دور زدن کش اندروید
  if (LocalNotifications) {
    LocalNotifications.createChannel({
      id: 'alarm-channel-v2',
      name: 'آلارم یادآور',
      description: 'کانال پخش صدای آلارم برای یادآورها',
      sound: 'alarm.mp3',
      importance: 5,
      visibility: 1,
      vibration: true
    }).catch(err => console.log('Channel creation error:', err));
  }

  let state = {
    theme: localStorage.getItem('app_theme') || 'dark',
    lang: localStorage.getItem('app_lang') || 'fa',
    notes: JSON.parse(localStorage.getItem('app_notes')) || [],
    selectedDate: '',
    clipboard: []
  };

  const body = document.body;
  const notesList = document.getElementById('notes-list');
  const liveTime = document.getElementById('live-time');
  const liveDate = document.getElementById('live-date');
  const calTitle = document.getElementById('cal-title');
  const calGrid = document.getElementById('cal-grid');
  
  const PERSIAN_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const PERSIAN_DAYS = ['ش','ی','د','س','چ','پ','ج'];
  const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const EN_DAYS = ['S','M','T','W','T','F','S'];

  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const div = (a, b) => ~~(a / b); const mod = (a, b) => a - ~~(a / b) * b;
  function jalCal(jy) { let bl = BREAKS.length, gy = jy + 621, leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, leap, leapG, march; for (let i = 1; i < bl; i++) { jm = BREAKS[i]; jump = jm - jp; if (jy < jm) break; leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; } n = jy - jp; leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4); if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1; leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150; march = 20 + leapJ - leapG; if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33; leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4; return { leap, gy, march }; }
  function g2d(gy, gm, gd) { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; return d; }
  function d2g(jdn) { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; let i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1, gy = div(j, 1461) - 100100 + div(8 - gm, 6); return { gy, gm, gd }; }
  function j2d(jy, jm, jd) { let r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) { let gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), k, jm, jd; k = jdn - jdn1f; if (k >= 0) { if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; } k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; } jm = 7 + div(k, 30); jd = mod(k, 30) + 1; return { jy, jm, jd }; }
  function jalaliMonthLength(jy, jm) { if (jm <= 6) return 31; if (jm <= 11) return 30; return jalCal(jy).leap === 0 ? 30 : 29; }

  function getSafeDateStr(dateObj) { return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`; }
  function toFaNum(str) { return String(str).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

  function applySettings() {
    body.className = `theme-${state.theme} lang-${state.lang}`;
    document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
    const isFa = state.lang === 'fa';
    
    document.getElementById('datetime-trigger').title = isFa ? 'انتخاب تاریخ' : 'Select Date';
    document.getElementById('note-modal-title').innerText = isFa ? 'یادداشت' : 'Note';
    document.querySelector('#note-title-input').placeholder = isFa ? 'عنوان...' : 'Title...';
    document.querySelector('#note-desc-input').placeholder = isFa ? 'توضیحات...' : 'Description...';
    document.querySelector('#save-note-btn').innerText = isFa ? 'ذخیره' : 'Save';
    document.querySelector('#settings-modal h3').innerText = isFa ? 'تنظیمات' : 'Settings';
    document.querySelector('#toggle-theme').innerText = isFa ? 'تغییر تم' : 'Toggle Theme';
    document.querySelector('#export-btn').innerText = isFa ? '📤 خروجی' : '📤 Export';
    document.querySelector('#import-btn').innerText = isFa ? '📥 ورودی' : '📥 Import';
    updateHeaderDate();
    renderNotes();
  }

  function updateHeaderDate() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    let timeStr = `${hours}:${minutes}`;
    let dateStr = '';
    
    if (state.lang === 'fa') {
      timeStr = toFaNum(timeStr);
      if (state.selectedDate) {
        const parts = state.selectedDate.split('-');
        const gy = parseInt(parts[0]), gm = parseInt(parts[1]), gd = parseInt(parts[2]);
        const j = d2j(g2d(gy, gm, gd));
        const pDayIndex = (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
        const pDayName = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'][pDayIndex];
        dateStr = `${pDayName} | ${toFaNum(j.jd)} ${PERSIAN_MONTHS[j.jm - 1]} ${toFaNum(j.jy)}`;
      }
    } else {
      if (state.selectedDate) {
        const parts = state.selectedDate.split('-');
        const gy = parseInt(parts[0]), gm = parseInt(parts[1]), gd = parseInt(parts[2]);
        const enDayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(gy, gm - 1, gd).getDay()];
        dateStr = `${enDayName} | ${gd} ${EN_MONTHS[gm-1]} ${gy}`;
      }
    }
    liveTime.innerText = timeStr;
    liveDate.innerText = dateStr;
  }

  let currentCalYear, currentCalMonth, isCalJalali;

  function openCalendar() {
    const now = new Date();
    const j = d2j(g2d(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    if (state.lang === 'fa') { isCalJalali = true; currentCalYear = j.jy; currentCalMonth = j.jm; } 
    else { isCalJalali = false; currentCalYear = now.getFullYear(); currentCalMonth = now.getMonth() + 1; }
    renderCalendar();
    document.getElementById('calendar-modal').classList.add('active');
  }

  function renderCalendar() {
    const isFa = state.lang === 'fa';
    let titleText = '', daysHeaders = [], startDayCol = 0, daysInMonth = 0;
    let todayStr = getSafeDateStr(new Date());

    if (isCalJalali) {
      titleText = `${PERSIAN_MONTHS[currentCalMonth - 1]} ${toFaNum(currentCalYear)}`;
      daysHeaders = PERSIAN_DAYS;
      daysInMonth = jalaliMonthLength(currentCalYear, currentCalMonth);
      let firstDayOfMonthJdn = j2d(currentCalYear, currentCalMonth, 1);
      let firstDayG = d2g(firstDayOfMonthJdn);
      startDayCol = (new Date(firstDayG.gy, firstDayG.gm-1, firstDayG.gd).getDay() + 1) % 7;
    } else {
      titleText = `${EN_MONTHS[currentCalMonth - 1]} ${currentCalYear}`;
      daysHeaders = EN_DAYS;
      daysInMonth = new Date(currentCalYear, currentCalMonth, 0).getDate();
      startDayCol = new Date(currentCalYear, currentCalMonth - 1, 1).getDay();
    }

    calTitle.innerText = titleText;
    calGrid.innerHTML = '';
    
    daysHeaders.forEach(d => { const el = document.createElement('div'); el.className = 'cal-day header'; el.innerText = d; calGrid.appendChild(el); });
    for (let i = 0; i < startDayCol; i++) { const el = document.createElement('div'); el.className = 'cal-day empty'; calGrid.appendChild(el); }

    for (let d = 1; d <= daysInMonth; d++) {
      const el = document.createElement('div');
      el.className = 'cal-day';
      let thisJdn = isCalJalali ? j2d(currentCalYear, currentCalMonth, d) : g2d(currentCalYear, currentCalMonth, d);
      let thisG = d2g(thisJdn);
      let thisDateStr = `${thisG.gy}-${String(thisG.gm).padStart(2,'0')}-${String(thisG.gd).padStart(2,'0')}`;
      
      el.innerHTML = `<span>${isFa ? toFaNum(d) : d}</span>`;
      
      if (thisDateStr === todayStr) el.classList.add('today');
      if (thisDateStr === state.selectedDate) el.classList.add('selected');

      const dayNotes = state.notes.filter(n => n.date === thisDateStr);
      if (dayNotes.length > 0) {
        let dotsHtml = '<div class="cal-dots">';
        if (dayNotes.some(n => !n.alarm)) dotsHtml += '<span class="dot green"></span>';
        if (dayNotes.some(n => n.alarm)) dotsHtml += '<span class="dot red"></span>';
        dotsHtml += '</div>';
        el.innerHTML += dotsHtml;
      }

      el.addEventListener('click', () => {
        state.selectedDate = thisDateStr;
        document.getElementById('calendar-modal').classList.remove('active');
        updateHeaderDate();
        renderNotes();
      });
      calGrid.appendChild(el);
    }
  }

  function renderNotes() {
    const isFa = state.lang === 'fa';
    notesList.innerHTML = '';
    const dayNotes = state.notes.filter(n => n.date === state.selectedDate);
    
    dayNotes.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return (a.order || 0) - (b.order || 0);
    });

    if (dayNotes.length === 0) {
      notesList.innerHTML = `<div class="empty-state">${isFa ? 'هیچ یادداشتی نیست.' : 'No notes.'}</div>`;
      return;
    }

    dayNotes.forEach(note => {
      const card = document.createElement('div');
      card.className = `note-card ${note.completed ? 'completed' : ''}`;
      
      let timeDisplay = note.time ? (isFa ? toFaNum(note.time) : note.time) : '';
      let descHtml = note.description ? `<div class="note-desc">${note.description}</div>` : '';
      let alarmCls = note.alarm ? 'card-icon-btn alarm-active' : 'card-icon-btn';
      let alarmIcon = note.alarm ? '🔔' : '🔕';

      card.innerHTML = `
        <input type="checkbox" class="note-checkbox" ${note.completed ? 'checked' : ''}>
        <div class="note-content">
          <div class="note-title">${note.title}</div>
          ${descHtml}
          <div class="note-meta"><span>${timeDisplay}</span></div>
        </div>
        <div class="note-card-actions">
          <button class="${alarmCls} alarm-btn">${alarmIcon}</button>
          <button class="card-icon-btn delete-btn">🗑️</button>
        </div>
      `;

      card.querySelector('.note-checkbox').addEventListener('change', (e) => {
        note.completed = e.target.checked; saveData(); renderNotes();
      });

      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm(isFa ? 'حذف شود؟' : 'Delete?')) {
          state.notes = state.notes.filter(n => n.id !== note.id); saveData(); renderNotes();
        }
      });

      card.querySelector('.alarm-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        note.alarm = !note.alarm;
        if (note.alarm) note.alarmTriggered = false;
        saveData(); renderNotes();
      });

      card.querySelector('.note-content').addEventListener('click', () => openNoteModal(note));

      notesList.appendChild(card);
    });
  }

  let editingNoteId = null;

  function openNoteModal(note = null) {
    editingNoteId = note ? note.id : null;
    document.getElementById('note-modal-title').innerText = note ? 'ویرایش' : 'یادداشت جدید';
    document.getElementById('note-title-input').value = note ? note.title : '';
    document.getElementById('note-desc-input').value = note ? note.description : '';
    document.getElementById('note-time-input').value = note ? note.time : '';
    document.getElementById('note-alarm-input').checked = note ? note.alarm : false;
    document.getElementById('note-modal').classList.add('active');
  }

  async function scheduleNativeAlarm(note) {
    if (!note.alarm || !note.time) return;
    
    try {
      // ۱. بررسی و درخواست دسترسی اعلان
      let perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        alert('برای دریافت آلارم، دسترسی اعلان‌ها را در تنظیمات گوشی فعال کنید.');
        return;
      }

      // ۲. بررسی و درخواست دسترسی برای آلارم دقیق (اندروید ۱۲ به بالا)
      const exactPerm = await LocalNotifications.checkExactNotificationSetting();
      if (exactPerm.exact_alarm !== 'granted') {
        await LocalNotifications.changeExactNotificationSetting();
      }

      const [hours, minutes] = note.time.split(':');
      let alarmDate = new Date(`${note.date}T${hours}:${minutes}:00`);
      
      if (alarmDate.getTime() < Date.now()) {
         return; 
      }

      const notifId = parseInt(note.id.slice(-6), 16) % 2147483647;

      await LocalNotifications.schedule({
        notifications: [
          {
            title: note.title,
            body: note.description || 'یادآور دفترچه هوشمند',
            id: notifId,
            schedule: { 
              at: alarmDate,
              allowWhileIdle: true // حیاتی برای اجرای آلارم در حالت خواب گوشی
            },
            sound: 'alarm.mp3',
            channelId: 'alarm-channel-v2',
            actionTypeId: "",
            extra: null
          }
        ]
      });
      console.log('Alarm scheduled for:', alarmDate);
    } catch (e) {
      console.error('Error scheduling alarm:', e);
    }
  }

  async function cancelNativeAlarm(note) {
    try {
      const notifId = parseInt(note.id.slice(-6), 16) % 2147483647;
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch (e) {
      console.error(e);
    }
  }

  document.getElementById('save-note-btn').addEventListener('click', () => {
    const title = document.getElementById('note-title-input').value.trim();
    if (!title) return;
    const desc = document.getElementById('note-desc-input').value.trim();
    const time = document.getElementById('note-time-input').value;
    const alarm = document.getElementById('note-alarm-input').checked;

    if (editingNoteId) {
      const note = state.notes.find(n => n.id === editingNoteId);
      if (note) { 
        if(note.alarm && !alarm) cancelNativeAlarm(note); 
        note.title = title; note.description = desc; note.time = time; note.alarm = alarm; 
        if (alarm) scheduleNativeAlarm(note); 
      }
    } else {
      const newNote = { id: Date.now().toString(), date: state.selectedDate, title, description: desc, time, alarm, completed: false, order: Date.now() };
      state.notes.push(newNote);
      if (alarm) scheduleNativeAlarm(newNote);
    }
    saveData(); document.getElementById('note-modal').classList.remove('active'); renderNotes();
  });

  document.getElementById('copy-btn').addEventListener('click', () => {
    const dayNotes = state.notes.filter(n => n.date === state.selectedDate);
    if(dayNotes.length === 0) return;
    state.clipboard = JSON.parse(JSON.stringify(dayNotes));
    alert(state.lang === 'fa' ? 'کپی شد.' : 'Copied.');
  });
  document.getElementById('paste-btn').addEventListener('click', () => {
    if(state.clipboard.length === 0) return;
    state.clipboard.forEach(n => {
      const newNote = { id: Date.now().toString() + Math.random(), date: state.selectedDate, title: n.title, description: n.description, time: n.time, alarm: n.alarm, completed: false, order: Date.now() };
      state.notes.push(newNote);
      if (newNote.alarm) scheduleNativeAlarm(newNote);
    });
    saveData(); renderNotes();
  });

  document.getElementById('toggle-theme').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('app_theme', state.theme); applySettings(); });
  document.getElementById('toggle-lang').addEventListener('click', () => { state.lang = state.lang === 'fa' ? 'en' : 'fa'; localStorage.setItem('app_lang', state.lang); applySettings(); });

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.notes)], {type: "application/json"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `notes_backup_${Date.now()}.json`; a.click();
  });
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if(Array.isArray(imported)) {
          const existingIds = new Set(state.notes.map(n => n.id));
          imported.forEach(n => { if(!existingIds.has(n.id)) state.notes.push(n); });
          saveData(); renderNotes(); alert('بازگردانی شد.');
        }
      } catch(err) { alert('خطا در فایل.'); }
    };
    reader.readAsText(file);
  });

  function saveData() { localStorage.setItem('app_notes', JSON.stringify(state.notes)); }

  document.getElementById('datetime-trigger').addEventListener('click', openCalendar);
  document.getElementById('close-calendar').addEventListener('click', () => document.getElementById('calendar-modal').classList.remove('active'));
  document.getElementById('fab-add').addEventListener('click', () => openNoteModal());
  document.getElementById('close-note-modal').addEventListener('click', () => document.getElementById('note-modal').classList.remove('active'));
  document.getElementById('fab-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.add('active'));
  document.getElementById('close-settings-modal').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('active'));
  
  document.getElementById('prev-month').addEventListener('click', () => { currentCalMonth--; if(currentCalMonth < 1) { currentCalMonth = 12; currentCalYear--; } renderCalendar(); });
  document.getElementById('next-month').addEventListener('click', () => { currentCalMonth++; if(currentCalMonth > 12) { currentCalMonth = 1; currentCalYear++; } renderCalendar(); });

  if(!state.selectedDate) state.selectedDate = getSafeDateStr(new Date());
  applySettings();
  setInterval(() => { updateHeaderDate(); }, 1000);
});
