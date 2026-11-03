const DATA_FILE = "full data.txt";
const STORAGE_KEY = "chm102-practice-v2";
const THEME_KEY = "chm102-theme";
const TOTAL_QUESTIONS = 240;
const motivationLeads = [
  "Keep your focus here", "Stay with the work", "Your crown is still yours", "One brave attempt matters",
  "The next step belongs to you", "Work a little harder", "You are built for this", "Do not give up now",
  "Your best is still unfolding", "Let this question sharpen you", "You can become excellent at this", "Keep your standard high"
];
const motivationEnds = [
  "and let today make you stronger.", "because the people who finish keep returning.", "and remember that no one can take your progress from you.",
  "because your future self is counting on this effort.", "and give the next minute your full attention.", "because consistency is how the best get ahead.",
  "and prove to yourself that you can stay in the room.", "because hard things become familiar through practice.",
  "and make this attempt count for something.", "because you are closer than you think.", "and keep moving even before it feels easy.",
  "because your determination is part of your talent.", "and choose progress over panic.", "because every answer teaches you where to aim next.",
  "and show up like the greatest version of you.", "because your work today is building your advantage.", "and do not hand your confidence away.",
  "because you can recover, rethink, and rise.", "and keep your eyes on the finish line.", "because you are capable of more than one difficult question."
];

const allMotivations = motivationLeads.flatMap((lead) => motivationEnds.map((ending) => `${lead} ${ending}`));
const state = { questions: [], order: [], current: 0, user: "", progress: {}, motivationOrder: [], started: false, dotPage: 0, dotsExpanded: false };
const elements = {
  userName: document.querySelector("#user-name"),
  themeToggle: document.querySelector("#theme-toggle"), themeToggleQuiz: document.querySelector("#theme-toggle-quiz"),
  homeButton: document.querySelector("#home-button"), hardRefresh: document.querySelector("#hard-refresh"),
  homeScreen: document.querySelector("#home-screen"), practiceLayout: document.querySelector("#practice-layout"),
  introGrid: document.querySelector(".intro-grid"), progressSection: document.querySelector("#progress-section"), quizWelcome: document.querySelector("#quiz-welcome"), welcomeName: document.querySelector("#welcome-name"),
  homeTitle: document.querySelector("#home-title"), homeCopy: document.querySelector("#home-copy"),
  homeProgress: document.querySelector("#home-progress"), startQuiz: document.querySelector("#start-quiz"), retryQuiz: document.querySelector("#retry-quiz"),
  section: document.querySelector("#section-label"), index: document.querySelector("#question-index"),
  number: document.querySelector("#question-number"), text: document.querySelector("#question-text"),
  options: document.querySelector("#options"), status: document.querySelector("#answer-status"),
  explanationCard: document.querySelector("#explanation-card"), explanation: document.querySelector("#explanation-text"),
  previous: document.querySelector("#previous-button"), next: document.querySelector("#next-button"),
  progressCount: document.querySelector("#progress-count"),
  resultMap: document.querySelector(".result-map"), dotsPrevious: document.querySelector("#dots-previous"), dotsNext: document.querySelector("#dots-next"), expandDots: document.querySelector("#expand-dots"), dotRange: document.querySelector("#dot-range"),
  attemptedTotal: document.querySelector("#attempted-total"), correctTotal: document.querySelector("#correct-total"), wrongTotal: document.querySelector("#wrong-total"), passPercent: document.querySelector("#pass-percent"),
  questionMotivation: document.querySelector("#question-motivation"), motivationLabel: document.querySelector("#motivation-label"),
  resultDots: document.querySelector("#result-dots"), motivation: document.querySelector("#motivation"), motivationCaption: document.querySelector(".side-note-caption"),
  loaded: document.querySelector("#loaded-status"), card: document.querySelector("#question-card")
};

function clean(value) {
  return value.replace(/\u00a0/g, " ").replace(/[￾]/g, "-").replace(/[ \t]+/g, " ").trim();
}

function splitNumberedBlocks(text) {
  const starts = [...text.matchAll(/(?:^|\n)\s*(\d{1,3})\.\s+/g)];
  return starts.map((match, index) => ({ number: Number(match[1]), text: text.slice(match.index + match[0].length, starts[index + 1]?.index ?? text.length) }));
}

