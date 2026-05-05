let tasks = [];
let sortState = { key: "dueDate", direction: "asc" };
let editingTaskId = "";
let expandedTaskId = "";
let toastTimer;
const openSpaces = new Set(JSON.parse(localStorage.getItem("taskOpenSpaces") || '["Tasks"]'));

const DEFAULT_TEAMS = ["Admin", "Client Success", "Data Science", "Hamid", "IT", "Product", "Suhail"];

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

const board = document.querySelector("#board");
const taskForm = document.querySelector("#taskForm");
const formPanel = document.querySelector("#formPanel");
const formTitle = document.querySelector("#formTitle");
const openTaskFormBtn = document.querySelector("#openTaskFormBtn");
const teamSelect = document.querySelector("#teamSelect");
const teamCustom = document.querySelector("#teamCustom");
const teamFilter = document.querySelector("#teamFilter");
const priorityFilter = document.querySelector("#priorityFilter");
const searchInput = document.querySelector("#searchInput");
const textSizeButtons = document.querySelectorAll(".text-size-btn");
const toast = document.querySelector("#toast");

function dbToTask(row) {
  return {
    id: row.id,
    title: row.title,
    team: row.team || "",
    poc: row.poc || "",
    status: row.status || "Backlog",
    priority: row.priority || "Medium",
    dueDate: row.due_date || "",
    notes: row.notes || "",
    updatedAt: row.updated_at
  };
}

function taskToDb(task) {
  return {
    title: task.title,
    team: task.team || null,
    poc: task.poc || null,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate || null,
    notes: task.notes || null,
    updated_at: new Date().toISOString()
  };
}

function allTeams() {
  return [...new Set([...DEFAULT_TEAMS, ...tasks.map(task => task.team).filter(Boolean)])].sort();
}

function teamSelectOptions(selectedTeam = "", includeAdd = true) {
  const teams = allTeams();
  const knownTeam = !selectedTeam || selectedTeam === "__add__" || teams.includes(selectedTeam);
  const options = teams.map(team => `
    <option value="${escapeHtml(team)}" ${team === selectedTeam ? "selected" : ""}>${escapeHtml(team)}</option>
  `).join("");
  const customOption = selectedTeam && !knownTeam
    ? `<option value="${escapeHtml(selectedTeam)}" selected>${escapeHtml(selectedTeam)}</option>`
    : "";
  const addOption = includeAdd ? `<option value="__add__" ${selectedTeam === "__add__" ? "selected" : ""}>Add team</option>` : "";
  return `${options}${customOption}${addOption}`;
}

function syncTeamCustom() {
  const adding = teamSelect.value === "__add__";
  teamCustom.classList.toggle("is-hidden", !adding);
  if (adding) teamCustom.focus();
}

function selectedFormTeam() {
  return teamSelect.value === "__add__" ? teamCustom.value.trim() : teamSelect.value;
}

