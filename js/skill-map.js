// Skill map screen: mastery per skill, review dates, what's next, and the
// mistakes the player makes most often.

import { SKILLS, SKILL_BY_ID } from "./skills.js";
import { skillState, isMastered, isUnlocked, isDue, masteredCount, dueCount, UNLOCKED, DAY } from "./learner.js";
import { pickNext } from "./scheduler.js";
import { MISTAKE_LABELS } from "./diagnose.js";

function statusOf(learner, id, now) {
  const state = skillState(learner, id);
  if (isDue(state, now)) return { key: "due", icon: "⟳", text: "review due" };
  if (isMastered(state)) {
    const days = Math.max(1, Math.round((state.due - now) / DAY));
    return { key: "mastered", icon: "✓", text: `mastered · review in ${days} day${days === 1 ? "" : "s"}` };
  }
  if (!isUnlocked(learner, id)) {
    const first = SKILL_BY_ID[id].requires.filter((parent) => skillState(learner, parent).mastery < UNLOCKED);
    return { key: "locked", icon: "🔒", text: `first: ${first.map((p) => SKILL_BY_ID[p].name).join(", ")}` };
  }
  if (!state.attempts) return { key: "new", icon: "○", text: "not started" };
  return { key: "learning", icon: "•", text: `learning · ${state.attempts} tr${state.attempts === 1 ? "y" : "ies"}` };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderSkillMap(root, learner, now = Date.now()) {
  root.innerHTML = "";
  const next = pickNext(learner, { now });
  const due = dueCount(learner, now);
  root.appendChild(
    el(
      "p",
      "skills-summary",
      `${masteredCount(learner)}/${SKILLS.length} mastered · ${due} review${due === 1 ? "" : "s"} due · next up: ${SKILL_BY_ID[next.skill].name}`
    )
  );

  const list = el("div", "skills-list");
  for (const skill of SKILLS) {
    const state = skillState(learner, skill.id);
    const status = statusOf(learner, skill.id, now);
    const row = el("div", `skill-row ${status.key}`);
    row.appendChild(el("span", "skill-icon", status.icon));

    const main = el("div", "skill-main");
    main.appendChild(el("div", "skill-name", skill.name));
    main.appendChild(el("div", "skill-status", status.text));
    row.appendChild(main);

    const bar = el("div", "skill-bar");
    const fill = el("div", "skill-fill");
    fill.style.width = `${Math.round(state.mastery * 100)}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el("span", "skill-pct", `${Math.round(state.mastery * 100)}%`));

    const button = el("button", "terminal-button secondary skill-practice", "practice");
    button.dataset.action = "practice-skill";
    button.dataset.skill = skill.id;
    button.title = skill.learn;
    row.appendChild(button);
    list.appendChild(row);
  }
  root.appendChild(list);

  const mistakes = Object.entries(learner.mistakes)
    .filter(([kind]) => kind !== "mismatch")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (mistakes.length) {
    root.appendChild(el("h3", "", "Your most common mistakes"));
    const ul = el("ul", "skills-mistakes");
    for (const [kind, count] of mistakes) ul.appendChild(el("li", "", `${MISTAKE_LABELS[kind] || kind} ×${count}`));
    root.appendChild(ul);
  }
}
