var DayShapeEmail = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // weekly-email.js
  var weekly_email_exports = {};
  __export(weekly_email_exports, {
    APP_URL: () => APP_URL,
    REPORT_TIMEZONE: () => REPORT_TIMEZONE,
    buildWeeklyEmail: () => buildWeeklyEmail,
    eligibleEmail: () => eligibleEmail,
    reportWindow: () => reportWindow
  });

  // domain.js
  var categories = [
    { id: "rest", name: "Sleep & rest", color: "#aaa4d2", icon: "\u263E" },
    { id: "learn", name: "Learning & school", color: "#e9bd59", icon: "\u270E" },
    { id: "move", name: "Exercise & sports", color: "#8bb29d", icon: "\u2197" },
    { id: "play", name: "Entertainment", color: "#ee9979", icon: "\u25B7" },
    { id: "create", name: "Creativity", color: "#d7a5b8", icon: "\u2733" },
    { id: "family", name: "Family & social", color: "#83b6c8", icon: "\u2661" },
    { id: "life", name: "Daily essentials", color: "#b3baa0", icon: "\u2302" },
    { id: "work", name: "Work", color: "#95a6c4", icon: "\u25A3" }
  ];
  function dateKey(d = /* @__PURE__ */ new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function shiftDate(key, n) {
    const d = /* @__PURE__ */ new Date(key + "T12:00:00");
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  function weekStart(key) {
    const d = /* @__PURE__ */ new Date(key + "T12:00:00");
    return shiftDate(key, -((d.getDay() + 6) % 7));
  }
  function rangeDates(key, view) {
    if (view === "day") return [key];
    let start = view === "week" ? weekStart(key) : key.slice(0, 8) + "01";
    let end = view === "week" ? shiftDate(start, 7) : dateKey(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1));
    const out = [];
    while (start < end) {
      out.push(start);
      start = shiftDate(start, 1);
    }
    return out;
  }
  var duration = (n) => {
    n = Math.round(n);
    return n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? " " + n % 60 + "m" : ""}` : `${n}m`;
  };
  var live = (a) => (a || []).filter((x) => !x.deleted);
  function totals(entries) {
    return entries.reduce((n, e) => n + e.minutes, 0);
  }
  function routineEntries(data, profileId, date) {
    const weekday = (/* @__PURE__ */ new Date(date + "T12:00:00")).getDay();
    return live(data.routines).filter((r) => r.profileId === profileId && r.days.includes(weekday) && date >= r.startDate && (!r.endDate || date <= r.endDate)).filter((r) => !data.entries.some((e) => e.routineId === r.id && e.date === date)).map((r) => ({ ...r, id: `${r.id}:${date}`, routineId: r.id, date, kind: "plan", virtual: true }));
  }

  // insights.js
  function suggestedScreen(activity) {
    return /\b(video games?|gaming|screen time|tv|television|youtube|tiktok|social media)\b/i.test(activity?.name || "");
  }
  function isScreen(activity) {
    return typeof activity?.screenTime === "boolean" ? activity.screenTime : suggestedScreen(activity);
  }
  function timeBalance(actual, planned, days) {
    const capacity = days * 1440, recorded = totals(actual), scheduled = totals(planned);
    return { capacity, recorded, scheduled, unknown: Math.max(0, capacity - recorded), available: Math.max(0, capacity - scheduled), actualOver: Math.max(0, recorded - capacity), planOver: Math.max(0, scheduled - capacity) };
  }
  function weeklyInsights(data, profile, selected, today = dateKey()) {
    const dates = rangeDates(selected, "week"), start = dates[0];
    const activities = data.activities.filter((a) => a.profileId === profile.id);
    const byId = new Map(activities.map((a) => [a.id, a]));
    const all = live(data.entries).filter((e) => e.profileId === profile.id && e.kind === "actual" && e.date <= today);
    const actual = all.filter((e) => dates.includes(e.date));
    const planned = [...live(data.entries).filter((e) => e.profileId === profile.id && e.kind === "plan" && dates.includes(e.date)), ...dates.flatMap((d) => routineEntries(data, profile.id, d))];
    const screenTotal = (rows) => totals(rows.filter((e) => isScreen(byId.get(e.activityId))));
    const screen = screenTotal(actual), limit = profile.timeTargets?.screenMinutes;
    const flags = [];
    if (Number.isFinite(limit) && limit >= 0 && screen > limit) flags.push(`Screen time is ${duration(screen - limit)} above your ${duration(limit)} weekly limit.`);
    for (const goal of live(data.goals).filter((g) => g.profileId === profile.id && g.week === start && g.direction === "max")) {
      const n = totals(actual.filter((e) => e.activityId === goal.activityId));
      if (n > goal.minutes) flags.push(`${byId.get(goal.activityId)?.name || "Activity"} is ${duration(n - goal.minutes)} above its weekly goal.`);
    }
    const days = dates.filter((d) => d <= today), covered = days.filter((d) => actual.some((e) => e.date === d));
    const baseline = [];
    if (days.length && covered.length === days.length) for (let back = 1; back <= 4; back++) {
      const previousDates = days.map((d) => shiftDate(d, -7 * back));
      const rows = all.filter((e) => previousDates.includes(e.date));
      if (previousDates.every((d) => rows.some((e) => e.date === d))) baseline.push(rows);
    }
    const measures = [{ name: "Screen time total", sum: screenTotal }, ...activities.filter((a) => !a.deleted).map((a) => ({ name: a.name, sum: (rows) => totals(rows.filter((e) => e.activityId === a.id)) }))];
    const changes = baseline.length >= 2 ? measures.map((m) => {
      const current = m.sum(actual), average = baseline.reduce((n, rows) => n + m.sum(rows), 0) / baseline.length;
      return { name: m.name, current, average, delta: current - average };
    }).filter((m) => m.current || m.average) : [];
    for (const m of changes) if (m.delta >= 60 && m.current > m.average * 1.5) flags.push(`${m.name}: ${duration(m.delta)} more recorded than usual for these weekdays (${baseline.length}-week average).`);
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const week = shiftDate(start, (i - 3) * 7), weekDates = rangeDates(week, "week"), rows = all.filter((e) => weekDates.includes(e.date));
      return { start: week, total: totals(rows), screen: screenTotal(rows), coverage: new Set(rows.map((e) => e.date)).size, partial: shiftDate(week, 6) >= today };
    });
    return {
      start,
      dates,
      actual,
      planned,
      screen,
      limit,
      flags,
      changes,
      baselineCount: baseline.length,
      coverage: covered.length,
      elapsed: days.length,
      weeks,
      categories: categories.map((c) => ({ ...c, minutes: totals(actual.filter((e) => byId.get(e.activityId)?.category === c.id)), target: profile.timeTargets?.categories?.[c.id] || 0 })),
      balance: timeBalance(actual, planned, 7)
    };
  }

  // functions/logic.js
  var shift = (date, n) => {
    const d = /* @__PURE__ */ new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  var monday = (date) => shift(date, -(((/* @__PURE__ */ new Date(date + "T12:00:00Z")).getUTCDay() + 6) % 7));
  function localClock(now, timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const p = Object.fromEntries(parts.map((p2) => [p2.type, p2.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  }

  // weekly-email.js
  var REPORT_TIMEZONE = "America/New_York";
  var APP_URL = "https://niwde787.github.io/DayShape/";
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function reportWindow(now = /* @__PURE__ */ new Date()) {
    const { date, hour } = localClock(now, REPORT_TIMEZONE), start = shift(monday(date), -7);
    return { start, end: shift(start, 6), due: (/* @__PURE__ */ new Date(date + "T12:00:00Z")).getUTCDay() === 1 && hour >= 9 && hour < 21 };
  }
  function eligibleEmail(preference, account, userLink, isMember) {
    return preference?.enabled === true && preference.consentVersion === 1 && isMember === true && account?.emailVerified === true && !account.disabled && typeof account.email === "string" && account.email.toLowerCase() === preference.email && userLink?.familyId === preference.familyId;
  }
  function buildWeeklyEmail(data, start) {
    const end = shiftDate(start, 6), lines = [`Your DayShape week: ${start} \u2013 ${end}`, ""];
    const sections = live(data.profiles).map((profile) => {
      const s = weeklyInsights(data, profile, start, end);
      const activities = new Map(data.activities.filter((a) => a.profileId === profile.id).map((a) => [a.id, a.name]));
      const totals2 = /* @__PURE__ */ new Map();
      for (const e of s.actual) totals2.set(e.activityId, (totals2.get(e.activityId) || 0) + e.minutes);
      const activityLines = [...totals2].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${activities.get(id) || "Removed activity"}: ${duration(n)}`);
      const goals = live(data.goals).filter((g) => g.profileId === profile.id && g.week === start).map((g) => {
        const spent = totals2.get(g.activityId) || 0, met = g.direction === "max" ? spent <= g.minutes : spent >= g.minutes;
        return `${activities.get(g.activityId) || "Activity"}: ${duration(spent)} recorded / ${g.direction === "max" ? "maximum" : "target"} ${duration(g.minutes)}${s.coverage === 7 ? met ? " \xB7 goal met" : " \xB7 keep working together" : " \xB7 incomplete logging"}`;
      });
      const summary = s.coverage ? `${duration(s.balance.recorded)} recorded \xB7 ${s.coverage}/7 days logged \xB7 ${duration(s.screen)} screen time` : "No time was logged this week.";
      const gaps = `${duration(s.balance.unknown)} not recorded out of 168h. Unlogged time is unknown, not necessarily free.${s.balance.actualOver ? " Recorded time exceeds 168h; check overlapping entries." : ""}`;
      const flags = s.flags.length ? s.flags : ["No limits or unusual increases flagged in the recorded time."];
      const categories2 = s.categories.filter((c) => c.minutes || c.target).map((c) => `${c.name}: ${duration(c.minutes)}${c.target ? " / target " + duration(c.target) : ""}`);
      lines.push(profile.name, summary, gaps, ...activityLines, ...categories2, ...goals, ...flags, "");
      const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
      return `<section style="padding:20px 0;border-bottom:1px solid #ddd"><h2>${esc(profile.name)}</h2><p><strong>${esc(summary)}</strong></p><p>${esc(gaps)}</p>${activityLines.length ? "<h3>Activities</h3>" + list(activityLines) : ""}${categories2.length ? "<h3>Weekly distribution</h3>" + list(categories2) : ""}${goals.length ? "<h3>Your goals</h3>" + list(goals) : ""}<h3>Things to notice</h3>${list(flags)}</section>`;
    });
    if (!sections.length) return null;
    const footer = "Choose one small change together for the coming week. These are recorded totals, not health judgments. Manage or stop weekly emails in DayShape \u2192 Account \u2192 Weekly email report.";
    lines.push(footer, APP_URL);
    return { subject: `DayShape weekly report \xB7 ${start} \u2013 ${end}`, text: lines.join("\n"), html: `<!doctype html><html lang="en"><body style="margin:0;background:#f6f4ee;color:#243b35;font:16px Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:24px"><h1>Your week, together.</h1><p>${esc(start)} \u2013 ${esc(end)} \xB7 DayShape</p>${sections.join("")}<p>${esc(footer)}</p><p><a href="${APP_URL}">Open DayShape and manage reports</a></p></main></body></html>` };
  }
  return __toCommonJS(weekly_email_exports);
})();