function setTextSize(size) {
  const allowedSizes = ["xs", "sm", "md", "lg"];
  const nextSize = allowedSizes.includes(size) ? size : "sm";
  document.body.dataset.textSize = nextSize;
  localStorage.setItem("taskTextSize", nextSize);

  textSizeButtons.forEach(button => {
    const active = button.dataset.size === nextSize;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function persistOpenSpaces() {
  localStorage.setItem("taskOpenSpaces", JSON.stringify([...openSpaces]));
}

function smoothRender() {
  if (document.startViewTransition) {
    document.startViewTransition(() => render());
    return;
  }

  render();
}

function replaceTask(id, updates) {
  tasks = tasks.map(task => task.id === id ? { ...task, ...updates } : task);
}

function taskSnapshot() {
  return tasks.map(task => ({ ...task }));
}

function restoreTasks(snapshot, message) {
  tasks = snapshot;
  smoothRender();
  if (message) showToast(message);
}

async function loadTasks() {
  if (
    !window.SUPABASE_URL ||
    !window.SUPABASE_ANON_KEY ||
    window.SUPABASE_URL.includes("PASTE_") ||
    window.SUPABASE_ANON_KEY.includes("PASTE_")
  ) {
    board.innerHTML = `
      <div class="empty">
        Add your Supabase URL and anon key in <code>config.js</code>, then refresh.
      </div>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    board.innerHTML = `<div class="empty">Could not load tasks: ${escapeHtml(error.message)}</div>`;
    return;
  }

  tasks = data.map(dbToTask);
  render();
}

function getFormTask() {
  const existingTask = tasks.find(task => task.id === document.querySelector("#taskId").value);

  return {
    id: document.querySelector("#taskId").value || "",
    title: document.querySelector("#title").value.trim(),
    team: selectedFormTeam(),
    poc: document.querySelector("#poc").value.trim(),
    status: existingTask?.status || "Backlog",
    priority: document.querySelector("#priority").value,
    dueDate: document.querySelector("#dueDate").value,
    notes: document.querySelector("#notes").value.trim(),
    updatedAt: new Date().toISOString()
  };
}

function fillForm(task) {
  document.querySelector("#taskId").value = task.id;
  document.querySelector("#title").value = task.title || "";
  teamSelect.innerHTML = teamSelectOptions(task.team || "");
  teamSelect.value = allTeams().includes(task.team) ? task.team : (task.team || "Admin");
  teamCustom.value = allTeams().includes(task.team) ? "" : task.team || "";
  syncTeamCustom();
  document.querySelector("#poc").value = task.poc || "";
  document.querySelector("#priority").value = task.priority || "Medium";
  document.querySelector("#dueDate").value = task.dueDate || "";
  document.querySelector("#notes").value = task.notes || "";
  document.querySelector("#saveBtn").textContent = "Update task";
  formTitle.textContent = "Edit Task";
  openTaskForm();
}

function resetForm() {
  taskForm.reset();
  document.querySelector("#taskId").value = "";
  teamSelect.innerHTML = teamSelectOptions("Admin");
  teamSelect.value = "Admin";
  teamCustom.value = "";
  syncTeamCustom();
  document.querySelector("#priority").value = "Medium";
  document.querySelector("#saveBtn").textContent = "Save task";
  formTitle.textContent = "Add Task";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function todayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(task) {
  return Boolean(task.dueDate && task.dueDate < todayString() && task.status !== "Done");
}

function priorityRank(priority) {
  return { High: 0, Medium: 1, Low: 2 }[priority] ?? 3;
}

function sortLabel(key, label) {
  if (sortState.key !== key) return label;
  return `${label} ${sortState.direction === "asc" ? "^" : "v"}`;
}

function openTaskForm() {
  formPanel.classList.remove("is-hidden");
  formPanel.setAttribute("aria-hidden", "false");
  openTaskFormBtn.textContent = "Cancel";
  openTaskFormBtn.classList.add("danger");
  document.querySelector("#title").focus();
}

function closeTaskForm() {
  formPanel.classList.add("is-hidden");
  formPanel.setAttribute("aria-hidden", "true");
  openTaskFormBtn.textContent = "Add task";
  openTaskFormBtn.classList.remove("danger");
}

function toggleTaskForm() {
  if (formPanel.classList.contains("is-hidden")) {
    resetForm();
    openTaskForm();
    return;
  }

  resetForm();
  closeTaskForm();
}

function filteredTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const team = teamFilter.value;
  const priority = priorityFilter.value;

  return tasks.filter(task => {
    const matchesQuery = !query || [task.title, task.team, task.poc, task.notes]
      .some(value => (value || "").toLowerCase().includes(query));

    const matchesTeam = !team || task.team === team;
    const matchesPriority = !priority || task.priority === priority;

    return matchesQuery && matchesTeam && matchesPriority;
  });
}

function updateTeamFilter() {
  const current = teamFilter.value;
  const teams = allTeams();

  teamFilter.innerHTML = '<option value="">All teams</option>' + teams
    .map(team => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`)
    .join("");

  teamFilter.value = teams.includes(current) ? current : "";
}

function render() {
  updateTeamFilter();
  const visible = filteredTasks();
  const mainTasks = sortTasks(visible.filter(task => task.status !== "Later" && task.status !== "Done"));
  const laterTasks = sortTasks(visible.filter(task => task.status === "Later"));
  const doneTasks = sortTasks(visible.filter(task => task.status === "Done"));

  board.innerHTML = visible.length
    ? [
      renderTaskSpace("Tasks", mainTasks, "No active tasks match this view."),
      renderTaskSpace("Do Later", laterTasks, "No later tasks yet."),
      renderTaskSpace("Done", doneTasks, "No completed tasks yet.")
    ].join("")
    : '<div class="empty">No tasks match this view.</div>';
}

function sortTasks(taskList) {
  return taskList.sort((a, b) => {
    if (sortState.key) {
      return compareByColumn(a, b);
    }

    const byDate = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    if (byDate !== 0) return byDate;

    return (a.title || "").localeCompare(b.title || "");
  });
}

function compareByColumn(a, b) {
  const direction = sortState.direction === "asc" ? 1 : -1;
  let comparison = 0;

  if (sortState.key === "priority") {
    comparison = priorityRank(a.priority) - priorityRank(b.priority);
  } else if (sortState.key === "dueDate") {
    comparison = (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  } else {
    comparison = (a[sortState.key] || "").localeCompare(b[sortState.key] || "");
  }

  if (comparison !== 0) return comparison * direction;
  return (a.title || "").localeCompare(b.title || "");
}

function changeSort(key) {
  if (sortState.key === key) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
  } else {
    sortState = { key, direction: "asc" };
  }

  smoothRender();
}

function renderTaskSpace(title, taskList, emptyText) {
  const openAttr = openSpaces.has(title) ? " open" : "";

  return `
    <details class="task-space"${openAttr} data-space="${escapeHtml(title)}">
      <summary class="space-title-row">
        <h2>${escapeHtml(title)}</h2>
        <span>${taskList.length}</span>
      </summary>
      <div class="task-table">
        <div class="task-table-head">
          <button type="button" onclick="changeSort('title')">${escapeHtml(sortLabel("title", "Task"))}</button>
          <button type="button" onclick="changeSort('team')">${escapeHtml(sortLabel("team", "Team"))}</button>
          <button type="button" onclick="changeSort('poc')">${escapeHtml(sortLabel("poc", "POC"))}</button>
          <button type="button" onclick="changeSort('priority')">${escapeHtml(sortLabel("priority", "Priority"))}</button>
          <button type="button" onclick="changeSort('dueDate')">${escapeHtml(sortLabel("dueDate", "Date"))}</button>
          <span aria-hidden="true"></span>
        </div>
        <div class="task-table-body">
          ${taskList.length ? taskList.map(renderTask).join("") : `<div class="empty">${escapeHtml(emptyText)}</div>`}
        </div>
      </div>
    </details>
  `;
}

function renderTask(task) {
  if (editingTaskId === task.id) return renderEditableTask(task);

  const priorityClass = `priority-${(task.priority || "medium").toLowerCase()}`;
  const overdue = isOverdue(task);
  const dateLabel = task.dueDate ? formatDate(task.dueDate) : "No date";
  const doneHoverButton = task.status !== "Done"
    ? `<button class="done-hover" type="button" aria-label="Mark ${escapeHtml(task.title)} done" onclick="quickDone(event, '${task.id}')"></button>`
    : "";
  const laterHoverButton = task.status !== "Done" && task.status !== "Later"
    ? `<button class="later-hover" type="button" aria-label="Do ${escapeHtml(task.title)} later" onclick="quickLater(event, '${task.id}')"></button>`
    : "";
  const undoHoverButton = task.status === "Done"
    ? `<button class="undo-hover" type="button" aria-label="Mark ${escapeHtml(task.title)} undone" onclick="quickUndone(event, '${task.id}')"></button>`
    : "";
  const taskHoverButton = task.status === "Later"
    ? `<button class="task-hover" type="button" aria-label="Move ${escapeHtml(task.title)} to tasks" onclick="quickTask(event, '${task.id}')"></button>`
    : "";
  const editHoverButton = `<button class="edit-hover" type="button" aria-label="Edit ${escapeHtml(task.title)}" onclick="startTaskEdit(event, '${task.id}')"></button>`;

  return `
    <details class="task-row ${overdue ? "is-overdue" : ""} ${task.notes ? "has-notes-row" : "no-notes-row"}" data-task-id="${task.id}" ${expandedTaskId === task.id ? "open" : ""}>
      <summary class="task-summary" ${task.notes ? "" : `onclick="blockEmptyNotesExpand(event)"`}>
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span>${escapeHtml(task.team || "-")}</span>
        <span>${escapeHtml(task.poc || "-")}</span>
        <span><span class="badge ${priorityClass}">${escapeHtml(task.priority || "Medium")}</span></span>
        <span class="date-cell">
          <span class="date-label">${escapeHtml(dateLabel)}</span>
          ${overdue ? `<span class="overdue-label">Overdue</span>` : ""}
        </span>
        <span class="row-actions">
          ${laterHoverButton}
          ${taskHoverButton}
          ${editHoverButton}
          ${doneHoverButton}
          ${undoHoverButton}
        </span>
      </summary>
      <div class="task-details">
        <div class="expanded-notes" id="notesView-${task.id}">
          <div class="expanded-notes-title">Notes</div>
          <button class="expanded-note-text" type="button" onclick="startExpandedNotes(event, '${task.id}')">${task.notes ? escapeHtml(task.notes) : "No notes yet."}</button>
        </div>
      </div>
    </details>
  `;
}

function renderEditableTask(task) {
  const customTeam = task.team && !allTeams().includes(task.team);
  return `
    <details class="task-row is-editing" open data-task-id="${task.id}">
      <summary class="task-summary">
        <span><input id="edit-title-${task.id}" value="${escapeHtml(task.title)}" /></span>
        <span>
          <select id="edit-team-${task.id}" onchange="toggleInlineTeam('${task.id}')">
            ${teamSelectOptions(customTeam ? "__add__" : task.team || "Admin")}
          </select>
          <input id="edit-team-custom-${task.id}" class="${customTeam ? "" : "is-hidden"}" value="${customTeam ? escapeHtml(task.team) : ""}" placeholder="New team" />
        </span>
        <span><input id="edit-poc-${task.id}" value="${escapeHtml(task.poc)}" /></span>
        <span>
          <select id="edit-priority-${task.id}">
            ${["High", "Medium", "Low"].map(priority => `
              <option ${priority === (task.priority || "Medium") ? "selected" : ""}>${priority}</option>
            `).join("")}
          </select>
        </span>
        <span class="edit-date-cell" onpointerdown="openEditDate(event, '${task.id}')"><input id="edit-date-${task.id}" type="date" value="${escapeHtml(task.dueDate)}" /></span>
        <span class="row-actions">
          <button class="cancel-edit-hover" type="button" aria-label="Cancel editing" onclick="cancelTaskEdit(event)"></button>
          <button class="delete-edit-hover" type="button" aria-label="Delete task" onclick="deleteTask(event, '${task.id}')"></button>
        </span>
      </summary>
      <div class="task-details">
        <form class="expanded-notes-form" onsubmit="saveTaskEdit(event, '${task.id}')">
          <textarea id="edit-notes-${task.id}" rows="6" placeholder="Add detailed notes...">${escapeHtml(task.notes)}</textarea>
          <div class="inline-actions">
            <button type="submit">Save task</button>
            <button class="secondary" type="button" onclick="cancelTaskEdit(event)">Cancel</button>
          </div>
        </form>
      </div>
    </details>
  `;
}

async function upsertTask(task) {
  const payload = taskToDb(task);

  let result;
  if (task.id) {
    result = await supabaseClient
      .from("tasks")
      .update(payload)
      .eq("id", task.id)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from("tasks")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    alert(`Could not save task: ${result.error.message}`);
    return;
  }

  const savedTask = dbToTask(result.data);
  if (task.id) {
    replaceTask(task.id, savedTask);
  } else {
    tasks = [savedTask, ...tasks];
    openSpaces.add("Tasks");
    persistOpenSpaces();
  }
  smoothRender();
  showToast(task.id ? "Task updated" : "Task added");
}

function closeOtherTaskRows(currentRow) {
  document.querySelectorAll(".task-row[open]").forEach(row => {
    if (row !== currentRow) row.open = false;
  });
  expandedTaskId = currentRow?.dataset.taskId || "";
}

function startTaskEdit(event, id) {
  event.preventDefault();
  event.stopPropagation();
  editingTaskId = id;
  expandedTaskId = "";
  smoothRender();
}

function cancelTaskEdit(event) {
  event?.preventDefault();
  event?.stopPropagation();
  editingTaskId = "";
  smoothRender();
}

function toggleInlineTeam(id) {
  const select = document.querySelector(`#edit-team-${CSS.escape(id)}`);
  const custom = document.querySelector(`#edit-team-custom-${CSS.escape(id)}`);
  if (!select || !custom) return;
  custom.classList.toggle("is-hidden", select.value !== "__add__");
  if (select.value === "__add__") custom.focus();
}

function openEditDate(event, id) {
  openDateInput(event, document.querySelector(`#edit-date-${CSS.escape(id)}`));
}

function openDateInput(event, input) {
  event.preventDefault();
  event.stopPropagation();
  if (!input) return;
  input.focus({ preventScroll: true });
  if (input.showPicker) {
    input.showPicker();
    return;
  }
  input.click();
}

function openFormDate(event) {
  openDateInput(event, document.querySelector("#dueDate"));
}

async function saveTaskEdit(event, id) {
  event.preventDefault();
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  const teamValue = document.querySelector(`#edit-team-${CSS.escape(id)}`).value;
  const customTeam = document.querySelector(`#edit-team-custom-${CSS.escape(id)}`).value.trim();
  const title = document.querySelector(`#edit-title-${CSS.escape(id)}`).value.trim();

  if (!title) {
    alert("Task name cannot be empty.");
    return;
  }

  const payload = {
    title,
    team: teamValue === "__add__" ? customTeam || null : teamValue || null,
    poc: document.querySelector(`#edit-poc-${CSS.escape(id)}`).value.trim() || null,
    priority: document.querySelector(`#edit-priority-${CSS.escape(id)}`).value,
    due_date: document.querySelector(`#edit-date-${CSS.escape(id)}`).value || null,
    notes: document.querySelector(`#edit-notes-${CSS.escape(id)}`).value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from("tasks").update(payload).eq("id", id);
  if (error) {
    alert(`Could not save task: ${error.message}`);
    return;
  }

  replaceTask(id, {
    title: payload.title,
    team: payload.team || "",
    poc: payload.poc || "",
    priority: payload.priority,
    dueDate: payload.due_date || "",
    notes: payload.notes || "",
    updatedAt: payload.updated_at
  });
  editingTaskId = "";
  expandedTaskId = payload.notes ? id : "";
  smoothRender();
  showToast("Task saved");
}

function editTask(id) {
  editingTaskId = id;
  expandedTaskId = "";
  smoothRender();
}

async function deleteTask(event, id) {
  event?.preventDefault();
  event?.stopPropagation();

  const task = tasks.find(item => item.id === id);
  const noteWarning = task?.notes ? " This will also delete its notes." : "";
  const confirmed = window.confirm(`Delete "${task?.title || "this task"}"?${noteWarning}`);
  if (!confirmed) return;

  const snapshot = taskSnapshot();
  tasks = tasks.filter(task => task.id !== id);
  if (editingTaskId === id) editingTaskId = "";
  if (expandedTaskId === id) expandedTaskId = "";
  smoothRender();

  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) {
    restoreTasks(snapshot, `Could not delete task: ${error.message}`);
    return;
  }
  showToast("Task deleted");
}

async function markDone(id) {
  await updateTaskStatus(id, "Done", "Task completed");
}

async function quickDone(event, id) {
  event.preventDefault();
  event.stopPropagation();
  await markDone(id);
}

async function quickLater(event, id) {
  event.preventDefault();
  event.stopPropagation();
  await markLater(id);
}

async function quickUndone(event, id) {
  event.preventDefault();
  event.stopPropagation();
  await markUndone(id);
}

async function quickTask(event, id) {
  event.preventDefault();
  event.stopPropagation();
  await markTask(id);
}

async function markLater(id) {
  await updateTaskStatus(id, "Later", "Moved to later");
}

async function markTask(id) {
  await updateTaskStatus(id, "Backlog", "Moved to tasks");
}

async function markUndone(id) {
  await updateTaskStatus(id, "Backlog", "Marked undone");
}

async function updateTaskStatus(id, status, successMessage) {
  const snapshot = taskSnapshot();
  const updatedAt = new Date().toISOString();
  replaceTask(id, { status, updatedAt });
  if (expandedTaskId === id && status !== "Backlog") expandedTaskId = "";
  persistOpenSpaces();
  smoothRender();

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status, updated_at: updatedAt })
    .eq("id", id);

  if (error) {
    restoreTasks(snapshot, `Could not update task: ${error.message}`);
    return;
  }

  showToast(successMessage);
}

function startNotes(event, id) {
  event.preventDefault();
  event.stopPropagation();

  const row = event.target.closest(".task-row");
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  if (row && task.notes) {
    row.open = true;
    closeOtherTaskRows(row);
    return;
  }

  if (row) {
    row.open = true;
    closeOtherTaskRows(row);
  }
  startExpandedNotes(event, id);
}

function blockEmptyNotesExpand(event) {
  if (event.target.closest(".done-hover, .later-hover, .task-hover, .undo-hover, .edit-hover")) return;
  event.preventDefault();
}

function handleNotesKey(event, id) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  startNotes(event, id);
}

