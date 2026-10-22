"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  due?: string; // "YYYY-MM-DD"
  time?: string; // "HH:MM" (24h), optional
};
type Filter = "all" | "active" | "done";

const STORAGE_KEY = "todos.v1";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Local date as YYYY-MM-DD (toISOString would shift the day for some timezones).
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A task with a date but no time is due at the end of that day.
function dueDate(t: Todo): Date | null {
  if (!t.due) return null;
  return new Date(`${t.due}T${t.time || "23:59"}`);
}

function isOverdue(t: Todo, now: Date) {
  if (t.done) return false;
  const d = dueDate(t);
  return !!d && d.getTime() < now.getTime();
}

function formatDue(t: Todo, now: Date): string {
  if (!t.due) return "";
  const d = new Date(`${t.due}T00:00`);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d.getTime() - startToday.getTime()) / 86400000);

  let day: string;
  if (diff === 0) day = "Today";
  else if (diff === 1) day = "Tomorrow";
  else if (diff === -1) day = "Yesterday";
  else {
    day = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    });
  }

  if (!t.time) return day;
  const [h, m] = t.time.split(":").map(Number);
  const time = new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editTime, setEditTime] = useState("");
  const [today, setToday] = useState("");
  const [now, setNow] = useState<Date>(() => new Date());
  const editRef = useRef<HTMLInputElement>(null);

  // Load from localStorage once, on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTodos(JSON.parse(raw));
    } catch {
      /* ignore corrupted or blocked storage */
    }
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
    setLoaded(true);
  }, []);

  // Keep "now" fresh so tasks flip to overdue on their own.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Save whenever the list changes (after the first load).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      /* storage full or blocked */
    }
  }, [todos, loaded]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const doneCount = todos.filter((t) => t.done).length;
  const activeCount = todos.length - doneCount;
  const overdueCount = todos.filter((t) => isOverdue(t, now)).length;
  const progress = todos.length ? (doneCount / todos.length) * 100 : 0;

  // Soonest due first; tasks without a due date come after, newest first.
  const visible = useMemo(() => {
    const filtered =
      filter === "active"
        ? todos.filter((t) => !t.done)
        : filter === "done"
        ? todos.filter((t) => t.done)
        : todos;
    return [...filtered].sort((a, b) => {
      const da = dueDate(a);
      const db = dueDate(b);
      if (da && db) return da.getTime() - db.getTime() || b.createdAt - a.createdAt;
      if (da) return -1;
      if (db) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [todos, filter]);

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    // A time with no date means "today".
    const due = draftDue || (draftTime ? toDateStr(new Date()) : "");
    const todo: Todo = {
      id: makeId(),
      text,
      done: false,
      createdAt: Date.now(),
      ...(due ? { due, ...(draftTime ? { time: draftTime } : {}) } : {}),
    };
    setTodos((prev) => [todo, ...prev]);
    setDraft("");
    setDraftDue("");
    setDraftTime("");
    setFilter((f) => (f === "done" ? "all" : f));
  }

  function toggle(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function remove(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditDue(todo.due ?? "");
    setEditTime(todo.time ?? "");
  }

  function saveEdit() {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) {
      remove(editingId);
    } else {
      const due = editDue || (editTime ? toDateStr(new Date()) : "");
      setTodos((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, text, due: due || undefined, time: due && editTime ? editTime : undefined }
            : t
        )
      );
    }
    setEditingId(null);
  }

  function clearDone() {
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  const emptyMessage =
    todos.length === 0
      ? "Nothing here yet. Add your first task above."
      : filter === "active"
      ? "Everything is done."
      : "No completed tasks yet.";

  return (
    <section className="board" aria-label="Todo list">
      <header className="head">
        <p className="date">{today || "\u00a0"}</p>
        <h1>
          {todos.length === 0
            ? "What needs doing?"
            : activeCount === 0
            ? "All done."
            : `${activeCount} left to do`}
        </h1>
        <div
          className="meter"
          role="progressbar"
          aria-label="Tasks completed"
          aria-valuemin={0}
          aria-valuemax={todos.length}
          aria-valuenow={doneCount}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="meter-label">
          {doneCount} of {todos.length} completed
          {overdueCount > 0 && <span className="overdue-count">{overdueCount} overdue</span>}
        </p>
      </header>

      <form className="add" onSubmit={addTodo}>
        <div className="add-row">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task"
            aria-label="New task"
            maxLength={200}
            autoComplete="off"
          />
          <button type="submit" disabled={!draft.trim()}>
            Add task
          </button>
        </div>
        <div className="fields">
          <label>
            <span>Due date</span>
            <input type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />
          </label>
          <label>
            <span>Time</span>
            <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
          </label>
          {(draftDue || draftTime) && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setDraftDue("");
                setDraftTime("");
              }}
            >
              Clear date and time
            </button>
          )}
        </div>
      </form>

      <div className="filters" role="tablist" aria-label="Filter tasks">
        {(["all", "active", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? "on" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty">{loaded ? emptyMessage : ""}</p>
      ) : (
        <ul className="list">
          {visible.map((todo) => {
            const late = isOverdue(todo, now);
            return (
              <li key={todo.id} className={todo.done ? "item done" : "item"}>
                <button
                  className="check"
                  onClick={() => toggle(todo.id)}
                  aria-label={
                    todo.done ? `Mark "${todo.text}" as not done` : `Mark "${todo.text}" as done`
                  }
                  aria-pressed={todo.done}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </button>

                <div className="body">
                  {editingId === todo.id ? (
                    <form
                      className="editor"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEdit();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    >
                      <input
                        ref={editRef}
                        className="edit-text"
                        value={editText}
                        maxLength={200}
                        aria-label="Edit task"
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="fields">
                        <label>
                          <span>Due date</span>
                          <input
                            type="date"
                            value={editDue}
                            onChange={(e) => setEditDue(e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Time</span>
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                          />
                        </label>
                        {(editDue || editTime) && (
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              setEditDue("");
                              setEditTime("");
                            }}
                          >
                            Clear date and time
                          </button>
                        )}
                      </div>
                      <div className="editor-actions">
                        <button type="submit" className="primary">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="text" onDoubleClick={() => startEdit(todo)}>
                        {todo.text}
                      </span>
                      {todo.due && (
                        <span className={late ? "meta late" : "meta"}>
                          {late && <strong>Overdue</strong>}
                          {formatDue(todo, now)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {editingId !== todo.id && (
                  <div className="actions">
                    <button onClick={() => startEdit(todo)} aria-label={`Edit "${todo.text}"`}>
                      Edit
                    </button>
                    <button
                      className="danger"
                      onClick={() => remove(todo.id)}
                      aria-label={`Delete "${todo.text}"`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {doneCount > 0 && (
        <footer className="foot">
          <button className="clear" onClick={clearDone}>
            Clear {doneCount} completed
          </button>
        </footer>
      )}
    </section>
  );
}