function parseQuestionBlock(block, section) {
  const optionMatches = [...block.text.matchAll(/(?:^|\n)\s*([A-E])[\)\.]\s*/g)];
  if (!optionMatches.length) return null;
  const questionText = clean(block.text.slice(0, optionMatches[0].index));
  const options = optionMatches.map((match, index) => ({
    key: match[1], text: clean(block.text.slice(match.index + match[0].length, optionMatches[index + 1]?.index ?? block.text.length))
  }));
  return { id: `${section}-${block.number}`, number: block.number, section, question: questionText, options };
}

function parseSolutions(text, section) {
  return splitNumberedBlocks(text).reduce((map, block) => {
    const answerMatch = block.text.match(/^\s*([A-E])(?:\)|\.)/);
    if (!answerMatch) return map;
    const explanationMatch = block.text.match(/\bExplanation\s*:\s*/i);
    const answerText = explanationMatch ? block.text.slice(0, explanationMatch.index) : block.text;
    const explanation = explanationMatch ? clean(block.text.slice(explanationMatch.index + explanationMatch[0].length)) : "";
    map[`${section}-${block.number}`] = { answer: answerMatch[1], answerText: clean(answerText.replace(/^\s*[A-E](?:\)|\.)\s*/, "")), explanation };
    return map;
  }, {});
}

function parseData(text) {
  const mainEnd = text.indexOf("TEST REVISION GUIDES");
  const solutionHeading = text.match(/EXAMINATION\s+REVISION\s+SOLUTIONS/);
  const solutionStart = solutionHeading ? solutionHeading.index : -1;
  const testSolutionStart = text.indexOf("TEST REVISION SOLUTIONS");
  if (mainEnd < 0 || solutionStart < 0 || testSolutionStart < 0) throw new Error("Question bank headings are incomplete");
  const mainQuestions = text.slice(0, mainEnd);
  const guideQuestions = text.slice(mainEnd + "TEST REVISION GUIDES".length, solutionStart);
  const mainSolutions = text.slice(solutionStart + solutionHeading[0].length, testSolutionStart);
  const guideSolutions = text.slice(testSolutionStart + "TEST REVISION SOLUTIONS".length);
  const solutions = { ...parseSolutions(mainSolutions, "exam"), ...parseSolutions(guideSolutions, "guide") };
  return [
    ...splitNumberedBlocks(mainQuestions).map((block) => parseQuestionBlock(block, "exam")),
    ...splitNumberedBlocks(guideQuestions).map((block) => parseQuestionBlock(block, "guide"))
  ].filter(Boolean).map((question) => ({ ...question, ...solutions[question.id] }));
}

function storageId(user = state.user) { return user.trim().toLowerCase() || "guest"; }
function readStorage() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
function saveUserData(user = state.user) {
  const saved = readStorage();
  saved[storageId(user)] = { order: state.order, current: state.current, progress: state.progress, motivationOrder: state.motivationOrder, started: state.started };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}
function loadUserData() {
  const saved = readStorage()[storageId()];
  state.order = saved?.order?.length === state.questions.length ? saved.order : shuffle([...Array(state.questions.length).keys()]);
  state.current = saved?.current ?? 0;
  state.progress = saved?.progress || {};
  state.motivationOrder = saved?.motivationOrder?.length === allMotivations.length ? saved.motivationOrder : shuffle([...Array(allMotivations.length).keys()]);
  state.started = Boolean(saved?.started);
}
function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
function applyTheme(theme) {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);
  [elements.themeToggle, elements.themeToggleQuiz].forEach((button) => {
    button.textContent = dark ? "☼" : "◐";
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.title = dark ? "Switch to light mode" : "Switch to dark mode";
  });
}
function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}
function currentQuestion() { return state.questions[state.order[state.current]]; }

function updateProgress() {
  const attempts = Object.values(state.progress);
  const correct = attempts.filter((item) => item.correct).length;
  const total = state.questions.length;
  const percent = total ? Math.round((attempts.length / total) * 100) : 0;
  const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
  elements.progressCount.textContent = `${attempts.length} / ${total}`;
  elements.attemptedTotal.textContent = attempts.length;
  elements.correctTotal.textContent = correct;
  elements.wrongTotal.textContent = attempts.length - correct;
  elements.passPercent.textContent = `${accuracy}%`;
  renderResultDots();
}

