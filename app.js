const SCALE = [
  { value: 5, label: "Rozhodně ano" },
  { value: 4, label: "Spíš ano" },
  { value: 3, label: "Lehce ano" },
  { value: 2, label: "Lehce ne" },
  { value: 1, label: "Spíš ne" },
  { value: 0, label: "Rozhodně ne" },
];

// SEM VLOŽ SVÝCH 14 OTÁZEK
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

const STORAGE_KEY = "survey_demo_answers_v1";
const RESPONDENT_KEY = "survey_demo_respondent_id_v1";

const form = document.getElementById("surveyForm");
const questionsWrap = document.getElementById("questions");
const resultCard = document.getElementById("resultCard");
const resultContent = document.getElementById("resultContent");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const saveShotBtn = document.getElementById("saveShotBtn");

function createRespondentId() {
  const existing = localStorage.getItem(RESPONDENT_KEY);
  if (existing) return existing;

  let id;
  if (window.crypto && crypto.randomUUID) {
    id = crypto.randomUUID().slice(0, 8).toUpperCase();
  } else {
    id = "R" + Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  localStorage.setItem(RESPONDENT_KEY, id);
  return id;
}

const respondentId = createRespondentId();

function renderQuestions() {
  questionsWrap.innerHTML = "";

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

      const saved = loadSavedAnswers();
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

  const saved = loadSavedAnswers();
  if (saved.week) document.getElementById("week").value = saved.week;
  if (saved.slot) document.getElementById("slot").value = saved.slot;
}

function collectAnswers() {
  const answers = [];

  for (let i = 0; i < QUESTIONS.length; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (!checked) {
      return null;
    }
    answers.push(Number(checked.value));
  }

  return answers;
}

function loadSavedAnswers() {
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
    respondentId,
    week: document.getElementById("week").value,
    slot: document.getElementById("slot").value,
    answers: partialAnswers,
    draftSavedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function labelFromValue(value) {
  const found = SCALE.find((item) => item.value === value);
  return found ? found.label : "Neznámá odpověď";
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
      <div class="result-line"><strong>Kód respondenta:</strong> ${payload.respondentId}</div>
      <div class="result-line"><strong>Týden:</strong> ${payload.week}</div>
      <div class="result-line"><strong>Skupina:</strong> ${payload.slot}:00</div>
      <div class="result-line"><strong>Odesláno:</strong> ${new Date(payload.submittedAt).toLocaleString("cs-CZ")}</div>
      <div class="result-line"><strong>Součet bodů:</strong> ${total} / 70</div>
      <div class="result-line"><strong>Průměr:</strong> ${average}</div>
      <ul class="result-list">${listItems}</ul>
      <div class="note">Teď si tuto obrazovku vyfoť.</div>
    </div>
  `;

  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth" });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const answers = collectAnswers();
  if (!answers) {
    alert("Vyplň prosím všech 14 otázek.");
    return;
  }

  const payload = {
    respondentId,
    week: document.getElementById("week").value,
    slot: document.getElementById("slot").value,
    answers,
    submittedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  buildResult(payload);
});

clearBtn.addEventListener("click", () => {
  const confirmed = confirm("Opravdu vymazat rozpracované odpovědi?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  resultCard.classList.add("hidden");
  renderQuestions();
});

downloadBtn.addEventListener("click", () => {
  const data = loadSavedAnswers();
  if (!data.answers) {
    alert("Zatím není co stáhnout.");
    return;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `survey_${data.respondentId}_week${data.week}_slot${data.slot}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

saveShotBtn.addEventListener("click", () => {
  alert("Hotovo. Teď si výsledek vyfoť nebo stáhni JSON.");
});

document.getElementById("week").addEventListener("change", saveDraft);
document.getElementById("slot").addEventListener("change", saveDraft);

renderQuestions();