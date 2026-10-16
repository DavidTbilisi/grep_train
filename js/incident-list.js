// Incidents screen: one card per scenario, with whether the player has the
// skills for it yet, and a suggestion for which one to try next.

import { SCENARIOS, scenarioSkills } from "./incidents.js";
import { SKILL_BY_ID } from "./skills.js";
import { skillState, UNLOCKED } from "./learner.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Skills the player hasn't got far enough with for this scenario.
export function missingSkills(learner, id) {
  return scenarioSkills(id).filter((skill) => skillState(learner, skill).mastery < UNLOCKED);
}

export function renderIncidentList(root, learner) {
  root.innerHTML = "";
  // Suggest the first scenario the player is ready for but hasn't solved.
  const suggested = SCENARIOS.find((s) => !learner.incidents[s.id] && !missingSkills(learner, s.id).length);

  for (const scenario of SCENARIOS) {
    const record = learner.incidents[scenario.id];
    const missing = missingSkills(learner, scenario.id);
    const card = el("div", `incident-card${scenario === suggested ? " suggested" : ""}`);

    const head = el("div", "incident-head");
    head.appendChild(el("h3", "", scenario.title));
    if (scenario === suggested) head.appendChild(el("span", "incident-badge", "suggested"));
    if (record) head.appendChild(el("span", "incident-badge done", `solved ×${record.completed} · best ${record.best} pts`));
    card.appendChild(head);
    card.appendChild(el("p", "incident-teaser", scenario.teaser));
    card.appendChild(
      el(
        "p",
        `incident-skills${missing.length ? " missing" : ""}`,
        missing.length
          ? `Practise first: ${missing.map((id) => SKILL_BY_ID[id].name).join(", ")}`
          : `Uses: ${scenarioSkills(scenario.id).map((id) => SKILL_BY_ID[id].name).join(", ")}`
      )
    );

    const button = el("button", "terminal-button secondary incident-start", record ? "investigate again" : "investigate");
    button.dataset.action = "incident";
    button.dataset.scenario = scenario.id;
    card.appendChild(button);
    root.appendChild(card);
  }
}
