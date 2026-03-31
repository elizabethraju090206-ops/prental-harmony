/* =================================================================
   script.js — Aarogya Sathi · Maternal Health App
   Handles: multi-screen nav, registration, voice input, symptom
   selection, AI prediction, offline mode, chat, TTS, translations.
================================================================= */

const API = '';  // Same origin (FastAPI backend)

// ── App State ───────────────────────────────────────────────────
let currentPatientId = null;
let currentLanguage = 'en';
let currentTrimester = null;
let pregnancyWeekNum = null;
let lastAdviceText = '';
let isRecording = false;
let selectedSymptoms = new Set();
let selectedDuration = 1;
let chatVoiceMode = false;

// ── Screen Navigation ───────────────────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('block', 'flex', 'active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('block');
    window.scrollTo(0, 0);
  }
}

function loginAs(role) {
  if (role === 'patient') {
    goTo('screen-patient');
  } else if (role === 'asha') {
    goTo('screen-asha');
  } else if (role === 'doctor') {
    window.location.href = `${API}/doctor-portal`;
  }
}

// ── Patient Intake Flow ─────────────────────────────────────────
let selectedSymptomsList = new Set();
let patientHealthCat = 'pregnancy'; // default
let voiceRecognition = null;

function goPatientStep(step) {
  // Save profile data when moving forward from step 1
  if (step >= 2) {
    const name = document.getElementById('patient-name')?.value.trim();
    if (name) {
      document.getElementById('symptom-step-name').textContent = name;
      document.getElementById('dashboard-patient-name').textContent = name;
    }
    // Update dashboard badge
    const weekNum = parseInt(document.getElementById('pregnancy-week')?.value || 20);
    const badge = document.getElementById('dashboard-badge');
    if (badge) {
      if (patientHealthCat === 'pregnancy') {
        badge.textContent = `Week ${weekNum} · ${getTrimester(weekNum)}`;
        badge.classList.remove('hidden');
      } else {
        badge.textContent = 'General Health';
      }
    }
    // Show correct symptom list
    document.getElementById('maternal-symptoms').classList.toggle('hidden', patientHealthCat !== 'pregnancy');
    document.getElementById('general-symptoms').classList.toggle('hidden', patientHealthCat !== 'general');
  }

  // Navigate between steps
  document.querySelectorAll('.patient-step').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`patient-step-${step}`);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo(0, 0);
  }
}

function selectHealthCat(cat) {
  patientHealthCat = cat;
  // Visual feedback
  document.querySelectorAll('.health-cat-btn').forEach(btn => {
    btn.classList.remove('border-primary', 'border-secondary', 'bg-primary', 'bg-secondary', 'text-white');
    btn.classList.add('border-transparent');
  });
  const btn = document.getElementById(`cat-${cat}`);
  if (btn) {
    btn.classList.remove('border-transparent');
    btn.classList.add(cat === 'pregnancy' ? 'border-primary' : 'border-secondary');
  }
  // Show/hide pregnancy week slider
  const weekSection = document.getElementById('pregnancy-week-section');
  if (weekSection) weekSection.classList.toggle('hidden', cat !== 'pregnancy');
}

function getTrimester(week) {
  if (week <= 13) return '1st Trimester';
  if (week <= 26) return '2nd Trimester';
  return '3rd Trimester';
}

function updateWeekDisplay(val) {
  const w = parseInt(val);
  const display = document.getElementById('week-display');
  const badge = document.getElementById('trimester-badge');
  if (display) display.textContent = w;
  if (badge) badge.textContent = getTrimester(w);
}

// ── Voice Fill for Profile Fields (Web Speech API) ──────────────
function startVoiceFill(fieldId) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Voice input not supported in this browser. Please type instead.');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'hi-IN'; // Hindi default, can be switched
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  // UI: show recording state on the button
  const icon = document.getElementById(`icon-voice-${fieldId.replace('patient-', '').replace('pregnancy-', '')}`);
  if (icon) { icon.textContent = 'stop_circle'; icon.style.color = '#ba1a1a'; }

  rec.onresult = (e) => {
    let transcript = e.results[0][0].transcript;
    const el = document.getElementById(fieldId);
    if (!el) return;
    // For number fields, extract digits
    if (el.type === 'number' || el.type === 'range') {
      const num = transcript.match(/\d+/);
      if (num) {
        el.value = num[0];
        if (fieldId === 'pregnancy-week') updateWeekDisplay(num[0]);
      }
    } else {
      el.value = transcript;
    }
    if (icon) { icon.textContent = 'mic'; icon.style.color = ''; }
  };
  rec.onerror = () => {
    if (icon) { icon.textContent = 'mic'; icon.style.color = ''; }
  };
  rec.onend = () => {
    if (icon) { icon.textContent = 'mic'; icon.style.color = ''; }
  };
  rec.start();
}

// ── Symptom Chips ───────────────────────────────────────────────
function toggleSymptom(btn, label) {
  if (selectedSymptomsList.has(label)) {
    selectedSymptomsList.delete(label);
    btn.classList.remove('bg-primary', 'bg-secondary', 'bg-error', 'text-white');
    btn.classList.add('bg-primary/5', 'text-on-surface');
  } else {
    selectedSymptomsList.add(label);
    // detect button color class to set active
    if (btn.classList.contains('text-error')) {
      btn.classList.add('bg-error', 'text-white');
    } else if (btn.classList.contains('text-tertiary')) {
      btn.classList.add('bg-tertiary', 'text-white');
    } else {
      btn.classList.add('bg-primary', 'text-white');
    }
    btn.classList.remove('text-error', 'text-tertiary', 'text-on-surface', 'bg-primary/5', 'bg-secondary/5', 'bg-error/5', 'bg-tertiary/5');
  }
  updateSelectedSymptomsDisplay();
}

function updateSelectedSymptomsDisplay() {
  const display = document.getElementById('selected-symptoms-display');
  const chipsContainer = document.getElementById('selected-chips');
  if (!display || !chipsContainer) return;
  if (selectedSymptomsList.size === 0) {
    display.classList.add('hidden');
    return;
  }
  display.classList.remove('hidden');
  chipsContainer.innerHTML = '';
  selectedSymptomsList.forEach(sym => {
    const chip = document.createElement('span');
    chip.className = 'px-3 py-1 bg-primary text-white text-xs font-bold rounded-full flex items-center gap-1';
    chip.innerHTML = `${sym} <button onclick="removeSymptom('${sym}')" class="ml-1 text-white/70 hover:text-white">×</button>`;
    chipsContainer.appendChild(chip);
  });
}