function startExpandedNotes(event, id) {
  event.preventDefault();
  event.stopPropagation();

  const task = tasks.find(item => item.id === id);
  const notesView = document.querySelector(`#notesView-${CSS.escape(id)}`);
  if (!task || !notesView) return;

  notesView.innerHTML = `
    <form class="expanded-notes-form" onsubmit="saveNotes(event, '${id}')">
      <textarea id="notesInput-${id}" rows="8" placeholder="Add detailed notes...">${escapeHtml(task.notes)}</textarea>
      <div class="inline-actions">
        <button type="submit">Save notes</button>
        <button class="secondary" type="button" onclick="cancelExpandedNotes('${id}')">Cancel</button>
      </div>
    </form>
  `;

  document.querySelector(`#notesInput-${CSS.escape(id)}`).focus();
}

async function saveNotes(event, id) {
  event.preventDefault();
  await saveNotesById(id);
}

async function saveNotesById(id, keepOpen = false) {
  const notes = document.querySelector(`#notesInput-${CSS.escape(id)}`).value.trim();
  const snapshot = taskSnapshot();
  const updatedAt = new Date().toISOString();
  replaceTask(id, { notes, updatedAt });
  expandedTaskId = keepOpen || notes ? id : "";
  smoothRender();

  const { error } = await supabaseClient
    .from("tasks")
    .update({ notes: notes || null, updated_at: updatedAt })
    .eq("id", id);

  if (error) {
    restoreTasks(snapshot, `Could not save notes: ${error.message}`);
    return;
  }

  showToast("Notes saved");
}

