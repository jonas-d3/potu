import {
  COLORS,
  LEVELS,
  PUZZLE_VERSION,
  VALUES,
  conflicts,
  coordinate,
  copyBoard,
  createPuzzle,
  isComplete,
  nextDeduction,
} from "./puzzle.mjs";
import { icon } from "./icons.mjs";

const $ = (selector) => document.querySelector(selector);
const main = $("#main");
const dialog = $("#dialog");
const formatDate = new Intl.DateTimeFormat("da-DK", { dateStyle: "full" });
const shortDays = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
const symbols = ["", "●", "◆", "▲", "■", "★"];
const dayLevels = [0, 0, 1, 1, 2, 2, 3];
const storagePrefix = "potu.v1.";
const fallback = new Map();
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let view = "home";
let day = dayKey(new Date());
let game,
  puzzle,
  activeSince = null,
  selection = -1,
  hint = null,
  errors = [];
let feedback = "",
  feedbackTimeout;
let tutorialStep = 0;
let preferences = {
  symbols: false,
  timer: false,
  related: false,
  theme: "system",
  ...read("options"),
};

function read(key) {
  try {
    return (
      JSON.parse(localStorage.getItem(storagePrefix + key)) ?? fallback.get(key)
    );
  } catch {
    return fallback.get(key);
  }
}
function write(key, value) {
  fallback.set(key, value);
  try {
    localStorage.setItem(storagePrefix + key, JSON.stringify(value));
  } catch {
    /* In-memory play stays available. */
  }
}
function dayKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function dateOf(key) {
  return new Date(key + "T12:00:00");
}
function plusDays(key, count) {
  const date = dateOf(key);
  date.setDate(date.getDate() + count);
  return dayKey(date);
}
function weekDay(key) {
  return (dateOf(key).getDay() + 6) % 7;
}
function timeText(milliseconds) {
  const s = Math.floor(milliseconds / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function elapsed() {
  return (
    (game?.ms || 0) +
    (activeSince === null ? 0 : performance.now() - activeSince)
  );
}
function persist() {
  if (!game) return;
  if (activeSince !== null) {
    game.ms = elapsed();
    activeSince = performance.now();
  }
  write("game." + game.key, game);
}
function stopClock() {
  persist();
  activeSince = null;
}
function startClock() {
  if (
    view === "game" &&
    !game.won &&
    !dialog.open &&
    !document.hidden &&
    activeSince === null
  )
    activeSince = performance.now();
}
function updateHeader() {
  const playing = view === "game" && !game.won;
  $("#pause").hidden = !playing;
  $("#clock").hidden = !playing || !preferences.timer;
  if (playing) $("#clock").textContent = timeText(elapsed());
}
function applyTheme() {
  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function brand(word = true) {
  return (
    '<div class="brand"><div class="brand-mark" aria-hidden="true">' +
    [4, 1, 2, 3]
      .map((c, i) => '<span class="c' + c + '">' + (i + 1) + "</span>")
      .join("") +
    "</div>" +
    (word ? '<h1 class="wordmark">Potu</h1>' : "") +
    "</div>"
  );
}
function meter(level) {
  return (
    '<span class="meter" aria-hidden="true">' +
    VALUES.map(
      (i) => '<i class="' + (i <= level + 1 ? "on" : "") + '"></i>',
    ).join("") +
    "</span>"
  );
}
function newBoardPicker() {
  const buttons = LEVELS.map((name, level) =>
    `<button class="raised c${level + 1}" type="button" data-level="${level}">${name}</button>`
  ).join("");
  return `<fieldset class="new-board"><legend>Ny bane</legend><div>${buttons}</div></fieldset>`;
}
function weekStrip() {
  const today = dayKey(new Date());
  const monday = plusDays(today, -weekDay(today));
  return (
    '<nav class="week" aria-label="Ugens opgaver">' +
    shortDays
      .map((label, i) => {
        const key = plusDays(monday, i),
          future = key > today,
          saved = read("game." + key);
        const full =
          formatDate.format(dateOf(key)) +
          (future ? ", åbner på dagen" : saved?.won ? ", løst" : "");
        return (
          '<button class="day level-' +
          dayLevels[i] +
          '" data-day="' +
          key +
          '" aria-label="' +
          full +
          '" aria-pressed="' +
          (day === key) +
          '" title="' +
          full +
          '"' +
          (future ? " disabled" : "") +
          "><strong>" +
          label +
          '</strong><small aria-hidden="true">' +
          (saved?.won ? "✓" : saved ? "•" : "") +
          "</small></button>"
        );
      })
      .join("") +
    "</nav>"
  );
}
function showHome(focus = false) {
  if (view === "game") stopClock();
  if (dialog.open) dialog.close();
  view = "home";
  game = puzzle = null;
  clearFeedback();
  const saved = read("game." + day),
    level = dayLevels[weekDay(day)];
  main.className = "home";
  main.innerHTML =
    '<section class="card home-card">' +
    brand() +
    newBoardPicker() +
    '<div class="daily-info"><p class="date-label">' +
    formatDate.format(dateOf(day)) +
    '</p><p class="difficulty">' +
    meter(level) +
    LEVELS[level] +
    '</p><p class="game-status">' +
    (saved?.won
      ? "Løst på " + timeText(saved.ms)
      : saved
        ? "I gang"
        : "Ikke startet") +
    '</p></div><button class="raised start" data-action="start">' +
    (saved?.won ? "Se løsning" : saved ? "Fortsæt" : "Start") +
    "</button>" +
    weekStrip() +
    '<p class="first-time">Første gang? <button class="link-button" data-action="rules">Lær at spille her</button></p></section>';
  updateHeader();
  if (focus) $(".start").focus();
}
function startGame(key, level) {
  stopClock();
  view = "game";
  if (dialog.open) dialog.close();
  const saved = read("game." + key);
  const puzzleVersion = saved ? saved.puzzleVersion ?? 1 : PUZZLE_VERSION;
  puzzle = createPuzzle(key, level, puzzleVersion);
  game = saved ?? {
    key,
    level,
    puzzleVersion,
    board: copyBoard(puzzle.givens),
    history: [],
    ms: 0,
    won: false,
    hints: 0,
  };
  if (key.startsWith("fri-")) write("practice", { key, level });
  selection = -1;
  clearFeedback();
  persist();
  startClock();
  renderGame();
  main.focus({ preventScroll: true });
}
function renderGame() {
  main.className = "game";
  main.tabIndex = -1;
  const { size, values } = puzzle;
  main.style.setProperty("--grid-size", size);
  const placedMark =
    '<span class="placed-mark" aria-hidden="true">' + icon("tick") + "</span>";
  const grid = Array.from(
    { length: size },
    (_, row) =>
      '<div class="board-row" role="row">' +
      values.map((_, col) => {
        const i = row * size + col;
        return (
          '<button type="button" class="tile" role="gridcell" data-cell="' +
          i +
          '"></button>'
        );
      }).join("") +
      "</div>",
  ).join("");
  const action = (name, glyph, label, title) =>
    '<button class="action" data-action="' +
    name +
    '" title="' +
    title +
    '">' +
    icon(glyph) +
    "<span>" +
    label +
    "</span></button>";
  main.innerHTML =
    '<h1 class="sr-only">' +
    (game.key.startsWith("fri-")
      ? "Frit spil"
      : formatDate.format(dateOf(game.key))) +
    `</h1><div class="board-area"><div class="board" role="grid" aria-label="Spillebræt med ${size} rækker og ${size} kolonner">` +
    grid +
    '</div></div><div class="game-footer">' +
    (game.won
      ? '<button class="raised review-home" data-action="home">Til forsiden</button>'
      : '<section class="controls" aria-label="Spilhandlinger"><button class="feedback" data-action="dismiss"></button><div class="actions">' +
        action("undo", "undo", "Fortryd", "Fortryd seneste træk (Ctrl+Z)") +
        action("check", "check", "Tjek", "Tjek brættet for fejl") +
        action("hint", "hint", "Hint", "Få et hint") +
        '</div><div class="pad" role="group" aria-label="Vælg tal eller farve">' +
        values.map(
          (v) =>
            '<button class="key digit" data-kind="0" data-value="' +
            v +
            '" aria-label="Tal ' +
            v +
            '">' +
            v +
            placedMark +
            "</button>",
        ).join("") +
        values.map(
          (v) =>
            '<button class="key swatch c' +
            v +
            '" data-kind="1" data-value="' +
            v +
            '" aria-label="Farve ' +
            COLORS[v] +
            '" title="' +
            COLORS[v] +
            '"><span class="key-shape" aria-hidden="true"></span>' +
            placedMark +
            "</button>",
        ).join("") +
        "</div></section>") +
    newBoardPicker() +
    "</div>";
  refreshBoard();
}
function refreshBoard() {
  if (view !== "game") return;
  const { size } = puzzle;
  const chosen = game.board[selection];
  document.querySelectorAll("[data-cell]").forEach((button, i) => {
    const [n, c] = game.board[i],
      [gn, gc] = puzzle.givens[i];
    const related =
      preferences.related &&
      chosen &&
      (Math.floor(i / size) === Math.floor(selection / size) ||
        i % size === selection % size ||
        (n && n === chosen[0]) ||
        (c && c === chosen[1]));
    button.className = [
      "tile",
      "c" + c,
      i === selection ? "selected" : "",
      related ? "related" : "",
      errors.includes(i) ? "error" : "",
      hint?.i === i ? "hinted" : "",
    ].join(" ");
    button.setAttribute("aria-selected", i === selection);
    button.tabIndex = i === (selection < 0 ? 0 : selection) ? 0 : -1;
    button.setAttribute(
      "aria-label",
      coordinate(i, size) +
        ", " +
        (n || "ukendt tal") +
        (gn ? " låst" : "") +
        ", " +
        (COLORS[c] || "ukendt farve") +
        (gc ? " låst" : "") +
        (errors.includes(i) ? ", fejl" : ""),
    );
    button.innerHTML =
      '<span class="given ' +
      (gn ? "number " : "") +
      (gc ? "color" : "") +
      '" aria-hidden="true"></span><span aria-hidden="true">' +
      (n || "") +
      "</span>" +
      (preferences.symbols && c
        ? '<span class="shape" aria-hidden="true">' + symbols[c] + "</span>"
        : "");
  });
  document.querySelectorAll("[data-kind]").forEach((button) => {
    const k = Number(button.dataset.kind),
      v = Number(button.dataset.value);
    const allPlaced =
      game.board.filter((cell) => cell[k] === v).length === size;
    button.classList.toggle("all-placed", allPlaced);
    button.ariaDescription = allPlaced ? `Alle ${size} er placeret.` : null;
    button.disabled = !chosen || !!puzzle.givens[selection][k];
    button.setAttribute("aria-pressed", chosen?.[k] === v);
    if (k === 1)
      button.firstElementChild.textContent = preferences.symbols
        ? symbols[v]
        : "";
  });
  if (!game.won) {
    $('[data-action="undo"]').disabled = !game.history.length;
    $('[data-action="hint"] span').textContent =
      hint && !hint.error ? "Vis" : "Hint";
    $(".feedback").textContent = feedback;
  }
  updateHeader();
}
function clearFeedback() {
  clearTimeout(feedbackTimeout);
  feedback = "";
  hint = null;
  errors = [];
}
function say(message, transient = true) {
  clearTimeout(feedbackTimeout);
  feedback = message;
  $("#announcer").textContent = message;
  if (transient)
    feedbackTimeout = setTimeout(() => {
      feedback = "";
      refreshBoard();
    }, 4500);
  refreshBoard();
}
function select(i, focus = false) {
  if (i !== selection) clearFeedback();
  selection = i;
  refreshBoard();
  if (focus) document.querySelector('[data-cell="' + i + '"]').focus();
}
function setValue(k, v) {
  if (game.won || selection < 0 || puzzle.givens[selection][k]) return;
  const cell = game.board[selection];
  game.history.push({ i: selection, previous: [...cell] });
  cell[k] = cell[k] === v ? 0 : v;
  afterMove();
}
function afterMove() {
  clearFeedback();
  if (isComplete(game.board, puzzle.solution)) {
    stopClock();
    game.won = true;
    const wins = read("wins") || {};
    wins[game.key] = { ms: game.ms, level: game.level };
    write("wins", wins);
    persist();
    renderGame();
    openModal("win");
  } else {
    persist();
    refreshBoard();
    if (game.board.every((cell) => cell.every(Boolean))) check();
  }
}
function erase() {
  if (selection < 0 || game.won) return;
  const given = puzzle.givens[selection],
    cell = game.board[selection];
  if (cell.every((v, k) => v === given[k])) return;
  game.history.push({ i: selection, previous: [...cell] });
  game.board[selection] = [...given];
  afterMove();
}
function undo() {
  const last = game.history.pop();
  if (!last) return;
  game.board[last.i] = last.previous;
  selection = last.i;
  clearFeedback();
  persist();
  refreshBoard();
}
function check() {
  clearFeedback();
  errors = conflicts(game.board, puzzle.solution);
  say(
    errors.length
      ? (errors.length === 1
          ? "Ét felt skal rettes."
          : errors.length + " felter skal rettes.") + " Se efter ! på brættet."
      : "Alt passer indtil videre.",
  );
}
function giveHint() {
  if (hint && !hint.error) {
    const { i, k, value } = hint;
    selection = i;
    setValue(k, value);
    return;
  }
  clearFeedback();
  const wrong = conflicts(game.board, puzzle.solution);
  if (wrong.length) {
    selection = wrong[0];
    errors = [selection];
    hint = { i: selection, error: true };
    say(
      "Tjek " +
        coordinate(selection, puzzle.size) +
        ". " +
        (game.board[selection][0] !== 0 &&
        game.board[selection][0] !== puzzle.solution[selection][0]
          ? "Tallet"
          : "Farven") +
        " skal rettes.",
      false,
    );
    return;
  }
  hint = nextDeduction(game.board);
  if (!hint) return;
  selection = hint.i;
  const subject = hint.k ? COLORS[hint.value] : "tallet " + hint.value;
  const clues = {
    cell: "Kun " + (hint.k ? "én farve" : "ét tal") + " passer her.",
    row: "I denne række kan " + subject + " kun stå her.",
    column: "I denne kolonne kan " + subject + " kun stå her.",
    pair: "Et bestemt tal-farve-par kan kun stå her.",
  };
  game.hints++;
  persist();
  say(coordinate(selection, puzzle.size) + " · " + clues[hint.reason], false);
}

function raised(action, label) {
  return (
    '<button class="raised" data-action="' + action + '">' + label + "</button>"
  );
}
function menuItem(action, glyph, label) {
  return (
    '<button data-action="' +
    action +
    '">' +
    icon(glyph) +
    label +
    '<span class="chevron">' +
    icon("arrow") +
    "</span></button>"
  );
}
function sample(type) {
  return (
    '<div class="mini" aria-hidden="true">' +
    Array.from({ length: 16 }, (_, i) => {
      const r = i >> 2,
        c = i % 4;
      const n = (r ^ c) + 1,
        color = ([0, 2, 3, 1][r] ^ c) + 1;
      const paint =
        (type === 1 && c === 1) || (type === 2 && n === 1) ? color : 0;
      return (
        '<span class="mini-cell c' +
        paint +
        '">' +
        ((type === 0 && r === 0) || (type === 2 && n === 1) ? n : "") +
        "</span>"
      );
    }).join("") +
    "</div>"
  );
}
function stat(value, label) {
  return (
    '<div class="stat"><b>' + value + "</b><small>" + label + "</small></div>"
  );
}
function statistics() {
  const wins = read("wins") || {};
  const days = Object.keys(wins).filter((key) => !key.startsWith("fri-"));
  let cursor = dayKey(new Date()),
    streak = 0;
  if (!wins[cursor]) cursor = plusDays(cursor, -1);
  while (wins[cursor]) {
    streak++;
    cursor = plusDays(cursor, -1);
  }
  const best = days.length
    ? timeText(Math.min(...days.map((k) => wins[k].ms)))
    : "–";
  const practices = Object.keys(wins).length - days.length;
  return (
    '<div class="stat-grid">' +
    stat(days.length, "Daglige løst") +
    stat(streak, "Dage i træk") +
    stat(best, "Bedste tid") +
    '</div><p class="detail">Frie spil løst: ' +
    practices +
    ". Statistikken gemmes i denne browser.</p>"
  );
}
function switchRow(key, label, note) {
  return (
    '<label class="setting"><span><strong>' +
    label +
    "</strong><small>" +
    note +
    '</small></span><input type="checkbox" role="switch" data-setting="' +
    key +
    '"' +
    (preferences[key] ? " checked" : "") +
    "></label>"
  );
}
function openModal(type) {
  if (!dialog.open) stopClock();
  let title, body;
  const done =
    '<div class="dialog-actions">' + raised("close", "Færdig") + "</div>";
  switch (type) {
    case "menu":
      title = "Menu";
      body =
        '<nav class="menu-list">' +
        menuItem("today", "calendar", "Dagens opgave") +
        menuItem("week", "calendar", "Ugens opgaver") +
        menuItem("practice", "dice", "Frit spil") +
        menuItem("rules", "help", "Spilleregler") +
        menuItem("stats", "stats", "Din statistik") +
        '</nav><p class="credit">Potu er inspireret af <a href="https://playtupo.com/" target="_blank" rel="noreferrer">Tupo</a> af Josh Collinsworth.</p>';
      break;
    case "rules":
      title = "Sådan spiller du";
      body =
        "<p>Giv hvert felt et tal og en farve. Let og Mellem har 4 × 4 felter. Svær og Ekspert har 5 × 5.</p>" +
        [
          [
            "Ét af hvert tal",
            "Brug hvert tal én gang i hver række og kolonne. På det store bræt er 5 også med.",
          ],
          [
            "Én af hver farve",
            "Brug hver farve én gang i hver række og kolonne. På det store bræt er lilla den femte farve.",
          ],
          [
            "Hvert par er unikt",
            "Et tal må kun have samme farve ét sted på hele brættet.",
          ],
        ]
          .map(
            ([label, text], i) =>
              '<div class="rule">' +
              sample(i) +
              "<div><strong>" +
              label +
              "</strong><p>" +
              text +
              "</p></div></div>",
          )
          .join("") +
        '<p class="note">Prik ● betyder låst tal. Ring ○ betyder låst farve. Vælg et felt, og tryk på et tal eller en farve. Tryk igen for at fjerne det.</p>' +
        '<p class="detail">Brug piletasterne til at vælge felt og taltasterne til at sætte tal. B/G/Y/R vælger blå, grøn, gul og rød. P vælger lilla på det store bræt. Slet rydder feltet. Ctrl/⌘ + Z fortryder.</p>' +
        '<div class="dialog-actions">' +
        raised("tutorial", "Prøv et træk") +
        '<button class="link-button" data-action="close">Tilbage</button></div>';
      break;
    case "tutorial": {
      title = "Prøv et træk";
      const solved = tutorialStep === 2;
      body =
        "<p>" +
        [
          "Rækken mangler ét tal. Hvilket tal skal stå i det sidste felt?",
          "Rækken mangler også en farve. Hvilken farve skal 4-tallet have?",
          "Sådan! Nu har rækken alle fire tal og farver.",
        ][tutorialStep] +
        '</p><div class="example-row">' +
        [1, 2, 3, 4]
          .map(
            (v) =>
              '<span class="example c' +
              (v === 4 && !solved ? 0 : v) +
              '">' +
              (v === 4 && !tutorialStep ? "?" : v) +
              "</span>",
          )
          .join("") +
        "</div>" +
        (solved
          ? '<div class="dialog-actions">' +
            raised("close", "Klar til at spille") +
            "</div>"
          : '<div class="example-choices">' +
            VALUES.map(
              (v) =>
                '<button data-lesson="' +
                v +
                '" class="raised ' +
                (tutorialStep ? "c" + v : "") +
                '">' +
                (tutorialStep ? COLORS[v] : v) +
                "</button>",
            ).join("") +
            '</div><p id="lesson-message" role="status"></p>');
      break;
    }
    case "settings":
      title = "Indstillinger";
      body =
        switchRow(
          "symbols",
          "Symboler på farver",
          "Giv hver farve sit eget tegn.",
        ) +
        switchRow("timer", "Vis tid", "Se spilletiden over brættet.") +
        switchRow(
          "related",
          "Fremhæv felter",
          "Vis samme række, kolonne, tal og farve.",
        ) +
        '<label class="setting"><strong>Udseende</strong><select id="theme">' +
        [
          ["system", "System"],
          ["light", "Lyst"],
          ["dark", "Mørkt"],
        ]
          .map(
            ([key, label]) =>
              '<option value="' +
              key +
              '"' +
              (preferences.theme === key ? " selected" : "") +
              ">" +
              label +
              "</option>",
          )
          .join("") +
        "</select></label>" +
        done;
      break;
    case "stats":
      title = "Din statistik";
      body = statistics() + done;
      break;
    case "practice": {
      title = "Frit spil";
      const p = read("practice");
      const resume =
        p && !read("game." + p.key)?.won
          ? menuItem("resume-practice", "play", "Fortsæt dit frie spil")
          : "";
      body = (resume ? '<div class="menu-list">' + resume + "</div>" : "") + newBoardPicker();
      break;
    }
    case "pause":
      title = "På pause";
      body =
        '<p>Tiden er stoppet. Dit bræt er gemt.</p><div class="dialog-actions">' +
        raised("close", "Spil videre") +
        '<button class="link-button" data-action="home">Til forsiden</button></div>';
      break;
    case "win":
      title = "Brættet er løst!";
      body =
        '<div class="result">' +
        brand(false) +
        `<p>Alle ${game.board.length} par er på plads.</p><p><strong>` +
        LEVELS[game.level] +
        " · " +
        timeText(game.ms) +
        '</strong></p></div><div class="dialog-actions">' +
        raised("home", "Til forsiden") +
        '<button class="link-button" data-action="close">Se brættet</button></div>';
      break;
    default:
      return;
  }
  $("#dialog-title").textContent = title;
  $("#dialog-body").innerHTML = body;
  if (!dialog.open) dialog.showModal();
  else $(".close").focus();
  dialog.scrollTop = 0;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const {
    action,
    cell,
    kind,
    value,
    day: chosenDay,
    level,
    lesson,
  } = button.dataset;
  if (chosenDay) {
    day = chosenDay;
    showHome();
    document.querySelector('[data-day="' + day + '"]').focus();
    return;
  }
  if (cell !== undefined) {
    select(Number(cell));
    return;
  }
  if (kind !== undefined) {
    setValue(Number(kind), Number(value));
    return;
  }
  if (level !== undefined) {
    startGame("fri-" + crypto.randomUUID(), Number(level));
    return;
  }
  if (lesson !== undefined) {
    if (Number(lesson) === 4) {
      tutorialStep++;
      openModal("tutorial");
    } else
      $("#lesson-message").textContent =
        "Prøv igen. Den er allerede med i rækken.";
    return;
  }
  switch (action) {
    case "start":
      startGame(day, dayLevels[weekDay(day)]);
      break;
    case "resume-practice": {
      const p = read("practice");
      startGame(p.key, p.level);
      break;
    }
    case "today":
    case "week":
      day = dayKey(new Date());
      showHome(true);
      if (action === "week") $(".day[aria-pressed=true]").focus();
      break;
    case "home":
      showHome(true);
      break;
    case "check":
      check();
      break;
    case "undo":
      undo();
      break;
    case "hint":
      giveHint();
      break;
    case "dismiss":
      clearFeedback();
      refreshBoard();
      break;
    case "close":
      dialog.close();
      break;
    case "tutorial":
      tutorialStep = 0;
      openModal("tutorial");
      break;
    case "settings":
    case "stats":
    case "rules":
    case "menu":
    case "practice":
    case "pause":
      openModal(action);
      break;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.dataset.setting)
    preferences[event.target.dataset.setting] = event.target.checked;
  else if (event.target.id === "theme") preferences.theme = event.target.value;
  else return;
  write("options", preferences);
  applyTheme();
  refreshBoard();
  updateHeader();
});
document.addEventListener("keydown", (event) => {
  if (view !== "game" || dialog.open || event.altKey) return;
  const key = event.key.toLowerCase();
  const { size, values } = puzzle;
  if (event.ctrlKey || event.metaKey) {
    if (key === "z" && !event.shiftKey && !game.won) {
      event.preventDefault();
      undo();
    }
    return;
  }
  if (
    key.startsWith("arrow") &&
    (event.target === main || event.target.closest(".board"))
  ) {
    let i = selection < 0 ? 0 : selection;
    if (selection >= 0) {
      if (key === "arrowright" && i % size < size - 1) i++;
      if (key === "arrowleft" && i % size > 0) i--;
      if (key === "arrowup" && i >= size) i -= size;
      if (key === "arrowdown" && i + size < game.board.length) i += size;
    }
    if (i !== selection) {
      event.preventDefault();
      select(i, true);
    }
    return;
  }
  if (game.won) return;
  if (key === "escape") {
    event.preventDefault();
    openModal("pause");
    return;
  }
  if (selection < 0 || !event.target.closest("main")) return;
  if (values.includes(Number(key))) {
    event.preventDefault();
    setValue(0, Number(key));
  }
  const colorKeys = { b: 1, g: 2, y: 3, r: 4, p: 5 };
  if (values.includes(colorKeys[key])) {
    event.preventDefault();
    setValue(1, colorKeys[key]);
  }
  if (key === "backspace" || key === "delete") {
    event.preventDefault();
    erase();
  }
});
main.addEventListener("focusin", (event) => {
  if (event.target.dataset.cell !== undefined)
    select(Number(event.target.dataset.cell));
});
dialog.addEventListener("close", startClock);
let lastToday = dayKey(new Date());
function checkDate() {
  const today = dayKey(new Date());
  if (lastToday !== today && view === "home") {
    day = today;
    showHome();
  }
  lastToday = today;
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && view === "game" && !game.won && !dialog.open)
    openModal("pause");
  else if (!document.hidden) {
    checkDate();
    startClock();
  }
});
window.addEventListener("pagehide", stopClock);
window.addEventListener("pageshow", startClock);
systemDark.addEventListener("change", applyTheme);
setInterval(() => {
  checkDate();
  updateHeader();
}, 1000);
setInterval(() => {
  if (activeSince !== null) persist();
}, 5000);
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon);
});
applyTheme();
showHome();