function removeSymptom(label) {
  selectedSymptomsList.delete(label);
  // Deselect the chip button
  document.querySelectorAll('.symptom-chip').forEach(btn => {
    if (btn.textContent.trim().includes(label.replace(/[^a-zA-Z ]/g, '').trim()) || btn.getAttribute('onclick')?.includes(`'${label}'`)) {
      btn.classList.remove('bg-primary', 'bg-secondary', 'bg-error', 'bg-tertiary', 'text-white');
    }
  });
  updateSelectedSymptomsDisplay();
}

function selectDuration(btn) {
  document.querySelectorAll('.duration-btn').forEach(b => {
    b.classList.remove('bg-primary', 'text-white');
    b.classList.add('bg-surface-container', 'text-on-surface-variant');
  });
  btn.classList.add('bg-primary', 'text-white');
  btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
}

// ── Voice Symptom Input ─────────────────────────────────────────
let symptomRecording = false;
function startSymptomVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Voice input not supported. Please type your symptoms.');
    return;
  }
  if (symptomRecording) {
    if (voiceRecognition) voiceRecognition.stop();
    symptomRecording = false;
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecognition = new SR();
  voiceRecognition.lang = 'hi-IN';
  voiceRecognition.interimResults = true;
  voiceRecognition.maxAlternatives = 1;
  symptomRecording = true;

  const statusEl = document.getElementById('voice-status');
  const statusText = document.getElementById('voice-status-text');
  const micIcon = document.getElementById('symptom-mic-icon');
  if (statusEl) statusEl.classList.remove('hidden');
  if (micIcon) micIcon.textContent = 'stop';

  voiceRecognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const ta = document.getElementById('symptom-text');
    if (ta) ta.value = final || interim;
    if (statusText) statusText.textContent = interim ? `"${interim}"` : 'Listening...';
  };

  voiceRecognition.onend = () => {
    symptomRecording = false;
    if (statusEl) statusEl.classList.add('hidden');
    if (micIcon) micIcon.textContent = 'mic';
  };

  voiceRecognition.onerror = () => {
    symptomRecording = false;
    if (statusEl) statusEl.classList.add('hidden');
    if (micIcon) micIcon.textContent = 'mic';
  };

  voiceRecognition.start();
}

// ── Emergency Trigger (Patient) ──────────────────────────────────
function triggerEmergency() {
  const name = document.getElementById('dashboard-patient-name')?.textContent || 'Patient';
  alert(`🚨 Emergency Alert sent for ${name}!\n\nYour ASHA worker and local emergency contacts have been alerted. Stay calm — help is on the way.`);
}

// ── AI Health Advice Engine (Transformers.js inline module) ────
function getHealthAdvice() {
  const symptomText = document.getElementById('symptom-text')?.value.trim() || '';
  const selectedChips = Array.from(selectedSymptomsList);

  if (selectedChips.length === 0 && !symptomText) {
    alert('Please select or speak at least one symptom.');
    return;
  }

  // Show loading screen
  goPatientStep(4);
  document.getElementById('ai-loading-state').classList.remove('hidden');
  document.getElementById('ai-result-state').classList.add('hidden');

  const titleEl = document.getElementById('ai-loading-title');
  const subEl = document.getElementById('ai-loading-subtitle');
  const progContainer = document.getElementById('ai-progress-container');
  const progBar = document.getElementById('ai-progress-bar');
  const progFile = document.getElementById('ai-progress-file');
  const progPct = document.getElementById('ai-progress-pct');

  titleEl.textContent = 'Initializing Guardian AI...';
  subEl.textContent = 'Preparing the offline medical engine.';
  progContainer.classList.add('hidden');

  const textInput = `Patient reports the following symptoms: ${selectedChips.join(', ')}. Additional notes: ${symptomText}`;
  const candidateLabels = ['medical emergency', 'monitor symptoms at home', 'normal pregnancy symptoms'];

  // Progress handler for model download
  function onProgress(x) {
    if (x.status === 'initiate') {
      progContainer.classList.remove('hidden');
      titleEl.textContent = 'Downloading AI Models...';
      subEl.textContent = 'First-time setup only. Please wait.';
    } else if (x.status === 'progress' && x.total) {
      const pct = Math.round((x.loaded / x.total) * 100);
      if (progFile) progFile.textContent = (x.file || '').split('/').pop();
      if (progPct) progPct.textContent = `${pct}%`;
      if (progBar) progBar.style.width = `${pct}%`;
    } else if (x.status === 'ready') {
      progContainer.classList.add('hidden');
      titleEl.textContent = 'Analyzing Symptoms...';
      subEl.textContent = 'Guardian AI is reviewing your inputs...';
    }
  }

  // Check if Transformers.js module is loaded
  if (typeof window.runAIClassification !== 'function') {
    // Not yet loaded (module scripts load async); retry in 1s
    titleEl.textContent = 'Loading AI Engine...';
    setTimeout(() => getHealthAdvice(), 1000);
    return;
  }

  window.runAIClassification(textInput, candidateLabels, onProgress)
    .then(result => renderAIResult(result))
    .catch(err => {
      console.error('AI Error:', err);
      // Fallback to rule-based engine on error
      renderAIResult(ruleBasedFallback(selectedChips, symptomText));
    });
}

// ── Rule-based fallback (if ML fails) ───────────────────────────
function ruleBasedFallback(chips, text) {
  const HIGH_RISK = ['Bleeding', 'Chest pain', 'Baby not moving', 'Blurred vision', 'Seizure', 'Unconscious'];
  const MODERATE  = ['Fever', 'Headache', 'Nausea / Vomiting', 'Swelling', 'Breathlessness'];
  const allText = [...chips, text].join(' ').toLowerCase();
  const isHigh = chips.some(c => HIGH_RISK.includes(c)) || HIGH_RISK.some(k => allText.includes(k.toLowerCase()));
  const isMod  = chips.some(c => MODERATE.includes(c)) || MODERATE.some(k => allText.includes(k.toLowerCase()));
  if (isHigh) return { labels: ['medical emergency', 'monitor symptoms at home', 'normal pregnancy symptoms'], scores: [0.90, 0.07, 0.03] };
  if (isMod)  return { labels: ['monitor symptoms at home', 'normal pregnancy symptoms', 'medical emergency'], scores: [0.80, 0.15, 0.05] };
  return { labels: ['normal pregnancy symptoms', 'monitor symptoms at home', 'medical emergency'], scores: [0.85, 0.12, 0.03] };
}

// ── Chat Panel ──────────────────────────────────────────────────
let chatOpen = false;
let chatVoiceRec = null;

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  chatOpen = !chatOpen;
  if (chatOpen) {
    panel.classList.remove('hidden');
    panel.style.animation = 'none';
    setTimeout(() => document.getElementById('chat-input')?.focus(), 100);
  } else {
    panel.classList.add('hidden');
  }
}

