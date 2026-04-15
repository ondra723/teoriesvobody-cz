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

const STORAGE_KEY = "teamfuture_survey_draft_v2";

const form = document.getElementById("surveyForm");
const questionsWrap = document.getElementById("questions");
const resultCard = document.getElementById("resultCard");
const resultContent = document.getElementById("resultContent");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const saveShotBtn = document.getElementById("saveShotBtn");

const weekEl = document.getElementById("week");
const slotEl = document.getElementById("slot");
const previousScoreEl = document.getElementById("previousScore");
const historyLineEl = document.getElementById("historyLine");
const respondentCodeEl = document.getElementById("respondentCode");

let currentUid = null;
let currentScores = {
  w1: null,
  w2: null,
  w3: null,
  w4: null,
};

function loadSavedDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveDraft() {
  const partialAnswers = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    partialAnswers.push(checked ? Number(checked.value) : null);
  }

  const payload = {
    week: weekEl.value,
    slot: slotEl.value,
    previousScore: previousScoreEl.value.trim(),
    answers: partialAnswers,
    draftSavedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

function renderQuestions() {
  questionsWrap.innerHTML = "";
  const saved = loadSavedDraft();

  QUESTIONS.forEach((questionText, index) => {
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
      input.name = `q${index}`;
      input.value = option.value;

      if (saved.answers && saved.answers[index] === option.value) {
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
    questionsWrap.appendChild(card);
  });

  if (saved.week) weekEl.value = saved.week;
  if (saved.slot) slotEl.value = saved.slot;
  if (saved.previousScore != null) previousScoreEl.value = saved.previousScore;
}

function collectAnswers() {
  const answers = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (!checked) return null;
    answers.push(Number(checked.value));
  }

  return answers;
}

function labelFromValue(value) {
  const found = SCALE.find((item) => item.value === value);
  return found ? found.label : "Neznámá odpověď";
}

async function loadRemoteScores(uid) {
  const ref = doc(db, "respondents", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    currentScores = { w1: null, w2: null, w3: null, w4: null };
    updateHistoryLine();
    return;
  }

  const data = snap.data();
  currentScores = {
    w1: data?.scores?.w1 ?? null,
    w2: data?.scores?.w2 ?? null,
    w3: data?.scores?.w3 ?? null,
    w4: data?.scores?.w4 ?? null,
  };

  updateHistoryLine();
}

async function saveRemoteScores({ week, totalScore, previousScore }) {
  if (!currentUid) throw new Error("Chybí přihlášený uživatel.");

  const payload = {
    updatedAt: serverTimestamp(),
    [`scores.w${week}`]: totalScore,
  };

  const prevWeek = week - 1;
  if (prevWeek >= 1 && previousScore !== null) {
    payload[`scores.w${prevWeek}`] = previousScore;
  }

  const ref = doc(db, "respondents", currentUid);
  await setDoc(ref, payload, { merge: true });

  await loadRemoteScores(currentUid);
}

function buildResult(payload) {
  const total = payload.answers.reduce((sum, x) => sum + x, 0);
  const average = (total / payload.answers.length).toFixed(2);

  const listItems = payload.answers
    .map((value, idx) => {
      return `<li><strong>${idx + 1}.</strong> ${labelFromValue(value)} (${value})</li>`;
    })
    .join("");

  resultContent.innerHTML = `
    <div class="result-box">
      <div class="result-line"><strong>Kód respondenta:</strong> ${shortCode(currentUid)}</div>
      <div class="result-line"><strong>Týden:</strong> ${payload.week}</div>
      <div class="result-line"><strong>Skupina:</strong> ${payload.slot}:00</div>
      <div class="result-line"><strong>Odesláno:</strong> ${new Date(payload.submittedAt).toLocaleString("cs-CZ")}</div>
      <div class="result-line"><strong>Součet bodů:</strong> ${total} / 70</div>
      <div class="result-line"><strong>Průměr:</strong> ${average}</div>
      <div class="result-line"><strong>Uložená skóre:</strong>
        T1: ${scoreLabel(currentScores.w1)} |
        T2: ${scoreLabel(currentScores.w2)} |
        T3: ${scoreLabel(currentScores.w3)} |
        T4: ${scoreLabel(currentScores.w4)}
      </div>
      <ul class="result-list">${listItems}</ul>
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

  const answers = collectAnswers();
  if (!answers) {
    alert("Vyplň prosím všech 14 otázek.");
    return;
  }

  const totalScore = answers.reduce((sum, x) => sum + x, 0);
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
    answers,
    submittedAt: new Date().toISOString(),
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      week: weekEl.value,
      slot: slotEl.value,
      previousScore: previousScoreEl.value.trim(),
      answers,
      submittedAt: payload.submittedAt,
    })
  );

  try {
    await saveRemoteScores({ week, totalScore, previousScore });
    buildResult(payload);
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
  renderQuestions();
});

downloadBtn.addEventListener("click", () => {
  const data = loadSavedDraft();
  const blob = new Blob(
    [
      JSON.stringify(
        {
          respondentCode: shortCode(currentUid),
          week: data.week ?? weekEl.value,
          slot: data.slot ?? slotEl.value,
          previousScore: data.previousScore ?? "",
          answers: data.answers ?? [],
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
previousScoreEl.addEventListener("input", saveDraft);

renderQuestions();
updateHistoryLine();
bootAuth();