function renderResultDots() {
  elements.resultDots.replaceChildren();
  const start = state.dotsExpanded ? 0 : state.dotPage * 20;
  const end = state.dotsExpanded ? state.order.length : Math.min(start + 20, state.order.length);
  state.order.slice(start, end).forEach((questionIndex, visiblePosition) => {
    const position = start + visiblePosition;
    const question = state.questions[questionIndex];
    const result = state.progress[question.id];
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `result-dot ${result ? (result.correct ? "correct" : "wrong") : ""} ${position === state.current ? "current" : ""}`;
    dot.textContent = String(position + 1);
    dot.title = result ? `Question ${position + 1}: ${result.correct ? "correct" : "retry"}` : `Question ${position + 1}: unanswered`;
    dot.setAttribute("aria-label", dot.title);
    dot.addEventListener("click", () => { state.current = position; saveUserData(); showQuiz(); });
    elements.resultDots.append(dot);
  });
  elements.resultMap.classList.toggle("is-expanded", state.dotsExpanded);
  elements.expandDots.textContent = state.dotsExpanded ? "Show current 20" : "Show all 240";
  elements.dotRange.textContent = state.dotsExpanded ? `1–${state.order.length} of ${state.order.length}` : `${start + 1}–${end} of ${state.order.length}`;
  elements.dotsPrevious.disabled = state.dotsExpanded || state.dotPage === 0;
  elements.dotsNext.disabled = state.dotsExpanded || end >= state.order.length;
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return;
  const saved = state.progress[question.id];
  elements.section.textContent = question.section === "exam" ? "Examination revision" : "Test revision guide";
  elements.index.textContent = `Run question ${state.current + 1} of ${state.questions.length}`;
  elements.number.textContent = String(question.number).padStart(2, "0");
  elements.text.textContent = question.question;
  elements.options.replaceChildren();
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option";
    button.type = "button";
    button.innerHTML = `<span class="option-key">${option.key}</span><span>${option.text}</span>`;
    button.addEventListener("click", () => chooseAnswer(option.key));
    elements.options.append(button);
  });
  elements.explanationCard.hidden = !saved;
  elements.status.hidden = !saved;
  if (saved) showAnswer(saved.choice, question.answer, question.explanation);
  else elements.status.textContent = "Choose an answer to reveal the explanation.";
  elements.previous.disabled = state.current === 0;
  elements.next.disabled = state.current === state.questions.length - 1;
  elements.next.querySelector("span").textContent = state.current === state.questions.length - 1 ? "Last question" : "Next question";
  const motivationId = state.motivationOrder[state.current] ?? state.current;
  elements.motivation.textContent = allMotivations[motivationId];
  elements.motivationCaption.textContent = `Motivation ${String(motivationId + 1).padStart(3, "0")}`;
  elements.questionMotivation.textContent = allMotivations[motivationId];
  elements.motivationLabel.textContent = `Motivation ${String(motivationId + 1).padStart(3, "0")}`;
  if (!state.dotsExpanded) state.dotPage = Math.floor(state.current / 20);
  elements.card.style.animation = "none";
  requestAnimationFrame(() => { elements.card.style.animation = ""; });
  updateProgress();
}

function showAnswer(choice, answer, explanation) {
  document.querySelectorAll(".option").forEach((button) => {
    const key = button.querySelector(".option-key").textContent;
    button.disabled = true;
    if (key === answer) button.classList.add("is-correct");
    if (key === choice && choice !== answer) button.classList.add("is-wrong");
  });
  const correct = choice === answer;
  elements.status.hidden = false;
  elements.status.className = `answer-status ${correct ? "correct" : "wrong"}`;
  elements.status.textContent = correct ? "Correct. Keep that momentum." : `Not this time. The text marks ${answer} as the answer.`;
  elements.explanationCard.hidden = false;
  elements.explanation.textContent = explanation || "No explanation was provided for this item.";
}

function chooseAnswer(choice) {
  const question = currentQuestion();
  if (state.progress[question.id]) return;
  state.progress[question.id] = { choice, correct: choice === question.answer };
  saveUserData();
  showAnswer(choice, question.answer, question.explanation);
  updateProgress();
}

function moveBy(amount) { state.current = Math.max(0, Math.min(state.questions.length - 1, state.current + amount)); saveUserData(); renderQuestion(); window.scrollTo({ top: document.querySelector(".practice-layout").offsetTop - 20, behavior: "smooth" }); }

function startNewRun() {
  state.order = shuffle([...Array(state.questions.length).keys()]);
  state.motivationOrder = shuffle([...Array(allMotivations.length).keys()]);
  state.progress = {};
  state.current = 0;
  state.dotPage = 0;
  state.dotsExpanded = false;
  state.started = true;
  saveUserData();
  showQuiz();
}