function addChatMessage(text, sender) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;

  const isAI = sender === 'ai';
  const div = document.createElement('div');
  div.className = `flex gap-2 items-end ${isAI ? '' : 'flex-row-reverse'}`;

  const bubble = document.createElement('div');
  bubble.className = isAI
    ? 'bg-primary-container/40 text-on-surface rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs text-sm leading-relaxed'
    : 'bg-primary text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-xs text-sm leading-relaxed';
  bubble.textContent = text;

  if (isAI) {
    const avatar = document.createElement('div');
    avatar.className = 'w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 self-start mt-1';
    avatar.innerHTML = '<span class="material-symbols-outlined text-white text-sm">robot_2</span>';
    div.appendChild(avatar);

    // Wrap bubble + speaker button in column
    const col = document.createElement('div');
    col.className = 'flex flex-col gap-1';
    col.appendChild(bubble);

    // Speaker button
    const speakerBtn = document.createElement('button');
    speakerBtn.className = 'self-start flex items-center gap-1 text-xs text-primary/60 hover:text-primary transition-colors px-1';
    speakerBtn.innerHTML = '<span class="material-symbols-outlined text-base">volume_up</span> Speak';
    speakerBtn.onclick = () => speakAIResponse(text);
    col.appendChild(speakerBtn);

    div.appendChild(col);
  } else {
    div.appendChild(bubble);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}


function showTypingIndicator() {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.id = 'chat-typing';
  div.className = 'flex gap-2 items-end';
  div.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
      <span class="material-symbols-outlined text-white text-sm">robot_2</span>
    </div>
    <div class="bg-primary-container/40 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
      <div class="w-2 h-2 bg-primary rounded-full voice-bar-anim" style="animation-delay:0s"></div>
      <div class="w-2 h-2 bg-primary rounded-full voice-bar-anim" style="animation-delay:0.15s"></div>
      <div class="w-2 h-2 bg-primary rounded-full voice-bar-anim" style="animation-delay:0.3s"></div>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('chat-typing')?.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  addChatMessage(text, 'user');
  input.value = '';
  input.disabled = true;

  const statusEl = document.getElementById('chat-status');
  if (statusEl) statusEl.textContent = 'Thinking... 🤔';
  showTypingIndicator();

  let reply;
  try {
    if (typeof window.runChatAI === 'function') {
      // Show download progress in chat status if model needs downloading
      reply = await window.runChatAI(text, (x) => {
        if (!statusEl) return;
        if (x.status === 'initiate') {
          statusEl.textContent = 'Loading AI model (first time)...';
        } else if (x.status === 'progress' && x.total) {
          const pct = Math.round((x.loaded / x.total) * 100);
          statusEl.textContent = `Downloading AI: ${pct}%...`;
        } else if (x.status === 'ready') {
          statusEl.textContent = 'Thinking... 🤔';
        }
      });
    } else {
      reply = keywordChatReply(text);
    }
  } catch(err) {
    console.warn('Chat AI error, using keyword fallback:', err);
    reply = keywordChatReply(text);
  }

  input.disabled = false;
  removeTypingIndicator();
  addChatMessage(reply, 'ai');
  speakAIResponse(reply);
  if (statusEl) statusEl.textContent = 'Ready to help 🌿';
}

// ── Text-to-Speech: AI speaks its reply ────────────────────────
let lastAIReply = '';
function speakAIResponse(text) {
  lastAIReply = text;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // stop any previous speech
  const clean = text.replace(/[⚠️🌡️✅💊🥗💧🏥📅😴🚶👶🤢🩺💬🌿🤔]/g, '');
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = currentLanguage || 'en-IN';
  utter.rate = 0.92;
  utter.pitch = 1.05;

  // Prefer an Indian English female voice if available
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(v => v.lang.startsWith('en-IN') && v.name.toLowerCase().includes('female'))
    || voices.find(v => v.lang.startsWith('en-IN'))
    || voices.find(v => v.lang.startsWith('hi'))
    || voices[0];
  if (pref) utter.voice = pref;

  window.speechSynthesis.speak(utter);
}

// ── Keyword-based fallback chat engine ─────────────────────────
function keywordChatReply(text) {
  const t = text.toLowerCase();

  if (/bleed|खून|రక్తం|ரத்தம்/.test(t))
    return '⚠️ Bleeding during pregnancy can be serious. Please contact your ASHA worker or go to a health centre immediately.';
  if (/pain|दर्द|నొప్పి|வலி|ache|cramp/.test(t))
    return '🩺 Pain during pregnancy needs attention. Can you describe where the pain is and how severe? If it is severe or in the abdomen, please see a doctor.';
  if (/kick|movement|moving|baby/.test(t))
    return '👶 If your baby is moving less than usual, please contact your ASHA worker or doctor today. Baby movements are an important sign of wellbeing.';
  if (/vomit|nausea|sick|morning|उल्टी/.test(t))
    return '🤢 Nausea and vomiting are common, especially in the first trimester. Eat small meals more frequently. If you cannot keep any food down, please consult a doctor.';
  if (/fever|temperature|बुखार/.test(t))
    return '🌡️ A fever during pregnancy should be taken seriously. Rest, drink fluids, and if it is above 38°C or persistent, please see a doctor.';
  if (/headache|सिरदर्द|head|dizziness|dizzy/.test(t))
    return '💊 Headaches are common in pregnancy. Rest in a dark room and drink water. If headaches are severe or you see flashing lights, contact your doctor right away.';
  if (/diet|food|eat|खाना|nutrition/.test(t))
    return '🥗 Eat iron-rich foods like spinach and lentils, calcium from milk and curd, protein from eggs and dal, and plenty of fruits and vegetables. Take your iron and folic acid tablets every day!';
  if (/tablet|medicine|iron|folic/.test(t))
    return '💊 Take your Iron and Folic Acid tablets daily with water. Do not take them with tea or milk. They are very important for your baby\'s growth.';
  if (/water|hydration|पानी/.test(t))
    return '💧 Drink 8 to 10 glasses of water every day. Staying hydrated prevents UTIs, constipation, and swelling.';
  if (/delivery|birth|labor|labour|जन्म/.test(t))
    return '🏥 Prepare for delivery by knowing your nearest health centre, having transport ready, and keeping emergency contacts saved. Your ASHA worker can help you plan.';
  if (/week|trimester|month|महीना/.test(t))
    return '📅 Pregnancy has three trimesters: weeks 1 to 13, weeks 14 to 26, and weeks 27 to 40. Regular checkups are very important throughout your pregnancy.';
  if (/sleep|rest|सोना/.test(t))
    return '😴 Sleep on your left side during pregnancy to improve blood flow to your baby. Use a pillow between your knees for comfort and aim for at least 8 hours of rest.';
  if (/exercise|walk|योग|yoga/.test(t))
    return '🚶 Light walking for 20 to 30 minutes every day is safe and very good for you during pregnancy. Avoid heavy lifting and activities that could cause a fall.';

  return '💬 I am here to help you. Please ask me about your symptoms, what to eat, how to sleep, when to see a doctor, or anything else about your pregnancy. I am always listening.';
}


