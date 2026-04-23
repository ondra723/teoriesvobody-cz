import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAmeNPsqa9ZncpA8rRxnnCHj6R4E8eyMY",
  authDomain: "teamfuture-76213.firebaseapp.com",
  projectId: "teamfuture-76213",
  storageBucket: "teamfuture-76213.firebasestorage.app",
  messagingSenderId: "657093621509",
  appId: "1:657093621509:web:569592cd2c26ca3189a96c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SCALE = [
  { value: 5, label: "Rozhodně ano" },
  { value: 4, label: "Spíš ano" },
  { value: 3, label: "Lehce ano" },
  { value: 2, label: "Lehce ne" },
  { value: 1, label: "Spíš ne" },
  { value: 0, label: "Rozhodně ne" },
];

const QUESTIONS = [
  "V našem týmu máme poměrně jasnou představu o tom, čeho chceme dosáhnout.",
  "Většina členů týmu rozumí tomu, co je pro náš tým právě důležité.",
  "Když spolu pracujeme, máme většinou jasno v tom, co je náš společný cíl.",
  "Naše týmová práce dává smysl i z pohledu jednotlivých členů.",
  "V našem týmu se lidé obvykle nebojí říct svůj názor.",
  "Když někdo přijde s odlišným pohledem, bývá vyslechnut s respektem.",
  "V našem týmu je možné přiznat nejistotu nebo chybu bez zbytečného shazování.",
  "Mám pocit, že se do fungování týmu mohu skutečně zapojit.",
  "V našem týmu si všímáme, když něco nefunguje dobře.",
  "Když je potřeba něco zlepšit, dokážeme o tom mluvit věcně.",
  "Náš tým se snaží odvádět práci kvalitně, ne jen „nějak to mít za sebou“.",
  "V týmu si obvykle umíme dát užitečnou zpětnou vazbu.",
  "V našem týmu je prostor přicházet s návrhy na zlepšení.",
  "Když se objeví nový nápad, tým je ochoten ho aspoň zvážit nebo vyzkoušet."
];

const EXTRA_QUESTIONS = [
  "Tento týden bylo v našem týmu celkem jasné, kdo má co udělat.",
  "Když jsme s něčím nesouhlasili, dalo se to říct nahlas bez zbytečného tlaku.",
  "Na konci práce jsme měli jasno, čeho jsme skutečně dosáhli."
];

const DIMENSION_GROUPS = {
  clarity: [0, 1, 2, 3],
  openness: [4, 5, 6, 7],
  coordination: [8, 9, 10, 11, 12, 13],
};

const STORAGE_KEY = "teamfuture_survey_draft_v3";

const form = document.getElementById("surveyForm");
const questionsWrap = document.getElementById("questions");
const extraQuestionsWrap = document.getElementById("extraQuestions");
const resultCard = document.getElementById("resultCard");
const resultContent = document.getElementById("resultContent");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const saveShotBtn = document.getElementById("saveShotBtn");

const weekEl = document.getElementById("week");
const slotEl = document.getElementById("slot");
const teamIdEl = document.getElementById("teamId");
const genderEl = document.getElementById("gender");
const previousScoreEl = document.getElementById("previousScore");
const historyLineEl = document.getElementById("historyLine");
const respondentCodeEl = document.getElementById("respondentCode");

let currentUid = null;
let currentScores = { w1: null, w2: null, w3: null, w4: null };
let currentRemoteData = {};

function loadSavedDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function sanitizeTeamId(raw) {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

function shortCode(uid) {
  return uid ? uid.slice(0, 8).toUpperCase() : "—";
}

function scoreLabel(value) {
  return value == null ? "—" : String(value);
}

function updateHistoryLine() {
  historyLineEl.textContent =
    `T1: ${scoreLabel(currentScores.w1)} | ` +
    `T2: ${scoreLabel(currentScores.w2)} | ` +
    `T3: ${scoreLabel(currentScores.w3)} | ` +
    `T4: ${scoreLabel(currentScores.w4)}`;
}

function saveDraft() {
  const mainAnswers = [];
  const extraAnswers = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    mainAnswers.push(checked ? Number(checked.value) : null);
  }

  for (let i = 0; i < EXTRA_QUESTIONS.length; i++) {
    const checked = document.querySelector(`input[name="x${i}"]:checked`);
    extraAnswers.push(checked ? Number(checked.value) : null);
  }

  const payload = {
    week: weekEl.value,
    slot: slotEl.value,
    teamId: sanitizeTeamId(teamIdEl.value),
    gender: genderEl.value,
    previousScore: previousScoreEl.value.trim(),
    answers: mainAnswers,
    extraAnswers,
    draftSavedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function renderQuestionSet(targetEl, questions, prefix, savedAnswers) {
  targetEl.innerHTML = "";

  questions.forEach((questionText, index) => {
    const card = document.createElement("div");
    card.className = "question-card";

    const title = document.createElement("div");
    title.className = "question-title";
    title.textContent = `${index + 1}. ${questionText}`;

    const scaleGrid = document.createElement("div");
    scaleGrid.className = "scale-grid";

    SCALE.forEach((option) => {
      const label = document.createElement("label");
      label.className = "option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${prefix}${index}`;
      input.value = option.value;

      if (savedAnswers && savedAnswers[index] === option.value) {
        input.checked = true;
      }

      input.addEventListener("change", saveDraft);

      const span = document.createElement("span");
      span.textContent = option.label;

      label.appendChild(input);
      label.appendChild(span);
      scaleGrid.appendChild(label);
    });

    card.appendChild(title);
    card.appendChild(scaleGrid);
    targetEl.appendChild(card);
  });
}

function renderQuestions() {
  const saved = loadSavedDraft();
  renderQuestionSet(questionsWrap, QUESTIONS, "q", saved.answers);
  renderQuestionSet(extraQuestionsWrap, EXTRA_QUESTIONS, "x", saved.extraAnswers);

  if (saved.week) weekEl.value = saved.week;
  if (saved.slot) slotEl.value = saved.slot;
  if (saved.teamId) teamIdEl.value = saved.teamId;
  if (saved.gender != null) genderEl.value = saved.gender;
  if (saved.previousScore != null) previousScoreEl.value = saved.previousScore;
}

function collectAnswers(prefix, count) {
  const answers = [];

  for (let i = 0; i < count; i++) {
    const checked = document.querySelector(`input[name="${prefix}${i}"]:checked`);
    if (!checked) return null;
    answers.push(Number(checked.value));
  }

  return answers;
}

function labelFromValue(value) {
  const found = SCALE.find((item) => item.value === value);
  return found ? found.label : "Neznámá odpověď";
}

function extractScores(data) {
  const nestedScores = data?.scores || {};
  return {
    w1: nestedScores.w1 ?? null,
    w2: nestedScores.w2 ?? null,
    w3: nestedScores.w3 ?? null,
    w4: nestedScores.w4 ?? null,
  };
}

function sumSelected(answers, indexes) {
  return indexes.reduce((sum, idx) => sum + Number(answers[idx] ?? 0), 0);
}

function computeDimensionScores(answers) {
  return {
    clarity: sumSelected(answers, DIMENSION_GROUPS.clarity),
    openness: sumSelected(answers, DIMENSION_GROUPS.openness),
    coordination: sumSelected(answers, DIMENSION_GROUPS.coordination),
  };
}

function nextWeekMap(existingMap, week, value) {
  return {
    ...(existingMap || {}),
    [`w${week}`]: value,
  };
}

async function loadRemoteScores(uid) {
  const ref = doc(db, "respondents", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    currentRemoteData = {};
    currentScores = { w1: null, w2: null, w3: null, w4: null };
    updateHistoryLine();
    return;
  }

  currentRemoteData = snap.data() || {};
  currentScores = extractScores(currentRemoteData);
  updateHistoryLine();
}

async function saveRemoteScores({
  week,
  totalScore,
  previousScore,
  payload,
  dimensionScores,
  extraTotal,
}) {
  if (!currentUid) throw new Error("Chybí přihlášený uživatel.");

  const nextScores = {
    ...currentScores,
    [`w${week}`]: totalScore,
  };

  const prevWeek = week - 1;
  if (prevWeek >= 1 && previousScore !== null) {
    nextScores[`w${prevWeek}`] = previousScore;
  }

  const ref = doc(db, "respondents", currentUid);

  await setDoc(
    ref,
    {
      respondentCode: shortCode(currentUid),
      teamId: payload.teamId,
      gender: payload.gender || null,
      latestWeek: week,
      latestSlot: payload.slot,
      scores: nextScores,
      clarityScores: nextWeekMap(currentRemoteData.clarityScores, week, dimensionScores.clarity),
      opennessScores: nextWeekMap(currentRemoteData.opennessScores, week, dimensionScores.openness),
      coordinationScores: nextWeekMap(currentRemoteData.coordinationScores, week, dimensionScores.coordination),
      concreteScores: nextWeekMap(currentRemoteData.concreteScores, week, extraTotal),
      weekClientSubmittedAt: nextWeekMap(currentRemoteData.weekClientSubmittedAt, week, payload.submittedAt),
      weekSlots: nextWeekMap(currentRemoteData.weekSlots, week, payload.slot),
      answersByWeek: nextWeekMap(currentRemoteData.answersByWeek, week, payload.answers),
      extraAnswersByWeek: nextWeekMap(currentRemoteData.extraAnswersByWeek, week, payload.extraAnswers),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await loadRemoteScores(currentUid);
}

function buildResult(payload, total, average, dimensionScores, extraTotal) {
  const listItems = payload.answers
    .map((value, idx) => `<li><strong>${idx + 1}.</strong> ${labelFromValue(value)} (${value})</li>`)
    .join("");

  const extraListItems = payload.extraAnswers
    .map((value, idx) => `<li><strong>${idx + 1}.</strong> ${labelFromValue(value)} (${value})</li>`)
    .join("");

  resultContent.innerHTML = `
    <div class="result-box">
      <div class="result-line"><strong>Kód respondenta:</strong> ${shortCode(currentUid)}</div>
      <div class="result-line"><strong>ID týmu:</strong> ${payload.teamId}</div>
      <div class="result-line"><strong>Pohlaví:</strong> ${payload.gender || "neuvedeno"}</div>
      <div class="result-line"><strong>Týden:</strong> ${payload.week}</div>
      <div class="result-line"><strong>Čas cvičení:</strong> ${payload.slot}:00</div>
      <div class="result-line"><strong>Odesláno:</strong> ${new Date(payload.submittedAt).toLocaleString("cs-CZ")}</div>

      <div class="result-grid">
        <div class="result-chip"><strong>Hlavní skóre</strong><br>${total} / 70</div>
        <div class="result-chip"><strong>Průměr</strong><br>${average}</div>
        <div class="result-chip"><strong>Jasnost cíle</strong><br>${dimensionScores.clarity} / 20</div>
        <div class="result-chip"><strong>Otevřenost</strong><br>${dimensionScores.openness} / 20</div>
        <div class="result-chip"><strong>Koordinace / tah</strong><br>${dimensionScores.coordination} / 30</div>
        <div class="result-chip"><strong>Doplňkové konkrétní skóre</strong><br>${extraTotal} / 15</div>
      </div>

      <div class="result-line"><strong>Uložená hlavní skóre:</strong>
        T1: ${scoreLabel(currentScores.w1)} |
        T2: ${scoreLabel(currentScores.w2)} |
        T3: ${scoreLabel(currentScores.w3)} |
        T4: ${scoreLabel(currentScores.w4)}
      </div>

      <details>
        <summary><strong>14 hlavních odpovědí</strong></summary>
        <ul class="result-list">${listItems}</ul>
      </details>

      <details>
        <summary><strong>3 doplňující odpovědi</strong></summary>
        <ul class="result-list">${extraListItems}</ul>
      </details>

      <div class="note">Teď si tuto obrazovku vyfoť.</div>
    </div>
  `;

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth" });
}

async function bootAuth() {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Anonymous auth failed:", error);
    respondentCodeEl.textContent = "chyba auth";
    historyLineEl.textContent = "nepodařilo se přihlásit";
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    currentUid = user.uid;
    respondentCodeEl.textContent = shortCode(currentUid);
    await loadRemoteScores(currentUid);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUid) {
    alert("Ještě se dokončuje přihlášení. Zkus to za pár sekund znovu.");
    return;
  }

  const teamId = sanitizeTeamId(teamIdEl.value);
  if (!teamId) {
    alert("Vyplň prosím ID týmu.");
    teamIdEl.focus();
    return;
  }
  teamIdEl.value = teamId;

  const answers = collectAnswers("q", QUESTIONS.length);
  if (!answers) {
    alert("Vyplň prosím všech 14 hlavních otázek.");
    return;
  }

  const extraAnswers = collectAnswers("x", EXTRA_QUESTIONS.length);
  if (!extraAnswers) {
    alert("Vyplň prosím i 3 doplňující otázky.");
    return;
  }

  const totalScore = answers.reduce((sum, x) => sum + x, 0);
  const extraTotal = extraAnswers.reduce((sum, x) => sum + x, 0);
  const average = (totalScore / answers.length).toFixed(2);
  const dimensionScores = computeDimensionScores(answers);
  const week = Number(weekEl.value);

  let previousScore = null;
  const rawPrevious = previousScoreEl.value.trim();
  if (rawPrevious !== "") {
    previousScore = Number(rawPrevious);
    if (Number.isNaN(previousScore) || previousScore < 0 || previousScore > 70) {
      alert("Score z minulého týdne musí být číslo mezi 0 a 70.");
      return;
    }
  }

  const payload = {
    week: weekEl.value,
    slot: slotEl.value,
    teamId,
    gender: genderEl.value,
    answers,
    extraAnswers,
    submittedAt: new Date().toISOString(),
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      week: weekEl.value,
      slot: slotEl.value,
      teamId,
      gender: genderEl.value,
      previousScore: previousScoreEl.value.trim(),
      answers,
      extraAnswers,
      submittedAt: payload.submittedAt,
    })
  );

  try {
    await saveRemoteScores({
      week,
      totalScore,
      previousScore,
      payload,
      dimensionScores,
      extraTotal,
    });
    buildResult(payload, totalScore, average, dimensionScores, extraTotal);
  } catch (error) {
    console.error("Save failed:", error);
    alert("Uložení do databáze se nepovedlo.");
  }
});

