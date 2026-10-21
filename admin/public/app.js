/* Geodex admin dashboard front end. Plain JavaScript, no build step. Everything is drawn with
   textContent / DOM nodes (never innerHTML), so no value from the database can inject markup. */
(() => {
  "use strict";

  const TABS = [
    ["overview", "Overview"],
    ["growth", "Growth"],
    ["activity", "Activity"],
    ["rounds", "Rounds"],
    ["gameplay", "Gameplay"],
    ["retention", "Retention"],
    ["traffic", "Traffic"],
    ["accounts", "Accounts"],
    ["feedback", "Feedback"],
    ["operations", "Operations"],
    ["database", "Database"],
  ];

  const $ = (id) => document.getElementById(id);
  const main = $("main");
  const state = { tab: "overview", days: 30, charts: [], timer: null, loading: 0 };

  // --- tiny DOM helpers -----------------------------------------------------------------------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.setAttribute("style", v);
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmt = (n) => (n == null ? "n/a" : Number(n).toLocaleString());
  const pct = (n) => (n == null ? "n/a" : `${Number(n).toFixed(1)}%`);
  const dec = (n, d = 1) => (n == null ? "n/a" : Number(n).toFixed(d));
  const bytes = (n) => {
    if (n == null) return "n/a";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = Number(n);
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
  };
  const shortDay = (iso) => {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };
  const duration = (seconds) => {
    if (seconds == null) return "n/a";
    const s = Math.round(seconds);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };
  const label = (value) => {
    const text = String(value).toLowerCase().replaceAll("_", " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // --- building blocks ------------------------------------------------------------------------
  function kpi(name, value, hint, tone) {
    return h("div", { class: `card kpi ${tone ?? ""}` },
      h("div", { class: "label" }, name),
      h("div", { class: "value" }, value),
      hint ? h("div", { class: "hint" }, hint) : null);
  }
  const kpis = (...items) => h("div", { class: "grid kpis" }, items);
  const row = (cls, ...cards) => h("div", { class: `grid ${cls}` }, cards);

  function card(title, sub, ...body) {
    return h("section", { class: "card" }, h("h2", null, title), sub ? h("p", { class: "sub" }, sub) : null, body);
  }

  function chartCard(title, sub, config, size) {
    const canvas = h("canvas", { role: "img", "aria-label": title });
    const box = h("div", { class: `chart ${size ?? ""}` }, canvas);
    const el = card(title, sub, box);
    queueMicrotask(() => drawChart(canvas, config));
    return el;
  }

  function drawChart(canvas, config) {
    const text = css("--muted");
    const grid = css("--grid");
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: text, boxWidth: 12 }, display: (config.data.datasets?.length ?? 0) > 1 } },
      scales: config.type === "doughnut" ? {} : {
        x: { ticks: { color: text, maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false }, stacked: !!config.stacked },
        y: { beginAtZero: true, ticks: { color: text }, grid: { color: grid }, stacked: !!config.stacked },
      },
    };
    const merged = {
      type: config.type,
      data: config.data,
      options: deepMerge(base, config.options ?? {}),
    };
    state.charts.push(new Chart(canvas, merged));
  }

  function deepMerge(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? deepMerge(a[k], v) : v;
    }
    return out;
  }

  const palette = () => [css("--c1"), css("--c2"), css("--c3"), css("--c4"), css("--c5"), css("--c6")];

  /** A line or bar chart of one or more series over days. */
  function timeSeries(title, sub, rows, series, { type = "line", stacked = false, size } = {}) {
    const colors = palette();
    return chartCard(title, sub, {
      type,
      stacked,
      data: {
        labels: rows.map((r) => shortDay(r.day)),
        datasets: series.map(([key, name], i) => ({
          label: name,
          data: rows.map((r) => r[key]),
          borderColor: colors[i % colors.length],
          backgroundColor: type === "bar" ? colors[i % colors.length] : `${colors[i % colors.length]}33`,
          borderWidth: 2,
          pointRadius: rows.length > 60 ? 0 : 2,
          tension: 0.25,
          fill: type === "line" && series.length === 1,
        })),
      },
    }, size);
  }

  function bars(items, { total, unit = "" } = {}) {
    if (!items?.length) return h("p", { class: "empty" }, "No data in this range yet.");
    const max = Math.max(...items.map((i) => i.n), 1);
    const sum = total ?? items.reduce((s, i) => s + i.n, 0);
    return h("div", null, items.map((i) =>
      h("div", { class: "bar" },
        h("span", { class: "name", title: i.label }, i.label),
        h("span", { class: "track" }, h("span", { class: "fill", style: `width:${(i.n / max) * 100}%` })),
        h("span", { class: "n" }, `${fmt(i.n)}${unit}`, sum ? ` (${Math.round((i.n / sum) * 100)}%)` : ""))));
  }

  function table(columns, rows, empty = "Nothing to show yet.") {
    if (!rows?.length) return h("p", { class: "empty" }, empty);
    return h("div", { class: "table-wrap" },
      h("table", null,
        h("thead", null, h("tr", null, columns.map((c) => h("th", null, c.title)))),
        h("tbody", null, rows.map((r) =>
          h("tr", null, columns.map((c) => h("td", { class: `${c.text ? "text" : ""} num` }, c.render ? c.render(r) : r[c.key])))))));
  }

  function funnel(steps) {
    const top = Math.max(steps[0].n, 1);
    return h("div", { class: "funnel" }, steps.map((s, i) =>
      h("div", { class: "step" },
        h("div", { class: "row" }, h("span", null, s.name), h("span", { class: "num" }, fmt(s.n), i ? ` (${pct((s.n / top) * 100)})` : "")),
        h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(s.n / top) * 100}%` })))));
  }

  const sum = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

  // --- panels ---------------------------------------------------------------------------------
  const RENDER = {
    overview(d) {
      const u = d.users;
      return h("div", null,
        kpis(
          kpi("Registered accounts", fmt(u.total), `${fmt(u.confirmed)} confirmed, ${fmt(u.unconfirmed)} waiting`),
          kpi("New today", fmt(u.today), `${fmt(u.last7)} in 7 days, ${fmt(u.last30)} in 30`),
          kpi("Active today (DAU)", fmt(d.active.dau), "signed-in accounts"),
          kpi("Active this week", fmt(d.active.wau), "WAU"),
          kpi("Active this month", fmt(d.active.mau), `stickiness ${pct(d.active.stickiness)} (DAU / MAU)`),
          kpi("Rounds saved", fmt(d.rounds.total), `${fmt(d.rounds.today)} today, ${fmt(d.rounds.last7)} in 7 days`),
          kpi("Visitors today", fmt(d.today.visitors), `${fmt(d.today.pageviews)} page views`),
          kpi("Confirmation rate", pct(u.confirmationRate), "accounts that clicked the email link", u.confirmationRate >= 70 ? "good" : "warn"),
          kpi("Public profiles", fmt(u.public_profiles), `${pct((u.public_profiles / Math.max(u.total, 1)) * 100)} of accounts`),
          kpi("Feedback received", fmt(d.feedback.total), `${fmt(d.feedback.last7)} in the last 7 days`)),
        card("Tracking history", "Statistics are only as old as the tracking itself.",
          h("p", { class: "small muted" },
            `Active-day tracking since ${d.trackingSince.activity ?? "n/a"}; round events since ${d.trackingSince.rounds ?? "n/a"}; daily totals since ${d.trackingSince.counters ?? "n/a"}. `,
            "Accounts and saved rounds go back further because they come from the main tables.")));
    },

    growth(d) {
      const weekly = d.weekly.map((w) => ({ ...w, day: w.week }));
      return h("div", null,
        kpis(
          kpi("Signups in range", fmt(sum(d.daily, "signups"))),
          kpi("Confirmed in range", fmt(sum(d.daily, "confirmations"))),
          kpi("Total accounts now", fmt(d.daily.at(-1)?.total))),
        row("two",
          timeSeries("Total accounts", "Cumulative registered accounts", d.daily, [["total", "Accounts"]]),
          timeSeries("Signups per day", "New accounts and how many confirmed their email that day", d.daily, [["signups", "Signups"], ["confirmations", "Confirmations"]], { type: "bar" })),
        row("two",
          timeSeries("Signups per week", "Last 13 weeks", weekly, [["signups", "Signups"], ["confirmed", "Of those, confirmed"]], { type: "bar" }),
          card("Weekly confirmation rate", "Share of each week's signups that confirmed", table(
            [{ title: "Week of", render: (r) => shortDay(r.week) }, { title: "Signups", key: "signups" }, { title: "Confirmed", key: "confirmed" }, { title: "Rate", render: (r) => pct(r.confirmationRate) }],
            d.weekly.slice().reverse()))));
    },

    activity(d) {
      const last = d.daily.at(-1) ?? {};
      return h("div", null,
        kpis(
          kpi("Today (DAU)", fmt(last.dau)),
          kpi("Last 7 days (WAU)", fmt(last.wau)),
          kpi("Last 30 days (MAU)", fmt(last.mau)),
          kpi("Stickiness", pct(last.stickiness), "DAU / MAU")),
        row("two",
          timeSeries("Daily active accounts", "Signed-in accounts that did something that day", d.daily, [["dau", "Active accounts"]]),
          timeSeries("New vs returning", "Of the active accounts, who signed up that day", d.daily, [["returning", "Returning"], ["new_users", "New"]], { type: "bar", stacked: true })),
        row("two",
          timeSeries("Weekly and monthly active", "Rolling 7 and 30 day windows", d.daily, [["wau", "WAU"], ["mau", "MAU"]]),
          chartCard("When accounts were last active", "Everyone with a confirmed account, by their latest active day", {
            type: "doughnut",
            data: {
              labels: ["Today", "Earlier this week", "Earlier this month", "Older", "Never active"],
              datasets: [{ data: [d.recency.today, d.recency.this_week, d.recency.this_month, d.recency.older, d.recency.never], backgroundColor: [...palette().slice(0, 4), css("--border")], borderWidth: 0 }],
            },
            options: { plugins: { legend: { display: true, position: "right", labels: { color: css("--muted") } } } },
          })));
    },

    rounds(d) {
      const f = d.funnel;
      const heat = d.heatmap;
      const heatMax = Math.max(...heat.flat(), 1);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return h("div", null,
        kpis(
          kpi("Rounds started", fmt(f.started)),
          kpi("Finished", fmt(f.finished), `completion ${pct(f.completionRate)}`, f.completionRate >= 80 ? "good" : "warn"),
          kpi("Left the tab", fmt(f.left_tab), "round ended by anti-cheat"),
          kpi("Went idle", fmt(f.inactive), "60 seconds without an answer"),
          kpi("Abandoned", fmt(f.abandoned), "started, never reported back"),
          kpi("Guest rounds", fmt(f.guest_started), `${pct((f.guest_started / Math.max(f.started, 1)) * 100)} of started`)),
        row("two",
          timeSeries("Rounds per day", "Started, and how each ended", d.daily, [["started", "Started"], ["finished", "Finished"], ["left_tab", "Left tab"], ["inactive", "Idle"]]),
          timeSeries("Saved rounds by mode", "Rounds that reached the leaderboard code path", d.daily, [["saved_name", "Guess by name"], ["saved_shape", "Guess by shape"]], { type: "bar", stacked: true })),
        row("three",
          chartCard("Mode", null, doughnut(d.mix.mode), "short"),
          chartCard("Difficulty", null, doughnut(d.mix.difficulty), "short"),
          chartCard("Round length", null, doughnut(d.mix.length.map((m) => ({ ...m, label: `${m.label} questions` }))), "short")),
        row("two",
          card("Funnel", "What happened to rounds that were started", funnel([
            { name: "Started", n: f.started }, { name: "Finished", n: f.finished },
            { name: "Left the tab", n: f.left_tab }, { name: "Went idle", n: f.inactive }, { name: "Abandoned", n: f.abandoned }])),
          card("Round duration", "Time to finish, by round length", table(
            [{ title: "Length", render: (r) => `${r.length} questions` }, { title: "Rounds", render: (r) => fmt(r.n) }, { title: "Average", render: (r) => duration(r.avg_seconds) }, { title: "Median", render: (r) => duration(r.median_seconds) }],
            d.duration))),
        row("two",
          chartCard("Where early endings happen", "Questions answered before an ended round stopped", {
            type: "bar",
            data: { labels: d.endedAt.map((e) => e.answered), datasets: [{ label: "Rounds ended", data: d.endedAt.map((e) => e.n), backgroundColor: css("--c5") }] },
          }, "short"),
          card("Every setup", "Started, finished and completion rate for each mode, difficulty and length", table(
            [{ title: "Mode", render: (r) => label(r.mode) }, { title: "Difficulty", render: (r) => label(r.difficulty) }, { title: "Length", key: "length" }, { title: "Started", render: (r) => fmt(r.started) }, { title: "Finished", render: (r) => fmt(r.finished) }, { title: "Rate", render: (r) => pct(r.completionRate) }],
            d.configs))),
        card("When people start rounds", `Busiest hour is the darkest square. Times are in your local time zone (UTC${tzLabel()}).`,
          h("div", { class: "heat", role: "img", "aria-label": "Rounds started by weekday and hour" },
            [h("span"), ...Array.from({ length: 24 }, (_, hr) => h("span", { class: "hh" }, hr % 3 === 0 ? hr : ""))],
            heat.flatMap((hours, dow) => [
              h("span", { class: "hl" }, days[dow]),
              ...hours.map((n, hr) => h("span", {
                class: "cell",
                title: `${days[dow]} ${String(hr).padStart(2, "0")}:00, ${n} rounds`,
                style: n ? `background:color-mix(in srgb, ${css("--c1")} ${Math.round(12 + (n / heatMax) * 88)}%, transparent)` : null,
              })),
            ]))));
    },

    gameplay(d) {
      const t = d.totals;
      return h("div", null,
        kpis(
          kpi("Rounds played", fmt(t.rounds), `scoring version ${d.scoringVersion}`),
          kpi("Players", fmt(t.players)),
          kpi("Rounds per player", dec(t.rounds_per_player)),
          kpi("Average accuracy", pct(t.avg_accuracy)),
          kpi("Perfect rounds", fmt(t.perfect_rounds), `${pct((t.perfect_rounds / Math.max(t.rounds, 1)) * 100)} of rounds`)),
        row("two",
          chartCard("Accuracy distribution", "Share of rounds by percent correct", {
            type: "bar",
            data: { labels: d.accuracyBuckets.map((b) => b.label), datasets: [{ label: "Rounds", data: d.accuracyBuckets.map((b) => b.n), backgroundColor: css("--c3") }] },
          }),
          card("Top players", "By total score in range (display names are public on the leaderboards)", table(
            [{ title: "Player", key: "name", text: true }, { title: "Rounds", render: (r) => fmt(r.rounds) }, { title: "Best", render: (r) => fmt(r.best_score) }, { title: "Total", render: (r) => fmt(r.total_score) }],
            d.topPlayers))),
        card("Difficulty by setup", "How each mode, difficulty and length actually plays out", table(
          [{ title: "Mode", render: (r) => label(r.mode) }, { title: "Difficulty", render: (r) => label(r.difficulty) }, { title: "Length", key: "length" },
            { title: "Rounds", render: (r) => fmt(r.rounds) }, { title: "Avg score", render: (r) => dec(r.avg_score) }, { title: "Best", render: (r) => fmt(r.best_score) },
            { title: "Accuracy", render: (r) => pct(r.avg_accuracy) }, { title: "s / question", render: (r) => dec(r.avg_seconds_per_question) },
            { title: "Avg streak", render: (r) => dec(r.avg_best_streak) }, { title: "Near misses", render: (r) => dec(r.avg_neighbor_guesses, 2) }, { title: "Perfect", render: (r) => fmt(r.perfect_rounds) }],
          d.byConfig)));
    },

    retention(d) {
      const maxWeeks = Math.max(...d.cohorts.map((c) => c.retention.length), 0);
      const shade = (v) => (v == null ? null : `background:color-mix(in srgb, ${css("--c3")} ${Math.round(8 + (v / 100) * 70)}%, transparent)`);
      return h("div", null,
        kpis(...d.classic.map((c) => kpi(`Day ${c.day} return`, pct(c.rate), `${fmt(c.returned)} of ${fmt(c.eligible)} accounts came back on day ${c.day} or later`))),
        card("Weekly cohorts", "Each row is the accounts that signed up in one week; each column is the share active that many weeks later.",
          h("div", { class: "table-wrap" },
            h("table", { class: "cohort" },
              h("thead", null, h("tr", null, h("th", null, "Signup week"), h("th", null, "Accounts"), Array.from({ length: maxWeeks }, (_, i) => h("th", null, `Week ${i}`)))),
              h("tbody", null, d.cohorts.map((c) => h("tr", null,
                h("td", null, shortDay(c.cohort)), h("td", { class: "num" }, fmt(c.size)),
                Array.from({ length: maxWeeks }, (_, i) => {
                  const v = c.retention[i];
                  return h("td", { class: "cell", style: shade(v) }, v == null ? "" : `${Math.round(v)}%`);
                }))))))),
        h("p", { class: "legend-note" }, "Day-N return counts accounts active on day N or any later day. Blank cells mean the week has not happened yet."));
    },

    traffic(d) {
      const f = d.funnel;
      return h("div", null,
        kpis(
          kpi("Visitors", fmt(f.visitors), "unique per day, summed"),
          kpi("Page views", fmt(sum(d.daily, "pageviews"))),
          kpi("Pages per visitor", dec(sum(d.daily, "pageviews") / Math.max(f.visitors, 1))),
          kpi("Visitor to player", pct((f.rounds_started / Math.max(f.visitors, 1)) * 100), "rounds started per visitor")),
        row("two",
          timeSeries("Visitors per day", "Anonymous, cookie-less, Do Not Track respected", d.daily, [["visitors", "Visitors"]]),
          timeSeries("Page views per day", "All pages, and how many came from signed-in accounts", d.daily, [["pageviews", "All"], ["signed_in_pageviews", "Signed in"]])),
        row("two",
          card("Funnel", "From a visit to an account", funnel([
            { name: "Visitors", n: f.visitors }, { name: "Setup screen page views", n: f.setup_views },
            { name: "Started a round", n: f.rounds_started }, { name: "Created an account", n: f.signups }])),
          card("Pages", "Page views by page", bars(d.pages))),
        row("three",
          card("Devices", null, bars(d.devices)),
          card("Browsers", null, bars(d.browsers)),
          card("Where visitors came from", null, bars(d.sources))));
    },

    accounts(d) {
      const h1 = d.health;
      const u = d.unconfirmedAges;
      return h("div", null,
        kpis(
          kpi("Accounts", fmt(h1.total)),
          kpi("Confirmed", pct(h1.confirmationRate), `${fmt(h1.confirmed)} of ${fmt(h1.total)}`),
          kpi("Median time to confirm", h1.median_minutes_to_confirm == null ? "n/a" : `${dec(h1.median_minutes_to_confirm)} min`, `average ${dec(h1.avg_minutes_to_confirm)} min (long waits pull it up)`),
          kpi("Confirmed accounts that played", pct(d.playing.rate), `${fmt(d.playing.with_rounds)} of ${fmt(d.playing.confirmed_accounts)}`),
          kpi("Public profiles", pct(h1.publicRate))),
        card("Unconfirmed accounts by age", "Accounts that never clicked the email link. These are never cleaned up automatically.",
          bars([{ label: "Under a day", n: u.under_1d }, { label: "1 to 7 days", n: u.d1_to_7 }, { label: "Over 7 days", n: u.over_7d }])));
    },

    feedback(d) {
      const t = d.totals;
      return h("div", null,
        kpis(
          kpi("Total", fmt(t.total)),
          kpi("Bug reports", fmt(t.bugs)),
          kpi("Feedback", fmt(t.ideas)),
          kpi("From signed-in players", fmt(t.from_players)),
          kpi("Emailed to you", fmt(t.emailed), t.email_failed ? `${fmt(t.email_failed)} failed or skipped` : "all delivered", t.email_failed ? "warn" : "good")),
        row("two",
          timeSeries("Feedback per day", "Bug reports and general feedback", d.daily, [["bugs", "Bugs"], ["ideas", "Feedback"]], { type: "bar", stacked: true }),
          card("Recent", "Newest first. Who sent it is not shown.", table(
            [{ title: "When", render: (r) => String(r.at).slice(0, 16) }, { title: "Kind", render: (r) => h("span", { class: `pill ${r.kind === "BUG" ? "bug" : "idea"}` }, r.kind === "BUG" ? "Bug" : "Feedback") },
              { title: "Subject", key: "subject", text: true }, { title: "Message", key: "excerpt", text: true }, { title: "Mail", render: (r) => h("span", { class: `pill ${r.emailed ? "good" : "bad"}`, title: r.email_failed ? "the email failed or was skipped" : "" }, r.emailed ? "sent" : "not sent") }],
            d.recent))));
    },

    operations(d) {
      const b = d.emailBudget;
      const tone = b.usedRate >= 90 ? "bad" : b.usedRate >= 70 ? "warn" : "";
      const byKey = new Map();
      for (const c of d.counters) byKey.set(c.key, (byKey.get(c.key) ?? 0) + Number(c.count));
      const total = (...keys) => keys.reduce((s, k) => s + (byKey.get(k) ?? 0), 0);
      const series = (title, sub, keys, names) => {
        const all = [...new Set(d.counters.map((c) => String(c.day).slice(0, 10)))].sort();
        const rows = all.map((day) => {
          const r = { day };
          for (const k of keys) r[k] = d.counters.filter((c) => c.key === k && String(c.day).slice(0, 10) === day).reduce((s, c) => s + Number(c.count), 0);
          return r;
        });
        return timeSeries(title, sub, rows, keys.map((k, i) => [k, names[i]]), { type: "bar", stacked: true });
      };
      return h("div", null,
        kpis(
          kpi("Emails in the last 24h", `${fmt(b.used)} / ${fmt(b.limit)}`, `${pct(b.usedRate)} of the daily budget`, tone),
          kpi("Failed logins", fmt(total("login.failed")), `${fmt(total("login.locked"))} lockouts`),
          kpi("Signups refused", fmt(total("signup.refused.disposable", "signup.refused.nomx", "signup.refused.exists", "signup.rate_limited")), "disposable, no mail server, taken, rate limited"),
          kpi("Rounds rejected", fmt(total("round.rejected.implausible", "round.rejected.token", "round.replayed")), "implausible, bad token, replayed", total("round.rejected.implausible", "round.rejected.token", "round.replayed") ? "warn" : ""),
          kpi("Email failures", fmt(total("email.failed", "signup.email_failed")), null, total("email.failed", "signup.email_failed") ? "warn" : "good")),
        card("Email budget", "Every outgoing email counts toward one daily ceiling; past it, signups are paused.",
          h("div", { class: "gauge", role: "progressbar", "aria-valuenow": Math.round(b.usedRate), "aria-valuemin": 0, "aria-valuemax": 100 },
            h("div", { class: `fill ${tone}`, style: `width:${Math.min(b.usedRate, 100)}%` }))),
        h("div", { class: "grid", style: "height:16px" }),
        row("two",
          series("Logins", "Successful against failed, lockouts and unconfirmed attempts", ["login.success", "login.failed", "login.locked", "login.unconfirmed"], ["Successful", "Failed", "Locked out", "Unconfirmed"]),
          series("Signup outcomes", "Created, and why others were turned away", ["signup.created", "signup.refused.disposable", "signup.refused.nomx", "signup.refused.exists", "signup.rate_limited"], ["Created", "Disposable address", "No mail server", "Already exists", "Rate limited"])),
        row("two",
          series("Emails sent", "Confirmation and password reset emails", ["email.sent.verify", "email.sent.reset", "email.failed"], ["Confirmation", "Password reset", "Failed"]),
          series("Rejected rounds", "Results the server refused", ["round.rejected.implausible", "round.rejected.token", "round.replayed", "round.start_limited"], ["Implausible", "Bad token", "Replayed", "Start limited"])),
        row("two",
          card("Account actions", "In the selected range", bars(
            [["account.password_changed", "Passwords changed"], ["account.stats_reset", "Statistics reset"], ["account.deleted", "Accounts deleted"], ["reset.requested", "Reset requested"], ["reset.success", "Reset completed"], ["verify.resend_requested", "Confirmation re-sent"]]
              .map(([k, name]) => ({ label: name, n: byKey.get(k) ?? 0 })))),
          card("Rate-limit counters right now", "Entries currently inside their window (these are hashes, never addresses)", bars(d.rateLimits.map((r) => ({ label: r.bucket, n: r.n })), { total: 0 }))));
    },

    database(d) {
      return h("div", null,
        kpis(
          kpi("Database", d.name, `${d.user} on ${d.version}`),
          kpi("Total size", bytes(d.bytes)),
          kpi("Connection", d.readOnly ? "Read only" : "WRITABLE", d.readOnly ? "queries run inside read-only transactions" : "unexpected: check ADMIN_DATABASE_URL", d.readOnly ? "good" : "bad")),
        card("Tables", "Rows are estimates for large tables", table(
          [{ title: "Table", key: "name" }, { title: "Rows", render: (r) => fmt(r.rows) }, { title: "Size", render: (r) => bytes(r.bytes) }],
          d.tables)));
    },
  };

  function doughnut(items) {
    return {
      type: "doughnut",
      data: { labels: items.map((i) => label(i.label)), datasets: [{ data: items.map((i) => i.n), backgroundColor: palette(), borderWidth: 0 }] },
      options: { plugins: { legend: { display: true, position: "right", labels: { color: css("--muted") } } } },
    };
  }

  const tzLabel = () => {
    const mins = -new Date().getTimezoneOffset();
    const sign = mins < 0 ? "-" : "+";
    const abs = Math.abs(mins);
    return `${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`;
  };

  // --- loading --------------------------------------------------------------------------------
  function destroyCharts() {
    for (const chart of state.charts) chart.destroy();
    state.charts = [];
  }

  async function load() {
    const ticket = ++state.loading;
    const tab = state.tab;
    try {
      const tz = -new Date().getTimezoneOffset();
      const response = await fetch(`/api/${tab}?days=${state.days}&tz=${tz}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`The server answered ${response.status}.`);
      const { data, generatedAt } = await response.json();
      if (ticket !== state.loading) return; // a newer request replaced this one
      destroyCharts();
      main.replaceChildren(RENDER[tab](data));
      $("updated").textContent = `Updated ${new Date(generatedAt).toLocaleTimeString()}`;
    } catch (error) {
      if (ticket !== state.loading) return;
      destroyCharts();
      main.replaceChildren(h("div", { class: "error", role: "alert" },
        h("strong", null, "Could not load this section. "), String(error.message ?? error)));
    }
  }

  function selectTab(tab) {
    state.tab = tab;
    for (const button of $("tabs").children) button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    history.replaceState(null, "", `#${tab}`);
    return load();
  }

  function schedule() {
    clearInterval(state.timer);
    if ($("auto").checked) state.timer = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
  }

  async function init() {
    const tabs = $("tabs");
    tabs.setAttribute("role", "tablist");
    for (const [key, name] of TABS) {
      tabs.append(h("button", { class: "tab", type: "button", role: "tab", "data-tab": key, "aria-selected": "false" }, name));
    }
    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".tab");
      if (button) selectTab(button.dataset.tab);
    });
    $("range").addEventListener("change", (event) => { state.days = Number(event.target.value); load(); });
    $("refresh").addEventListener("click", load);
    $("auto").addEventListener("change", schedule);

    const initial = location.hash.slice(1);
    if (TABS.some(([key]) => key === initial)) state.tab = initial;

    try {
      const meta = await (await fetch("/api/meta")).json();
      $("source").textContent = `${meta.demo ? "DEMO DATA: " : ""}${meta.database} (read only)`;
    } catch {
      $("source").textContent = "could not reach the server";
    }
    selectTab(state.tab);
  }

  init();
})();