function startChatVoice() {
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    alert('Voice input not supported in this browser.');
    return;
  }
  if (chatVoiceRec) { chatVoiceRec.stop(); chatVoiceRec = null; return; }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  chatVoiceRec = new SR();
  chatVoiceRec.lang = currentLanguage || 'hi-IN';
  chatVoiceRec.interimResults = false;
  chatVoiceRec.maxAlternatives = 1;

  const micIcon = document.getElementById('chat-mic-icon');
  if (micIcon) { micIcon.textContent = 'stop'; micIcon.style.color = '#ba1a1a'; }

  chatVoiceRec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById('chat-input');
    if (input) { input.value = transcript; sendChatMessage(); }
  };
  chatVoiceRec.onend = () => {
    chatVoiceRec = null;
    if (micIcon) { micIcon.textContent = 'mic'; micIcon.style.color = ''; }
  };
  chatVoiceRec.start();
}

function renderAIResult(mlResult) {
  document.getElementById('ai-loading-state').classList.add('hidden');
  document.getElementById('ai-result-state').classList.remove('hidden');
  
  const bannerTitle = document.getElementById('ai-banner-title');
  const bannerDesc = document.getElementById('ai-banner-desc');
  const bannerIcon = document.getElementById('ai-banner-icon');
  const banner = document.getElementById('ai-banner');
  const adviceList = document.getElementById('ai-advice-list');
  const urgentAction = document.getElementById('ai-urgent-action');
  
  // Dashboard Status Refs
  const riskGreen = document.getElementById('risk-bar-green');
  const riskYellow = document.getElementById('risk-bar-yellow');
  const riskRed = document.getElementById('risk-bar-red');
  const riskStatusText = document.getElementById('health-status-text');
  const riskStatusIcon = document.getElementById('health-status-icon');

  // Reset classes
  banner.className = 'rounded-2xl p-5 mb-6 flex items-start gap-4';
  urgentAction.classList.add('hidden');
  adviceList.innerHTML = '';

  // Get highest probability label from ML Model
  const topLabel = mlResult.labels[0];
  const topScore = mlResult.scores[0];

  // Map ML output to UI
  if (topLabel === 'medical emergency') {
      banner.classList.add('bg-error/10', 'text-error');
      bannerTitle.textContent = `High Risk Detected (${Math.round(topScore*100)}% Match)`;
      bannerDesc.textContent = 'Your symptoms require immediate medical attention.';
      bannerIcon.textContent = 'warning';
      urgentAction.classList.remove('hidden');
      adviceList.innerHTML = `
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Rest immediately and do not walk too much.</li>
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Call your ASHA worker urgently.</li>
      `;
      riskGreen.style.width = '0%'; riskYellow.style.width = '0%'; riskRed.style.width = '100%';
      if(riskStatusText) { riskStatusText.textContent = 'Critical'; riskStatusText.className = 'font-bold text-error'; }
      if(riskStatusIcon) { riskStatusIcon.className = 'material-symbols-outlined text-error !text-2xl icon-fill'; riskStatusIcon.textContent = 'error'; }

  } else if (topLabel === 'monitor symptoms at home') {
      banner.classList.add('bg-tertiary/10', 'text-tertiary');
      bannerTitle.textContent = `Monitoring Required (${Math.round(topScore*100)}% Match)`;
      bannerDesc.textContent = 'Please follow these home care steps and monitor your condition.';
      bannerIcon.textContent = 'thermostat';
      adviceList.innerHTML = `
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Drink plenty of fluids.</li>
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Rest and observe symptoms for 24 hours.</li>
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ If symptoms worsen or persist, contact the clinic.</li>
      `;
      riskGreen.style.width = '0%'; riskYellow.style.width = '50%'; riskRed.style.width = '25%';
      if(riskStatusText) { riskStatusText.textContent = 'Monitor'; riskStatusText.className = 'font-bold text-tertiary'; }
      if(riskStatusIcon) { riskStatusIcon.className = 'material-symbols-outlined text-tertiary !text-2xl icon-fill'; riskStatusIcon.textContent = 'thermostat'; }

  } else {
      banner.classList.add('bg-primary/10', 'text-primary');
      bannerTitle.textContent = `Stable & Healthy (${Math.round(topScore*100)}% Match)`;
      bannerDesc.textContent = 'Your symptoms are common and manageable.';
      bannerIcon.textContent = 'check_circle';
      adviceList.innerHTML = `
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Ensure you are getting at least 8 hours of sleep.</li>
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Continue your daily Iron and Folic Acid tablets.</li>
        <li class="flex gap-2 text-sm text-on-surface-variant font-medium">✅ Avoid lifting heavy weights.</li>
      `;
      riskRed.style.width = '25%'; riskYellow.style.width = '25%'; riskGreen.style.width = '50%';
      if(riskStatusText) { riskStatusText.textContent = 'Healthy'; riskStatusText.className = 'font-bold text-primary'; }
      if(riskStatusIcon) { riskStatusIcon.className = 'material-symbols-outlined text-primary !text-2xl icon-fill'; riskStatusIcon.textContent = 'check_circle'; }
  }
}

// ── Offline Detection ───────────────────────────────────────────
function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = navigator.onLine ? 'none' : 'flex';
}
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
updateOfflineBanner();

// ── Language Selection ──────────────────────────────────────────

function setLanguage(code, name) {
  const shortCode = code.split('-')[0];
  currentLanguage = code;

  // Update status label
  const statusText = document.getElementById('lang-status-text');
  if (statusText) statusText.innerHTML = `Speaking in: <strong>${name}</strong>`;

  // Fix: use remove() + add() instead of classList.replace() which fails if the class isn't present
  document.querySelectorAll('.lang-btn').forEach(btn => {
    // Always reset to inactive state first
    btn.classList.remove('bg-primary', 'text-white', 'border-primary');
    btn.classList.add('bg-surface-container', 'text-on-surface', 'border-transparent');

    // Then apply active state to the selected one
    if (btn.dataset.lang === code) {
      btn.classList.remove('bg-surface-container', 'text-on-surface', 'border-transparent');
      btn.classList.add('bg-primary', 'text-white', 'border-primary');
    }
  });

  // Update voice recognition language
  if (typeof voiceRecognition !== 'undefined' && voiceRecognition) {
    voiceRecognition.lang = code;
  }

  // Trigger Google Translate widget
  const select = document.querySelector('select.goog-te-combo');
  if (select) {
    select.value = shortCode;
    select.dispatchEvent(new Event('change'));
  }
}


