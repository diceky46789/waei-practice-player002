const DEFAULT_SETTINGS = {
  readJp: true,
  readEn: true,
  jpRepeat: 1,
  thinkingSec: 5,
  speakingSec: 3,
  enRepeat: 3,
  enGapSec: 0.3,
  nextDelaySec: 2,
  speechRate: 1.0,
  perQuestionRepeat: 1,
  randomMode: false,
  repeatMode: false,
  hideEnglishInitially: true,
  showExplanation: true,
  preferAudioFiles: true,
  fallbackToSpeech: true,
  resumeFromMemory: true,
  strictAudioMode: true,
  retryFailedAudio: true
};

const SAMPLE_DATASET_ID = 'sample_builtin';
const SAMPLE_CSV_URL = 'problems.csv';
const DB_NAME = 'waei_audio_app_stable_db';
const DB_VERSION = 1;
const DATASET_STORE = 'datasets';
const AUDIO_STORE = 'audioFiles';

let db = null;
let settings = loadSettings();
let activeDatasetId = loadActiveDatasetId();
let problems = [];
let currentDataset = null;
let displayOrder = [];
let currentOrderIndex = 0;
let isPlaying = false;
let isPaused = false;
let revealed = false;
let activeTimeout = null;
let currentAudio = null;
let playbackToken = 0;