function cancelNotes(id) {
  const task = tasks.find(item => item.id === id);
  const notesView = document.querySelector(`#notesView-${CSS.escape(id)}`);
  if (!task || !notesView) return;

  notesView.innerHTML = `
    <div class="expanded-notes-title">Notes</div>
    <button class="expanded-note-text" type="button" onclick="startExpandedNotes(event, '${id}')">${task.notes ? escapeHtml(task.notes) : "No notes yet."}</button>
  `;
}

function cancelExpandedNotes(id) {
  cancelNotes(id);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tasks.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) throw new Error("JSON must be an array.");

      const rows = imported.map(taskToDb);
      const { error } = await supabaseClient.from("tasks").insert(rows);
      if (error) throw error;

      await loadTasks();
    } catch (error) {
      alert(`Could not import JSON: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

taskForm.addEventListener("submit", async event => {
  event.preventDefault();
  const task = getFormTask();
  if (!task.title) return;
  await upsertTask(task);
  resetForm();
  closeTaskForm();
});

document.querySelector("#resetBtn").addEventListener("click", resetForm);
openTaskFormBtn.addEventListener("click", toggleTaskForm);
document.querySelector("#closeTaskFormBtn").addEventListener("click", () => {
  resetForm();
  closeTaskForm();
});
document.querySelector("#exportJsonBtn").addEventListener("click", exportJson);
document.querySelector("#clearCompletedBtn").addEventListener("click", async () => {
  const confirmed = window.confirm("Clear all done tasks? This will permanently delete completed tasks and any notes on them.");
  if (!confirmed) return;

  const snapshot = taskSnapshot();
  tasks = tasks.filter(task => task.status !== "Done");
  smoothRender();

  const { error } = await supabaseClient.from("tasks").delete().eq("status", "Done");
  if (error) {
    restoreTasks(snapshot, `Could not clear done tasks: ${error.message}`);
    return;
  }
  showToast("Done tasks cleared");
});

board.addEventListener("toggle", event => {
  const target = event.target;
  if (target.classList?.contains("task-space")) {
    const title = target.dataset.space;
    if (target.open) {
      openSpaces.add(title);
    } else {
      openSpaces.delete(title);
    }
    persistOpenSpaces();
    return;
  }

  if (target.classList?.contains("task-row")) {
    if (target.open) {
      closeOtherTaskRows(target);
    } else if (expandedTaskId === target.dataset.taskId) {
      expandedTaskId = "";
    }
  }
}, true);

board.addEventListener("click", event => {
  if (event.target.closest(".task-row.is-editing input, .task-row.is-editing select, .task-row.is-editing textarea")) {
    event.stopPropagation();
  }
}, true);

document.addEventListener("pointerdown", event => {
  if (!editingTaskId) return;
  if (event.target.closest(".task-row.is-editing")) return;
  if (event.target.closest(".app-header, .toolbar")) return;
  cancelTaskEdit();
});

document.addEventListener("pointerdown", event => {
  if (editingTaskId) return;
  const openRow = document.querySelector(".task-row[open]");
  const notesForm = openRow?.querySelector(".expanded-notes-form");

  if (notesForm && !event.target.closest(".expanded-notes-form")) {
    event.preventDefault();
    event.stopPropagation();
    saveNotesById(openRow.dataset.taskId, true);
    return;
  }

  if (event.target.closest(".task-row[open]")) return;
  document.querySelectorAll(".task-row[open]").forEach(row => {
    row.open = false;
  });
  expandedTaskId = "";
});

teamSelect.addEventListener("change", syncTeamCustom);

document.querySelector("#importJsonInput").addEventListener("change", event => {
  const [file] = event.target.files;
  if (file) importJson(file);
  event.target.value = "";
});

[searchInput, teamFilter, priorityFilter].forEach(element => {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
});

textSizeButtons.forEach(button => {
  button.addEventListener("click", () => setTextSize(button.dataset.size));
});

window.editTask = editTask;
window.startTaskEdit = startTaskEdit;
window.cancelTaskEdit = cancelTaskEdit;
window.saveTaskEdit = saveTaskEdit;
window.toggleInlineTeam = toggleInlineTeam;
window.openEditDate = openEditDate;
window.openFormDate = openFormDate;
window.deleteTask = deleteTask;
window.markDone = markDone;
window.quickDone = quickDone;
window.quickLater = quickLater;
window.quickUndone = quickUndone;
window.quickTask = quickTask;
window.markLater = markLater;
window.markTask = markTask;
window.markUndone = markUndone;
window.changeSort = changeSort;
window.startNotes = startNotes;
window.blockEmptyNotesExpand = blockEmptyNotesExpand;
window.handleNotesKey = handleNotesKey;
window.saveNotes = saveNotes;
window.cancelNotes = cancelNotes;
window.startExpandedNotes = startExpandedNotes;
window.cancelExpandedNotes = cancelExpandedNotes;

setTextSize(localStorage.getItem("taskTextSize") || "xs");
loadTasks();
resetForm();