const UI_TRANSLATIONS = {
  en: {
    appTitle: 'Aarogya Sathi',
    appSubtitle: 'Your Health Companion',
    greeting: 'How are you feeling today?',
    greetingSub: 'Good morning 🌿',
    week: 'Pregnancy Week',
    trackerHint: 'Complete your profile to track progress',
    registerSec: '👤 Tell us about you',
    name: 'Your Name', age: 'Your Age',
    trimester: 'Month of Pregnancy',
    btnRegister: 'Start My Journey',
    speakCard: 'Speak Symptoms', healthCard: 'Check Health',
    emergCard: 'Emergency Help', doctorCard: 'Call Doctor',
    voiceTitle: '🎤 Speak Now', voiceHint: 'Tap the button below and speak what you feel',
    sympTitle: '🩺 How are you feeling?', sympSub: 'Select all symptoms you are having',
    durationLbl: 'How long have you had these symptoms?',
    otherSymp: 'Other symptoms (type or speak)',
    getAdvice: 'Get Help Now →',
    listen: 'Hear this advice',
    emergSubtitle: 'Help is being contacted for you',
    alertAsha: 'Alert Sent to ASHA Worker',
    alertLoc: 'Sharing your location...',
  },
  hi: {
    appTitle: 'आरोग्य साथी', appSubtitle: 'आपका स्वास्थ्य साथी',
    greeting: 'आज आप कैसा महसूस कर रही हैं?', greetingSub: 'शुभ प्रभात 🌿',
    week: 'गर्भावस्था सप्ताह', trackerHint: 'प्रगति जानने के लिए प्रोफ़ाइल पूरी करें',
    registerSec: '👤 हमें अपने बारे में बताएं',
    name: 'आपका नाम', age: 'आपकी उम्र', trimester: 'गर्भावस्था का महीना',
    btnRegister: 'शुरू करें',
    speakCard: 'लक्षण बोलें', healthCard: 'स्वास्थ्य जांच',
    emergCard: 'आपातकाल', doctorCard: 'डॉक्टर से मिलें',
    voiceTitle: '🎤 अभी बोलें', voiceHint: 'नीचे बटन दबाएं और अपना हाल बताएं',
    sympTitle: '🩺 आप कैसा महसूस कर रही हैं?', sympSub: 'जो भी लक्षण हैं उन सब को चुनें',
    durationLbl: 'ये लक्षण कितने समय से हैं?',
    otherSymp: 'अन्य लक्षण (टाइप करें या बोलें)',
    getAdvice: 'अभी मदद पाएं →',
    listen: 'सलाह सुनें',
    emergSubtitle: 'आपके लिए मदद मंगाई जा रही है',
    alertAsha: 'ASHA कार्यकर्ता को अलर्ट भेजा गया',
    alertLoc: 'आपकी लोकेशन शेयर हो रही है...',
  },
  ml: {
    appTitle: 'ആരോഗ്യ സഖി', appSubtitle: 'നിങ്ങളുടെ ആരോഗ്യ സഹായി',
    greeting: 'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെയുണ്ട്?', greetingSub: 'ശുഭ പ്രഭാതം 🌿',
    week: 'ഗർഭകാല ആഴ്ച', trackerHint: 'പ്രതിദിന പ്രോഗ്രസ് ട്രാക്ക് ചെയ്യൂ',
    registerSec: '👤 നിങ്ങളെക്കുറിച്ച് പറയൂ',
    name: 'നിങ്ങളുടെ പേര്', age: 'നിങ്ങളുടെ പ്രായം', trimester: 'ഗർഭകാല മാസം',
    btnRegister: 'തുടരുക',
    speakCard: 'ലക്ഷണം പറയൂ', healthCard: 'ആരോഗ്യ പരിശോധന',
    emergCard: 'അടിയന്തര സഹായം', doctorCard: 'ഡോക്ടർ',
    voiceTitle: '🎤 ഇപ്പോൾ സംസാരിക്കൂ', voiceHint: 'ബട്ടൺ അമർത്തി നിങ്ങൾക്ക് എങ്ങനെ അനുഭവപ്പെടുന്നുവെന്ന് പറയൂ',
    sympTitle: '🩺 നിങ്ങൾക്ക് എങ്ങനെ തോന്നുന്നു?', sympSub: 'ഉള്ള ലക്ഷണങ്ങൾ തിരഞ്ഞെടുക്കൂ',
    durationLbl: 'ഈ ലക്ഷണങ്ങൾ എത്ര സമയമായി?',
    otherSymp: 'മറ്റ് ലക്ഷണങ്ങൾ (ടൈപ്പ് ചെയ്യൂ അല്ലെങ്കിൽ പറയൂ)',
    getAdvice: 'ഇപ്പോൾ സഹായം നേടൂ →',
    listen: 'ഉപദേശം കേൾക്കൂ',
    emergSubtitle: 'നിങ്ങൾക്ക് സഹായം അയക്കുന്നു',
    alertAsha: 'ASHA വർക്കർക്ക് അലർട്ട് അയച്ചു',
    alertLoc: 'ലൊക്കേഷൻ ഷെയർ ചെയ്യുന്നു...',
  },
  ta: {
    appTitle: 'ஆரோக்கிய தோழி', appSubtitle: 'உங்கள் ஆரோக்கிய உதவியாளர்',
    greeting: 'இன்று உங்களுக்கு எப்படி இருக்கிறது?', greetingSub: 'காலை வணக்கம் 🌿',
    week: 'கர்ப்ப வாரம்', trackerHint: 'முன்னேற்றத்தை கண்காணிக்க உங்கள் விவரங்களை நிரப்பவும்',
    registerSec: '👤 உங்களைப் பற்றி சொல்லுங்கள்',
    name: 'உங்கள் பெயர்', age: 'உங்கள் வயது', trimester: 'கர்ப்ப மாதம்',
    btnRegister: 'தொடரவும்',
    speakCard: 'அறிகுறிகள் சொல்லுங்கள்', healthCard: 'உடல் நல பரிசோதனை',
    emergCard: 'அவசர உதவி', doctorCard: 'மருத்துவர்',
    voiceTitle: '🎤 இப்போது பேசுங்கள்', voiceHint: 'கீழே உள்ள பொத்தானை அழுத்தி நீங்கள் உணர்வதை சொல்லுங்கள்',
    sympTitle: '🩺 உங்களுக்கு எப்படி இருக்கிறது?', sympSub: 'உள்ள அறிகுறிகளை தேர்வு செய்யுங்கள்',
    durationLbl: 'இந்த அறிகுறிகள் எவ்வளவு நேரம்?',
    otherSymp: 'மற்ற அறிகுறிகள் (தட்டச்சு அல்லது பேசுங்கள்)',
    getAdvice: 'இப்போது உதவி பெறுங்கள் →',
    listen: 'ஆலோசனை கேளுங்கள்',
    emergSubtitle: 'உங்களுக்கு உதவி அனுப்பப்படுகிறது',
    alertAsha: 'ASHA பணியாளருக்கு எச்சரிக்கை அனுப்பப்பட்டது',
    alertLoc: 'இடம் பகிர்க்கப்படுகிறது...',
  },
};