const els = {
  screenPractice: document.getElementById('screenPractice'),
  screenList: document.getElementById('screenList'),
  screenSettings: document.getElementById('screenSettings'),
  tabPractice: document.getElementById('tabPractice'),
  tabList: document.getElementById('tabList'),
  tabSettings: document.getElementById('tabSettings'),
  datasetButtonsPractice: document.getElementById('datasetButtonsPractice'),
  datasetButtonsList: document.getElementById('datasetButtonsList'),
  datasetManager: document.getElementById('datasetManager'),
  progressText: document.getElementById('progressText'),
  progressBar: document.getElementById('progressBar'),
  phaseBadge: document.getElementById('phaseBadge'),
  problemSlider: document.getElementById('problemSlider'),
  sliderLabel: document.getElementById('sliderLabel'),
  jpText: document.getElementById('jpText'),
  enText: document.getElementById('enText'),
  exText: document.getElementById('exText'),
  jpAudioStatus: document.getElementById('jpAudioStatus'),
  enAudioStatus: document.getElementById('enAudioStatus'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  replayJpBtn: document.getElementById('replayJpBtn'),
  retryBtn: document.getElementById('retryBtn'),
  toggleAnswerBtn: document.getElementById('toggleAnswerBtn'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  problemList: document.getElementById('problemList'),
  datasetFileInput: document.getElementById('datasetFileInput'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn'),
  readJp: document.getElementById('readJp'),
  readEn: document.getElementById('readEn'),
  jpRepeat: document.getElementById('jpRepeat'),
  thinkingSec: document.getElementById('thinkingSec'),
  speakingSec: document.getElementById('speakingSec'),
  enRepeat: document.getElementById('enRepeat'),
  enGapSec: document.getElementById('enGapSec'),
  nextDelaySec: document.getElementById('nextDelaySec'),
  speechRate: document.getElementById('speechRate'),
  perQuestionRepeat: document.getElementById('perQuestionRepeat'),
  randomMode: document.getElementById('randomMode'),
  repeatMode: document.getElementById('repeatMode'),
  hideEnglishInitially: document.getElementById('hideEnglishInitially'),
  showExplanation: document.getElementById('showExplanation'),
  preferAudioFiles: document.getElementById('preferAudioFiles'),
  fallbackToSpeech: document.getElementById('fallbackToSpeech'),
  resumeFromMemory: document.getElementById('resumeFromMemory'),
  strictAudioMode: document.getElementById('strictAudioMode'),
  retryFailedAudio: document.getElementById('retryFailedAudio')
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('waei_settings_stable') || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() { localStorage.setItem('waei_settings_stable', JSON.stringify(settings)); }
function loadActiveDatasetId() { return localStorage.getItem('waei_active_dataset_id_stable') || SAMPLE_DATASET_ID; }
function saveActiveDatasetId() { localStorage.setItem('waei_active_dataset_id_stable', activeDatasetId); }
function getMemoryKey(id) { return `waei_memory_position_stable_${id}`; }
function saveCurrentPosition() { if (activeDatasetId && settings.resumeFromMemory) localStorage.setItem(getMemoryKey(activeDatasetId), String(currentOrderIndex)); }
function loadSavedPosition(id) { const n = Number(localStorage.getItem(getMemoryKey(id))); return Number.isInteger(n) && n >= 0 ? n : 0; }

function applySettingsToForm() {
  Object.keys(DEFAULT_SETTINGS).forEach(key => {
    if (!els[key]) return;
    if (typeof DEFAULT_SETTINGS[key] === 'boolean') els[key].checked = settings[key];
    else els[key].value = settings[key];
  });
}

function clampInt(v, min, max, fallback) {
  let n = parseInt(v, 10); if (Number.isNaN(n)) n = fallback; return Math.max(min, Math.min(max, n));
}
function clampNumber(v, min, max, fallback) {
  let n = parseFloat(v); if (Number.isNaN(n)) n = fallback; return Math.max(min, Math.min(max, n));
}
function readSettingsFromForm() {
  settings = {
    readJp: els.readJp.checked,
    readEn: els.readEn.checked,
    jpRepeat: clampInt(els.jpRepeat.value, 1, 5, 1),
    thinkingSec: clampNumber(els.thinkingSec.value, 0, 60, 5),
    speakingSec: clampNumber(els.speakingSec.value, 0, 60, 3),
    enRepeat: clampInt(els.enRepeat.value, 1, 10, 3),
    enGapSec: clampNumber(els.enGapSec.value, 0.1, 10, 0.3),
    nextDelaySec: clampNumber(els.nextDelaySec.value, 0, 30, 2),
    speechRate: clampNumber(els.speechRate.value, 0.5, 1.5, 1.0),
    perQuestionRepeat: clampInt(els.perQuestionRepeat.value, 1, 20, 1),
    randomMode: els.randomMode.checked,
    repeatMode: els.repeatMode.checked,
    hideEnglishInitially: els.hideEnglishInitially.checked,
    showExplanation: els.showExplanation.checked,
    preferAudioFiles: els.preferAudioFiles.checked,
    fallbackToSpeech: els.fallbackToSpeech.checked,
    resumeFromMemory: els.resumeFromMemory.checked,
    strictAudioMode: els.strictAudioMode.checked,
    retryFailedAudio: els.retryFailedAudio.checked
  };
  saveSettings();
  applySettingsToForm();
  buildDisplayOrder();
  renderCurrentProblem();
}

function switchTab(tab) {
  const mapping = { practice:[els.screenPractice,els.tabPractice], list:[els.screenList,els.tabList], settings:[els.screenSettings,els.tabSettings] };
  [els.screenPractice, els.screenList, els.screenSettings].forEach(s=>s.classList.remove('active'));
  [els.tabPractice, els.tabList, els.tabSettings].forEach(b=>b.classList.remove('active'));
  mapping[tab][0].classList.add('active');
  mapping[tab][1].classList.add('active');
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DATASET_STORE)) db.createObjectStore(DATASET_STORE, { keyPath:'id' });
      if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE, { keyPath:'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode='readonly') { return db.transaction(store, mode).objectStore(store); }
function getAllDatasets() { return new Promise((res, rej)=>{ const r=tx(DATASET_STORE).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);});}
function getDataset(id) { return new Promise((res, rej)=>{ const r=tx(DATASET_STORE).get(id); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error);});}
function putDataset(dataset) { return new Promise((res, rej)=>{ const r=tx(DATASET_STORE,'readwrite').put(dataset); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error);});}
function deleteDatasetRecord(id) { return new Promise((res, rej)=>{ const r=tx(DATASET_STORE,'readwrite').delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error);});}
function putAudioBlob(key, blob) { return new Promise((res, rej)=>{ const r=tx(AUDIO_STORE,'readwrite').put({key, blob}); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error);});}
function getAudioBlob(key) { return new Promise((res, rej)=>{ const r=tx(AUDIO_STORE).get(key); r.onsuccess=()=>res(r.result ? r.result.blob : null); r.onerror=()=>rej(r.error);});}
function deleteAudioBlob(key) { return new Promise((res, rej)=>{ const r=tx(AUDIO_STORE,'readwrite').delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error);});}