function renderHome() {
  const attempts = Object.keys(state.progress).length;
  const complete = attempts === state.questions.length;
  elements.homeScreen.hidden = false;
  elements.practiceLayout.hidden = true;
  elements.introGrid.hidden = false;
  elements.progressSection.hidden = false;
  elements.quizWelcome.hidden = true;
  document.body.classList.remove("quiz-mode");
  if (!state.started) {
    elements.homeTitle.textContent = "Ready to take your place?";
    elements.homeCopy.textContent = "Start a fresh run through all 240 questions. Your name, order, and progress will stay right here in this browser.";
    elements.startQuiz.hidden = false;
    elements.startQuiz.textContent = "Start quiz →";
    elements.retryQuiz.hidden = true;
    elements.homeProgress.textContent = "No run started yet.";
  } else if (complete) {
    elements.homeTitle.textContent = "You finished the run.";
    elements.homeCopy.textContent = "That is 240 decisions made. Take a breath, look at your result map, and come back stronger for another run.";
    elements.startQuiz.hidden = true;
    elements.retryQuiz.hidden = false;
    elements.homeProgress.textContent = `${attempts} / ${state.questions.length} attempted · ${Object.values(state.progress).filter((item) => item.correct).length} correct`;
  } else {
    elements.homeTitle.textContent = "Your next question is waiting.";
    elements.homeCopy.textContent = "Your current run is saved. Continue from where you left off, or reshuffle every question for a new challenge.";
    elements.startQuiz.hidden = false;
    elements.startQuiz.textContent = "Continue quiz →";
    elements.retryQuiz.hidden = false;
    elements.homeProgress.textContent = `${attempts} / ${state.questions.length} attempted · ${state.questions.length - attempts} still waiting`;
  }
  updateProgress();
}

function showQuiz() {
  elements.homeScreen.hidden = true;
  elements.introGrid.hidden = true;
  elements.progressSection.hidden = false;
  elements.quizWelcome.hidden = false;
  elements.practiceLayout.hidden = false;
  elements.welcomeName.textContent = state.user.trim() || "student";
  document.body.classList.add("quiz-mode");
  renderQuestion();
}

function hardRefresh() {
  if (!confirm("Hard refresh will clear this user's name, progress, order, and motivations. Start fresh?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("chm102-user");
  state.user = "";
  state.progress = {};
  state.started = false;
  state.current = 0;
  state.dotPage = 0;
  state.dotsExpanded = false;
  elements.userName.value = "";
  loadUserData();
  renderHome();
}

async function init() {
  try {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    const response = await fetch(DATA_FILE);
    if (!response.ok) throw new Error("Question file unavailable");
    const text = await response.text();
    state.questions = parseData(text);
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    state.user = localStorage.getItem("chm102-user") || "";
    elements.userName.value = state.user;
    loadUserData();
    elements.loaded.textContent = `${state.questions.length} questions loaded from your guide`;
    updateProgress();
    renderHome();
  } catch (error) {
    elements.loaded.textContent = "Could not load full data.txt";
    elements.text.textContent = "Open this page through a local web server so the question bank can load.";
  }
}

elements.userName.addEventListener("change", () => { saveUserData(state.user); state.user = elements.userName.value; localStorage.setItem("chm102-user", state.user); loadUserData(); renderHome(); });
elements.themeToggle.addEventListener("click", toggleTheme);
elements.themeToggleQuiz.addEventListener("click", toggleTheme);
elements.previous.addEventListener("click", () => moveBy(-1));
elements.next.addEventListener("click", () => moveBy(1));
document.querySelector("#random-question").addEventListener("click", () => { state.current = Math.floor(Math.random() * state.questions.length); saveUserData(); renderQuestion(); });
elements.dotsPrevious.addEventListener("click", () => { state.dotPage = Math.max(0, state.dotPage - 1); renderResultDots(); });
elements.dotsNext.addEventListener("click", () => { state.dotPage = Math.min(Math.ceil(state.order.length / 20) - 1, state.dotPage + 1); renderResultDots(); });
elements.expandDots.addEventListener("click", () => { state.dotsExpanded = !state.dotsExpanded; renderResultDots(); });
elements.homeButton.addEventListener("click", renderHome);
elements.hardRefresh.addEventListener("click", hardRefresh);
elements.startQuiz.addEventListener("click", () => state.started && Object.keys(state.progress).length < state.questions.length ? showQuiz() : startNewRun());
elements.retryQuiz.addEventListener("click", startNewRun);
init();