function setLanguage(lang, btn) {
  currentLanguage = lang;
  document.querySelectorAll('.lang-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS['en'];
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('app-title', t.appTitle);
  set('app-subtitle', t.appSubtitle);
  set('lbl-greeting', t.greeting);
  set('lbl-greeting-sub', t.greetingSub);
  set('lbl-week', t.week);
  set('lbl-tracker-hint', t.trackerHint);
  set('lbl-register-sec', t.registerSec);
  set('lbl-name', t.name);
  set('lbl-age', t.age);
  set('lbl-trimester', t.trimester);
  set('lbl-btn-register', t.btnRegister);
  set('lbl-speak-card', t.speakCard);
  set('lbl-health-card', t.healthCard);
  set('lbl-emerg-card', t.emergCard);
  set('lbl-doctor-card', t.doctorCard);
  set('lbl-voice-title', t.voiceTitle);
  set('lbl-voice-hint', t.voiceHint);
  set('lbl-symptoms-title', t.sympTitle);
  set('lbl-symptoms-sub', t.sympSub);
  set('lbl-duration', t.durationLbl);
  set('lbl-other-symptoms', t.otherSymp);
  set('lbl-get-advice', t.getAdvice);
  set('lbl-listen', t.listen);
  set('lbl-emerg-subtitle', t.emergSubtitle);
  set('lbl-alert-asha', t.alertAsha);
  set('lbl-alert-location', t.alertLoc);
}

// ── Trimester Dropdown Change ──────────────────────────────────
document.getElementById('trimester-select')?.addEventListener('change', function () {
  const weekGroup = document.getElementById('week-input-group');
  if (weekGroup) weekGroup.style.display = (this.value === '4') ? 'block' : 'none';
});

// ── Patient Registration ────────────────────────────────────────
async function registerPatient() {
  const name = document.getElementById('patient-name')?.value.trim();
  const age = document.getElementById('patient-age')?.value;
  const trimesterEl = document.getElementById('trimester-select');
  const weekEl = document.getElementById('pregnancy-week');
  const trimesterVal = trimesterEl?.value;

  if (!name) { showToast('Please enter your name 🙏'); return; }

  currentTrimester = trimesterVal ? parseInt(trimesterVal) : null;

  // Handle week input
  if (trimesterVal === '4' && weekEl?.value) {
    pregnancyWeekNum = parseInt(weekEl.value);
    // Derive trimester from week
    if (pregnancyWeekNum <= 13) currentTrimester = 1;
    else if (pregnancyWeekNum <= 26) currentTrimester = 2;
    else currentTrimester = 3;
  } else if (currentTrimester) {
    // Default week mid-point
    const weekMap = { 1: 8, 2: 20, 3: 32 };
    pregnancyWeekNum = weekMap[currentTrimester] || null;
  }

  // Update pregnancy tracker UI
  updatePregnancyTracker();

  // Offline mode
  if (!navigator.onLine) {
    currentPatientId = -1;
    localStorage.setItem('offline_patient', JSON.stringify({ name, age, language: currentLanguage }));
    showAppScreens();
    return;
  }

  try {
    const res = await fetch(`${API}/patient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age: age ? parseInt(age) : null, language: currentLanguage })
    });
    const data = await res.json();
    currentPatientId = data.patient_id;
  } catch {
    currentPatientId = -1;
    localStorage.setItem('offline_patient', JSON.stringify({ name, age, language: currentLanguage }));
  }
  showAppScreens();
}

function showAppScreens() {
  document.getElementById('section-register').style.display = 'none';
  document.getElementById('action-grid').style.display = 'grid';
  document.getElementById('tip-strip').style.display = 'flex';
  showToast('Welcome! 🤱 Your profile is ready.');
}

function updatePregnancyTracker() {
  const week = pregnancyWeekNum || 0;
  const pct = week > 0 ? Math.min((week / 40) * 100, 100) : 0;
  const bar = document.getElementById('tracker-bar');
  const disp = document.getElementById('tracker-week-display');
  const note = document.getElementById('lbl-tracker-hint');
  if (bar) bar.style.width = `${pct}%`;
  if (disp) disp.textContent = week > 0 ? `Week ${week} of 40` : '—';
  if (note && week > 0) note.textContent = `${40 - week} weeks remaining`;
}

// ── Symptom Selection (Screen 3) ────────────────────────────────
function toggleSymptom(el) {
  const symptom = el.dataset.symptom;
  if (selectedSymptoms.has(symptom)) {
    selectedSymptoms.delete(symptom);
    el.classList.remove('selected');
  } else {
    selectedSymptoms.add(symptom);
    el.classList.add('selected');
  }
}

function selectDuration(el) {
  document.querySelectorAll('.duration-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  selectedDuration = parseInt(el.dataset.duration);
}

// ── Symptom Submission ──────────────────────────────────────────
async function submitSymptoms() {
  const extraText = document.getElementById('symptom-text')?.value.trim() || '';
  const allSymptoms = [...selectedSymptoms, ...(extraText ? [extraText] : [])].join(', ');

  if (!allSymptoms) { showToast('Please select or describe at least one symptom 🩺'); return; }

  const spinner = document.getElementById('symptom-spinner');
  if (spinner) spinner.style.display = 'block';

  let result;
  if (!navigator.onLine || currentPatientId === -1) {
    result = analyzeOffline(allSymptoms);
    saveOfflineConsultation(allSymptoms, result);
  } else {
    try {
      const res = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: currentPatientId, symptoms: allSymptoms, trimester: currentTrimester })
      });
      result = await res.json();
      if (currentLanguage !== 'en') translateAdvice(result.advice);
    } catch {
      result = analyzeOffline(allSymptoms);
      saveOfflineConsultation(allSymptoms, result);
    }
  }

  if (spinner) spinner.style.display = 'none';
  displayResult(result, allSymptoms);
  goTo('screen-result');
}

// ── Display Result ──────────────────────────────────────────────
function displayResult(data, rawSymptoms) {
  const riskCard = document.getElementById('risk-card');
  const riskIcon = document.getElementById('risk-icon');
  const riskLabel = document.getElementById('risk-label');
  const riskSub = document.getElementById('risk-sublabel');
  const adviceList = document.getElementById('advice-list');
  const summPills = document.getElementById('summary-pills');
  const tipCard = document.getElementById('trimester-tip-card');
  const tipText = document.getElementById('trimester-tip-text');

  const riskMap = {
    emergency: { icon: '🚨', label: 'EMERGENCY', sub: 'Go to hospital immediately', cls: 'emergency' },
    high: { icon: '⚠️', label: 'HIGH RISK', sub: 'See a doctor today', cls: 'high' },
    medium: { icon: '⚠️', label: 'MODERATE', sub: 'Monitor your health closely', cls: 'medium' },
    low: { icon: '✅', label: 'SAFE', sub: 'Continue regular checkups', cls: 'safe' },
  };

  const r = riskMap[data.severity] || riskMap.low;
  if (riskCard) riskCard.className = `risk-card ${r.cls}`;
  if (riskIcon) riskIcon.textContent = r.icon;
  if (riskLabel) riskLabel.textContent = r.label;
  if (riskSub) riskSub.textContent = r.sub;

  // Advice list
  const advicePoints = parseAdviceToPoints(data.advice);
  if (adviceList) {
    adviceList.innerHTML = advicePoints.map(p => `<li>${p}</li>`).join('');
  }
  lastAdviceText = data.advice;

  // Symptoms summary
  if (summPills) {
    const symptoms = rawSymptoms ? rawSymptoms.split(',').map(s => s.trim()).filter(Boolean) : [];
    summPills.innerHTML = symptoms.map(s => `<span class="summary-pill">${s}</span>`).join('');
  }

  // Trimester tip
  if (data.trimester_tip && tipCard && tipText) {
    tipText.textContent = data.trimester_tip;
    tipCard.style.display = 'block';
  } else if (tipCard) {
    tipCard.style.display = 'none';
  }

  // Auto open emergency screen
  if (data.severity === 'emergency') {
    setTimeout(() => goTo('screen-emergency'), 600);
  }
}

function parseAdviceToPoints(adviceText) {
  if (!adviceText) return ['Please consult a healthcare professional.'];
  // Split by sentences or bullet points
  const cleaned = adviceText.replace(/^[🚨⚠️📋✅]\s*/, '').trim();
  const points = cleaned.split(/[.!]/).map(s => s.trim()).filter(s => s.length > 5);
  return points.length > 0 ? points : [cleaned];
}

// ── Voice Input (Screen 2 & inline) ────────────────────────────
function startVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice not supported. Please type your symptoms.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  const localeMap = { en: 'en-IN', hi: 'hi-IN', ml: 'ml-IN', ta: 'ta-IN', te: 'te-IN' };
  recognition.lang = localeMap[currentLanguage] || 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const micWrapper = document.querySelector('.mic-wrapper');
  const micStatus = document.getElementById('mic-status');
  const soundWave = document.getElementById('sound-wave');
  const textArea = document.getElementById('symptom-text');

  recognition.onstart = () => {
    isRecording = true;
    if (micWrapper) micWrapper.classList.add('listening');
    if (micStatus) micStatus.textContent = 'Listening… tap to stop';
    if (soundWave) soundWave.style.display = 'flex';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;

    // Show transcript on voice screen
    const tCard = document.getElementById('transcript-card');
    const tText = document.getElementById('transcript-text');
    if (tCard && tText) {
      tText.textContent = transcript;
      tCard.style.display = 'block';
    }

    // Also fill symptom text area
    if (textArea) textArea.value = textArea.value ? `${textArea.value}, ${transcript}` : transcript;

    // Show submit button on voice screen
    const submitBtn = document.getElementById('btn-voice-submit');
    if (submitBtn) submitBtn.style.display = 'flex';
  };

  recognition.onerror = (e) => {
    console.error('Speech error:', e.error);
    showToast('Could not hear you. Please try again or type.');
  };

  recognition.onend = () => {
    isRecording = false;
    if (micWrapper) micWrapper.classList.remove('listening');
    if (micStatus) micStatus.textContent = 'Tap to speak again';
    if (soundWave) soundWave.style.display = 'none';
  };

  recognition.start();
}

function submitFromVoice() {
  const transcript = document.getElementById('transcript-text')?.textContent;
  if (!transcript) { showToast('Please speak first 🎤'); return; }
  document.getElementById('symptom-text').value = transcript;
  submitVoiceToAI(transcript);
}

async function submitVoiceToAI(symptoms) {
  const spinner = document.getElementById('voice-spinner');
  if (spinner) spinner.style.display = 'block';

  let result;
  if (!navigator.onLine || currentPatientId === -1) {
    result = analyzeOffline(symptoms);
  } else {
    try {
      const res = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: currentPatientId, symptoms, trimester: currentTrimester })
      });
      result = await res.json();
    } catch {
      result = analyzeOffline(symptoms);
    }
  }

  if (spinner) spinner.style.display = 'none';

  const respCard = document.getElementById('ai-response-card');
  const respText = document.getElementById('ai-response-text');
  const riskBadge = document.getElementById('voice-risk-badge');

  if (respCard && respText) {
    respText.textContent = result.advice;
    lastAdviceText = result.advice;
    const badgeMap = { emergency: 'Emergency', high: 'High Risk', medium: 'Check-up', low: 'Safe' };
    if (riskBadge) {
      riskBadge.textContent = badgeMap[result.severity] || '';
      riskBadge.className = `risk-badge ${result.severity === 'low' ? 'safe' : result.severity}`;
    }
    respCard.style.display = 'block';
  }

  if (result.severity === 'emergency') setTimeout(() => goTo('screen-emergency'), 800);
}

function clearTranscript() {
  const tCard = document.getElementById('transcript-card');
  const tText = document.getElementById('transcript-text');
  const resp = document.getElementById('ai-response-card');
  const btn = document.getElementById('btn-voice-submit');
  if (tCard) tCard.style.display = 'none';
  if (tText) tText.textContent = '';
  if (resp) resp.style.display = 'none';
  if (btn) btn.style.display = 'none';
  document.getElementById('mic-status').textContent = 'Tap to start speaking';
}

// ── Text-to-Speech ──────────────────────────────────────────────
function speakAdvice() {
  if (!lastAdviceText) { showToast('No advice to play yet 🔊'); return; }
  if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return; }
  const utt = new SpeechSynthesisUtterance(lastAdviceText);
  const localeMap = { en: 'en-IN', hi: 'hi-IN', ml: 'ml-IN', ta: 'ta-IN', te: 'te-IN' };
  utt.lang = localeMap[currentLanguage] || 'en-IN';
  utt.rate = 0.85;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

// ── Offline Analysis ────────────────────────────────────────────
function analyzeOffline(text) {
  const t = text.toLowerCase();
  const emergency = ['bleeding', 'heavy bleeding', 'convulsion', 'seizure', 'unconscious', 'not breathing', 'water broke', 'baby not moving', 'severe pain', 'chest pain', 'no movement'];
  const high = ['high fever', 'blurred vision', 'severe headache', 'severe vomiting', 'shortness of breath', 'difficulty breathing', 'swollen face'];
  const medium = ['fever', 'nausea', 'vomiting', 'headache', 'backache', 'fatigue', 'swelling', 'discharge', 'heartburn', 'dizziness', 'back pain'];

  const trimTips = {
    1: 'First trimester: Take folic acid daily and avoid raw food.',
    2: 'Second trimester: Light exercise and iron-rich foods are important.',
    3: 'Third trimester: Watch for baby movements and attend weekly checkups.',
  };

  if (emergency.some(w => t.includes(w)))
    return { severity: 'emergency', advice: 'EMERGENCY! Go to the nearest hospital IMMEDIATELY or call 108. Do not wait.', refer_to_doctor: true, trimester_tip: null };
  if (high.some(w => t.includes(w)))
    return { severity: 'high', advice: 'Your symptoms need urgent medical attention. Please visit a clinic or doctor today without delay.', refer_to_doctor: true, trimester_tip: trimTips[currentTrimester] };
  if (medium.some(w => t.includes(w)))
    return { severity: 'medium', advice: 'These are common pregnancy symptoms. Rest well, drink plenty of water, eat nutritious food. See a doctor if symptoms worsen.', refer_to_doctor: false, trimester_tip: trimTips[currentTrimester] };
  return { severity: 'low', advice: 'Your symptoms appear mild. Continue your regular prenatal care, eat well, and stay hydrated.', refer_to_doctor: false, trimester_tip: trimTips[currentTrimester] };
}

function saveOfflineConsultation(symptoms, result) {
  const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
  queue.push({ symptoms, severity: result.severity, advice: result.advice, timestamp: new Date().toISOString() });
  localStorage.setItem('offline_queue', JSON.stringify(queue));
}

// ── Translation ─────────────────────────────────────────────────
async function translateAdvice(text) {
  try {
    const res = await fetch(`${API}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target_language: currentLanguage })
    });
    const data = await res.json();
    if (data.translated && !data.error) {
      const el = document.getElementById('advice-list');
      if (el) el.innerHTML = `<li>${data.translated}</li>`;
      lastAdviceText = data.translated;
    }
  } catch { /* silent */ }
}