function csvToProblems(text) {
  const rows = [];
  let row=[], cell='', inQuotes=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (c === '"' && inQuotes && n === '"') { cell += '"'; i++; }
    else if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { row.push(cell); cell=''; }
    else if ((c === '\n' || c === '\r') && !inQuotes) { if (c === '\r' && n === '\n') i++; row.push(cell); if (row.some(v=>v!=='')) rows.push(row); row=[]; cell=''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); if (row.some(v=>v!=='')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1).map((r, idx) => {
    const item = {}; headers.forEach((h,i)=>item[h]=(r[i]||'').trim());
    return { id: idx+1, jp:item.jp||'', en:item.en||'', ex:item.ex||'', jpAudio:item.jpAudio||'', enAudio:item.enAudio||'', status:'未記録' };
  }).filter(p=>p.jp || p.en);
}

function datasetDisplayName(ds) { return ds?.name || '無題'; }
function buildDisplayOrder() {
  displayOrder = problems.map((_,i)=>i);
  if (settings.randomMode) {
    for (let i=displayOrder.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [displayOrder[i], displayOrder[j]] = [displayOrder[j], displayOrder[i]];
    }
  }
  currentOrderIndex = Math.max(0, Math.min(currentOrderIndex, Math.max(0, displayOrder.length-1)));
  updateSlider();
}
function currentProblem() { if (!problems.length) return null; return problems[displayOrder[currentOrderIndex]]; }
function updatePhase(label) { els.phaseBadge.textContent = label; }
function escapeHtml(str) { return (str||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function updateSlider() {
  const max = Math.max(1, displayOrder.length);
  els.problemSlider.min = 1; els.problemSlider.max = max; els.problemSlider.value = Math.min(max, currentOrderIndex+1);
  els.sliderLabel.textContent = `問題 ${Math.min(max, currentOrderIndex+1)} に移動`;
}
async function setActiveDataset(id) {
  const ds = await getDataset(id); if (!ds) return;
  stopPlayback(false);
  activeDatasetId = id; saveActiveDatasetId();
  currentDataset = ds; problems = ds.problems || [];
  currentOrderIndex = settings.resumeFromMemory ? loadSavedPosition(id) : 0;
  buildDisplayOrder(); await renderDatasetButtons(); await renderDatasetManager(); renderCurrentProblem(); renderList(els.searchInput.value || '');
}
async function deleteDataset(id) {
  if (id === SAMPLE_DATASET_ID) { alert('内蔵サンプルは削除できません。'); return; }
  const ds = await getDataset(id); if (!ds) return;
  if (Array.isArray(ds.audioKeys)) for (const key of ds.audioKeys) await deleteAudioBlob(key);
  await deleteDatasetRecord(id); localStorage.removeItem(getMemoryKey(id));
  if (activeDatasetId === id) await setActiveDataset(SAMPLE_DATASET_ID); else { await renderDatasetButtons(); await renderDatasetManager(); }
}
async function renderDatasetButtons() {
  const datasets = await getAllDatasets();
  [els.datasetButtonsPractice, els.datasetButtonsList].forEach(container => {
    container.innerHTML = '';
    datasets.forEach(ds => {
      const btn = document.createElement('button');
      btn.className = 'dataset-btn' + (ds.id === activeDatasetId ? ' active' : '');
      btn.textContent = `${datasetDisplayName(ds)} (${(ds.problems || []).length})`;
      btn.addEventListener('click', ()=>setActiveDataset(ds.id));
      container.appendChild(btn);
    });
  });
}
async function renderDatasetManager() {
  const datasets = await getAllDatasets();
  els.datasetManager.innerHTML = '';
  datasets.forEach(ds => {
    const savedPos = loadSavedPosition(ds.id) + 1;
    const sub = ds.id === SAMPLE_DATASET_ID ? `内蔵サンプル / 前回位置: ${savedPos}` : `問題数: ${(ds.problems||[]).length} / 音声数: ${(ds.audioKeys||[]).length} / 前回位置: ${savedPos}`;
    const row = document.createElement('div');
    row.className = 'dataset-row';
    row.innerHTML = `<div class="dataset-meta"><div class="dataset-name">${escapeHtml(datasetDisplayName(ds))}</div><div class="dataset-sub">${escapeHtml(sub)}</div></div><div class="row gap wrap"><button data-activate="${ds.id}" class="${ds.id===activeDatasetId?'primary':''}">この問題集を使う</button>${ds.id===SAMPLE_DATASET_ID?'':`<button data-delete="${ds.id}" class="danger-btn">削除</button>`}</div>`;
    els.datasetManager.appendChild(row);
  });
}

function renderCurrentProblem() {
  const p = currentProblem();
  if (!p) {
    els.jpText.textContent = '問題がありません。';
    els.enText.textContent = '';
    els.exText.textContent = '';
    els.progressText.textContent = '問題 0 / 0';
    els.progressBar.style.width = '0%';
    els.jpAudioStatus.textContent = '日本語音声: -';
    els.enAudioStatus.textContent = '英語音声: -';
    updateSlider(); updatePhase('待機中'); return;
  }
  els.progressText.textContent = `問題 ${currentOrderIndex+1} / ${displayOrder.length}`;
  els.progressBar.style.width = `${((currentOrderIndex+1)/displayOrder.length)*100}%`;
  els.jpText.textContent = p.jp;
  revealed = !settings.hideEnglishInitially;
  renderEnglish();
  els.exText.textContent = settings.showExplanation ? (p.ex || '') : '非表示';
  els.jpAudioStatus.textContent = `日本語音声: ${p.jpAudio || 'なし'}`;
  els.enAudioStatus.textContent = `英語音声: ${p.enAudio || 'なし'}`;
  updateSlider(); saveCurrentPosition();
}
function renderEnglish() {
  const p = currentProblem(); if (!p) return;
  if (revealed) { els.enText.textContent = p.en || ''; els.toggleAnswerBtn.textContent = '答えを隠す'; }
  else { els.enText.textContent = '*****'; els.toggleAnswerBtn.textContent = '答えを見る'; }
}
function renderList(filter='') {
  const q = filter.trim().toLowerCase();
  els.problemList.innerHTML = '';
  problems.forEach((p, idx) => {
    const hit = !q || p.jp.toLowerCase().includes(q) || p.en.toLowerCase().includes(q) || (p.ex||'').toLowerCase().includes(q);
    if (!hit) return;
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<div class="list-item-header"><strong>問題 ${idx+1}</strong><span>${p.status||'未記録'}</span></div><div class="list-item-jp">${escapeHtml(p.jp)}</div><div class="list-item-en">${escapeHtml(p.en)}</div><div class="small-note">日本語音声: ${escapeHtml(p.jpAudio||'なし')}</div><div class="small-note">英語音声: ${escapeHtml(p.enAudio||'なし')}</div><div class="row gap wrap" style="margin-top:8px;"><button data-jump="${idx}">この問題へ</button><button data-status="${idx}:できた">できた</button><button data-status="${idx}:少し迷った">少し迷った</button><button data-status="${idx}:できなかった">できなかった</button></div>`;
    els.problemList.appendChild(item);
  });
}

function sleep(ms) { return new Promise(resolve => { activeTimeout = setTimeout(resolve, ms); }); }
function clearTimers() { if (activeTimeout) clearTimeout(activeTimeout); activeTimeout = null; }
async function countdown(seconds) { seconds = Number(seconds)||0; if (seconds <= 0) return; await sleep(seconds*1000); }
function getVoice(langPrefix) {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix)) || null;
}
async function speak(text, langPrefix, token) {
  if (!text || token !== playbackToken) return false;
  return await new Promise(resolve => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = settings.speechRate;
    const voice = getVoice(langPrefix);
    if (voice) utter.voice = voice;
    utter.lang = langPrefix === 'ja' ? 'ja-JP' : 'en-US';
    utter.onend = () => resolve(true);
    utter.onerror = () => resolve(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}
function normalizeFileName(name) { return (name||'').trim().toLowerCase(); }

function stopCurrentAudio() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    try { currentAudio.src = ''; } catch {}
    currentAudio = null;
  }
}

async function playAudioBlob(blob, token) {
  if (!blob || token !== playbackToken) return false;
  return await new Promise((resolve) => {
    stopCurrentAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    currentAudio = audio;
    audio.preload = 'auto';
    audio.src = url;
    audio.playbackRate = settings.speechRate;

    let ended = False = False
    let done = False
    const cleanup = (result) => {
      if (done) return;
      done = true;
      try { audio.pause(); } catch {}
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve(result);
    };

    audio.onended = () => cleanup(true);
    audio.onerror = () => cleanup(false);
    audio.onpause = () => {
      if (!audio.ended && token === playbackToken && isPlaying) {
        // ignore manual intermediate pause unless final cleanup
      }
    };

    const startPlay = async () => {
      try {
        await audio.play();
      } catch {
        cleanup(false);
        return;
      }
      // safety timeout if ended event is missed
      const checker = setInterval(() => {
        if (token !== playbackToken) {
          clearInterval(checker);
          cleanup(false);
          return;
        }
        if (!currentAudio || currentAudio !== audio) {
          clearInterval(checker);
          cleanup(false);
          return;
        }
        if (audio.ended) {
          clearInterval(checker);
          cleanup(true);
        }
      }, 120);
    };
    startPlay();
  });
}

async function playNamedAudio(fileName, token) {
  if (!currentDataset || !fileName || token !== playbackToken) return false;
  const key = `${currentDataset.id}::${normalizeFileName(fileName)}`;
  const blob = await getAudioBlob(key);
  if (!blob) return false;
  let ok = await playAudioBlob(blob, token);
  if (!ok && settings.retryFailedAudio && token === playbackToken) {
    await countdown(0.2);
    ok = await playAudioBlob(blob, token);
  }
  return ok;
}

async function speakOrPlay(fileName, text, langPrefix, token) {
  if (token !== playbackToken) return false;
  let fileAttempted = false;
  let done = false;

  if (settings.preferAudioFiles && fileName) {
    fileAttempted = true;
    done = await playNamedAudio(fileName, token);
  }

  if (settings.strictAudioMode && fileAttempted) {
    return done;
  }

  if (!done && settings.fallbackToSpeech && text) {
    done = await speak(text, langPrefix, token);
  }
  return done;
}

async function speakOrPlayRepeated(fileName, text, langPrefix, times, gapSec, token) {
  for (let i = 0; i < times; i++) {
    if (!isPlaying || isPaused || token !== playbackToken) break;
    const ok = await speakOrPlay(fileName, text, langPrefix, token);
    if (!ok && settings.retryFailedAudio && token === playbackToken) {
      await countdown(0.25);
      await speakOrPlay(fileName, text, langPrefix, token);
    }
    if (i < times - 1) {
      await countdown(gapSec);
      // extra short stabilizer for iPhone
      await countdown(0.15);
    }
  }
}

async function replayJapaneseOnly() {
  const p = currentProblem(); if (!p || !settings.readJp) return;
  const token = ++playbackToken;
  isPlaying = true; isPaused = false;
  updatePhase('日本語再生');
  await speakOrPlayRepeated(p.jpAudio, p.jp, 'ja', settings.jpRepeat, 0.15, token);
  isPlaying = false;
  updatePhase('停止中');
}

async function runCurrentProblemFromStart(token) {
  const p = currentProblem(); if (!p) return;
  const repeatCount = Math.max(1, Number(settings.perQuestionRepeat) || 1);

  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++) {
    if (!isPlaying || isPaused || token !== playbackToken) break;
    renderCurrentProblem();

    if (settings.readJp) {
      updatePhase(`日本語再生 ${repeatIndex+1}/${repeatCount}`);
      await speakOrPlayRepeated(p.jpAudio, p.jp, 'ja', settings.jpRepeat, 0.15, token);
      if (!isPlaying || isPaused || token !== playbackToken) break;
    }

    updatePhase(`考える時間 ${repeatIndex+1}/${repeatCount}`);
    await countdown(settings.thinkingSec);
    if (!isPlaying || isPaused || token !== playbackToken) break;

    updatePhase(`発話時間 ${repeatIndex+1}/${repeatCount}`);
    await countdown(settings.speakingSec);
    if (!isPlaying || isPaused || token !== playbackToken) break;

    revealed = true;
    renderEnglish();

    if (settings.readEn) {
      updatePhase(`英語再生 ${repeatIndex+1}/${repeatCount}`);
      await speakOrPlayRepeated(p.enAudio, p.en, 'en', settings.enRepeat, settings.enGapSec, token);
      if (!isPlaying || isPaused || token !== playbackToken) break;
    }

    if (repeatIndex < repeatCount - 1) {
      updatePhase(`同じ問題を繰り返し ${repeatIndex+1}/${repeatCount}`);
      await countdown(settings.nextDelaySec);
    }
  }
}

async function playSequence() {
  if (!problems.length) return;
  if (isPlaying) return;
  isPlaying = true;
  isPaused = false;
  const token = ++playbackToken;

  while (isPlaying && !isPaused && token === playbackToken) {
    await runCurrentProblemFromStart(token);
    if (!isPlaying || isPaused || token !== playbackToken) break;
    updatePhase('次の問題へ');
    await countdown(settings.nextDelaySec);
    if (!isPlaying || isPaused || token !== playbackToken) break;
    if (!moveNextInternal()) {
      if (settings.repeatMode) {
        currentOrderIndex = 0;
        saveCurrentPosition();
      } else {
        stopPlayback();
        break;
      }
    }
  }
}

function stopPlayback(resetPause=true) {
  isPlaying = false;
  if (resetPause) isPaused = false;
  playbackToken += 1;
  clearTimers();
  speechSynthesis.cancel();
  stopCurrentAudio();
  updatePhase(resetPause ? '停止中' : '切替中');
}
function pausePlayback() {
  isPlaying = false; isPaused = true;
  playbackToken += 1;
  clearTimers();
  speechSynthesis.cancel();
  stopCurrentAudio();
  updatePhase('一時停止');
}

function moveNextInternal() { if (currentOrderIndex < displayOrder.length - 1) { currentOrderIndex++; saveCurrentPosition(); return true; } return false; }
function movePrevInternal() { if (currentOrderIndex > 0) { currentOrderIndex--; saveCurrentPosition(); return true; } return false; }

async function saveImportedDataset(csvFile, audioFiles) {
  const text = await csvFile.text();
  const parsed = csvToProblems(text);
  if (!parsed.length) { alert(`「${csvFile.name}」を読み込めませんでした。1行目に jp,en,ex,jpAudio,enAudio があるか確認してください。`); return; }
  const datasetId = 'ds_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const audioKeys = [];
  for (const file of audioFiles) {
    const key = `${datasetId}::${normalizeFileName(file.name)}`;
    await putAudioBlob(key, file);
    audioKeys.push(key);
  }
  await putDataset({ id: datasetId, name: csvFile.name.replace(/\.csv$/i,''), problems: parsed, audioKeys, createdAt: new Date().toISOString() });
  localStorage.removeItem(getMemoryKey(datasetId));
  await setActiveDataset(datasetId);
}
async function importFiles(files) {
  const csvFiles = files.filter(f=>f.name.toLowerCase().endsWith('.csv'));
  const audioFiles = files.filter(f=>!f.name.toLowerCase().endsWith('.csv'));
  if (!csvFiles.length) { alert('CSVファイルを含めてください。'); return; }
  for (const csvFile of csvFiles) await saveImportedDataset(csvFile, audioFiles);
  await renderDatasetButtons(); await renderDatasetManager(); renderCurrentProblem(); renderList();
}
async function loadSampleDataset() {
  const existing = await getDataset(SAMPLE_DATASET_ID); if (existing) return;
  const res = await fetch(SAMPLE_CSV_URL); const text = await res.text(); const parsed = csvToProblems(text);
  await putDataset({ id:SAMPLE_DATASET_ID, name:'内蔵サンプル', problems: parsed, audioKeys: [], createdAt: new Date().toISOString() });
}

function bindEvents() {
  els.tabPractice.addEventListener('click', ()=>switchTab('practice'));
  els.tabList.addEventListener('click', ()=>switchTab('list'));
  els.tabSettings.addEventListener('click', ()=>switchTab('settings'));

  els.playBtn.addEventListener('click', async ()=>{ readSettingsFromForm(); await playSequence(); });
  els.pauseBtn.addEventListener('click', ()=>pausePlayback());

  els.prevBtn.addEventListener('click', async ()=>{
    const wasPlaying = isPlaying;
    stopPlayback(false); isPaused = false;
    movePrevInternal(); renderCurrentProblem();
    if (wasPlaying) await playSequence();
  });

  els.nextBtn.addEventListener('click', async ()=>{
    const wasPlaying = isPlaying;
    stopPlayback(false); isPaused = false;
    moveNextInternal(); renderCurrentProblem();
    await playSequence();
  });

  els.retryBtn.addEventListener('click', async ()=>{
    stopPlayback(false); isPaused = false; renderCurrentProblem(); await playSequence();
  });

  els.replayJpBtn.addEventListener('click', async ()=>{ await replayJapaneseOnly(); });

  els.toggleAnswerBtn.addEventListener('click', ()=>{ revealed = !revealed; renderEnglish(); });
  els.searchInput.addEventListener('input', e=>renderList(e.target.value));
  els.clearSearchBtn.addEventListener('click', ()=>{ els.searchInput.value=''; renderList(); });

  els.problemSlider.addEventListener('input', e=>{ const n=Number(e.target.value)||1; els.sliderLabel.textContent = `問題 ${n} に移動`; });
  els.problemSlider.addEventListener('change', async e=>{
    const n = Number(e.target.value)||1;
    const target = Math.max(0, Math.min(displayOrder.length-1, n-1));
    const wasPlaying = isPlaying;
    stopPlayback(false); isPaused = false;
    currentOrderIndex = target; saveCurrentPosition(); renderCurrentProblem();
    if (wasPlaying) await playSequence();
  });

  els.problemList.addEventListener('click', async e=>{
    const jump = e.target.getAttribute('data-jump');
    const status = e.target.getAttribute('data-status');
    if (jump !== null) {
      stopPlayback(false); isPaused = false;
      const idx = Number(jump); const pos = displayOrder.indexOf(idx);
      currentOrderIndex = pos >= 0 ? pos : 0; saveCurrentPosition(); renderCurrentProblem(); switchTab('practice');
    }
    if (status && currentDataset) {
      const [idx, value] = status.split(':');
      problems[Number(idx)].status = value;
      currentDataset.problems = problems;
      await putDataset(currentDataset);
      renderList(els.searchInput.value);
    }
  });

  els.datasetFileInput.addEventListener('change', async e=>{
    const files = Array.from(e.target.files || []);
    await importFiles(files);
    els.datasetFileInput.value = '';
  });

  els.loadSampleBtn.addEventListener('click', async ()=>{ await setActiveDataset(SAMPLE_DATASET_ID); switchTab('practice'); });

  els.saveSettingsBtn.addEventListener('click', ()=>{ readSettingsFromForm(); alert('設定を保存しました。'); });
  els.resetSettingsBtn.addEventListener('click', ()=>{ settings = { ...DEFAULT_SETTINGS }; saveSettings(); applySettingsToForm(); buildDisplayOrder(); renderCurrentProblem(); alert('初期値に戻しました。'); });

  els.datasetManager.addEventListener('click', async e=>{
    const activate = e.target.getAttribute('data-activate');
    const del = e.target.getAttribute('data-delete');
    if (activate) { await setActiveDataset(activate); switchTab('practice'); }
    if (del) { await deleteDataset(del); }
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}

async function init() {
  db = await openDb();
  applySettingsToForm();
  bindEvents();
  await loadSampleDataset();
  const active = await getDataset(activeDatasetId);
  if (!active) { activeDatasetId = SAMPLE_DATASET_ID; saveActiveDatasetId(); }
  await setActiveDataset(activeDatasetId);
  speechSynthesis.getVoices();
}
init();