clearBtn.addEventListener("click", () => {
  const confirmed = confirm("Opravdu vymazat rozpracované odpovědi?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  resultCard.classList.add("hidden");
  previousScoreEl.value = "";
  teamIdEl.value = "";
  genderEl.value = "";
  renderQuestions();
});

downloadBtn.addEventListener("click", () => {
  const data = loadSavedDraft();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          respondentCode: shortCode(currentUid),
          teamId: data.teamId ?? teamIdEl.value,
          gender: data.gender ?? genderEl.value,
          week: data.week ?? weekEl.value,
          slot: data.slot ?? slotEl.value,
          previousScore: data.previousScore ?? "",
          answers: data.answers ?? [],
          extraAnswers: data.extraAnswers ?? [],
          scores: currentScores,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      ),
    ],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `teamfuture_${shortCode(currentUid)}_week${weekEl.value}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

saveShotBtn.addEventListener("click", () => {
  alert("Hotovo. Teď si výsledek vyfoť nebo stáhni JSON.");
});

weekEl.addEventListener("change", saveDraft);
slotEl.addEventListener("change", saveDraft);
teamIdEl.addEventListener("input", saveDraft);
genderEl.addEventListener("change", saveDraft);
previousScoreEl.addEventListener("input", saveDraft);

renderQuestions();
updateHistoryLine();
bootAuth();