// ── Emergency Screen Init ───────────────────────────────────────
function initEmergency() {
  // Simulate alert sent
  const locCheck = document.getElementById('location-check');
  const locRow = document.getElementById('alert-location-row');
  setTimeout(() => {
    if (locCheck) locCheck.textContent = '✅';
    const lbl = document.getElementById('lbl-alert-location');
    if (lbl) lbl.textContent = 'Location Shared Successfully';
    if (locRow) locRow.classList.remove('sending');
  }, 2000);

  // Try real geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(() => { }, () => { });
  }

  // If online, send emergency ping to server
  if (navigator.onLine && currentPatientId && currentPatientId > 0) {
    fetch(`${API}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: currentPatientId, symptoms: 'emergency help needed', trimester: currentTrimester })
    }).catch(() => { });
  }
}

function sendSMSAlert() {
  // Simulate SMS send
  showToast('📱 SMS alert sent to your family!');
}

function findHospital() {
  window.open('https://maps.google.com/?q=primary+health+centre+near+me', '_blank');
}

// ── Chat Functions (Screen 6) ───────────────────────────────────
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input?.value.trim();
  if (!message) return;
  input.value = '';
  appendChatMessage(message, 'user');
  simulateDoctorReply(message);
}

function sendQuickReply(text) {
  appendChatMessage(text, 'user');
  simulateDoctorReply(text);
}

function appendChatMessage(text, role) {
  const chatMessages = document.getElementById('chat-messages');
  const chatMain = document.getElementById('chat-main');
  if (!chatMessages) return;
  const div = document.createElement('div');
  div.className = `chat-bubble ${role === 'user' ? 'user-bubble' : 'doctor-bubble'}`;
  div.innerHTML = role === 'user'
    ? `<div class="bubble-content">${escapeHtml(text)}</div>`
    : `<div class="bubble-avatar">👩‍⚕️</div><div class="bubble-content">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  if (chatMain) chatMain.scrollTop = chatMain.scrollHeight;
}

function simulateDoctorReply(userMsg) {
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.style.display = 'flex';
  const chatMain = document.getElementById('chat-main');
  if (chatMain) chatMain.scrollTop = chatMain.scrollHeight;

  const replies = [
    'I understand. Please make sure to rest and stay hydrated. 🙏',
    'Thank you for sharing. I am reviewing your symptoms now.',
    'Please visit the clinic if the symptoms persist beyond 24 hours.',
    'Your baby\'s health is our priority. Keep monitoring baby movements.',
    'I will send a prescription shortly. Is there anything else?',
  ];
  const reply = replies[Math.floor(Math.random() * replies.length)];

  setTimeout(() => {
    if (typing) typing.style.display = 'none';
    appendChatMessage(reply, 'doctor');
  }, 1500);
}

function startChatVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice not supported in this browser'); return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  const localeMap = { en: 'en-IN', hi: 'hi-IN', ml: 'ml-IN', ta: 'ta-IN', te: 'te-IN' };
  recognition.lang = localeMap[currentLanguage] || 'en-IN';
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const txt = e.results[0][0].transcript;
    const input = document.getElementById('chat-input');
    if (input) { input.value = txt; sendChatMessage(); }
  };
  recognition.onerror = () => showToast('Could not capture voice');
  recognition.start();
}

// ── Toast Notification ──────────────────────────────────────────
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// ── Utility ─────────────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ── Offline Sync ────────────────────────────────────────────────
window.addEventListener('online', async () => {
  updateOfflineBanner();
  showToast('✅ Back online! Syncing data...');
  const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
  const patientData = JSON.parse(localStorage.getItem('offline_patient') || 'null');
  if (queue.length > 0 && patientData) {
    try {
      const res = await fetch(`${API}/patient/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
      });
      const d = await res.json();
      for (const item of queue) {
        await fetch(`${API}/predict`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: d.patient_id, symptoms: item.symptoms })
        });
      }
      localStorage.removeItem('offline_queue');
      localStorage.removeItem('offline_patient');
      showToast('✅ All data synced successfully!');
    } catch (e) { console.log('[Sync] Failed:', e); }
  }
});

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Greet based on time
  const hour = new Date().getHours();
  const greetEl = document.getElementById('lbl-greeting-sub');
  if (greetEl) {
    if (hour < 12) greetEl.textContent = 'Good morning 🌿';
    else if (hour < 17) greetEl.textContent = 'Good afternoon ☀️';
    else greetEl.textContent = 'Good evening 🌙';
  }

  // Restore session if exists
  const savedPatient = localStorage.getItem('offline_patient');
  if (savedPatient && currentPatientId === null) {
    // Optionally auto-restore (commented out for UX clarity)
    // showAppScreens();
  }
});
