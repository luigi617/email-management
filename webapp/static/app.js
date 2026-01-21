const state = {
  emails: [],          // EmailOverview[]
  filteredEmails: [],
  selectedId: null,    // uid of selected email
  selectedOverview: null,
  filterSenderKey: null, // acts as "account filter"
  searchText: "",
  page: 1,
  pageSize: 20,
  colorMap: {},        // account -> color
  currentMailbox: "INBOX",
  mailboxData: {},     // user_email -> [mailbox, ...]
};

const COLOR_PALETTE = [
  "#f97316", // orange
  "#22c55e", // green
  "#0ea5e9", // sky
  "#a855f7", // purple
  "#ec4899", // pink
  "#eab308", // yellow
  "#10b981", // emerald
  "#f97373", // soft red
];

document.addEventListener("DOMContentLoaded", () => {
  const prevPageBtn = document.getElementById("prev-page-btn");
  const nextPageBtn = document.getElementById("next-page-btn");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  if (prevPageBtn) prevPageBtn.addEventListener("click", () => changePage(-1));
  if (nextPageBtn) nextPageBtn.addEventListener("click", () => changePage(1));

  if (searchBtn && searchInput) {
    const triggerSearch = () => {
      state.searchText = searchInput.value.trim().toLowerCase();
      state.page = 1;
      applyFiltersAndRender();
    };

    searchBtn.addEventListener("click", triggerSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        triggerSearch();
      }
    });
  }

  // Initial load
  fetchMailboxes();
  fetchOverview();
  initDetailActions();
});

/* ------------------ Detail toolbar / move panel ------------------ */

function initDetailActions() {
  const moveBtn = document.getElementById("btn-move");
  const movePanel = document.getElementById("move-panel");
  const moveCancel = document.getElementById("move-cancel");
  const moveConfirm = document.getElementById("move-confirm");

  if (moveBtn && movePanel) {
    moveBtn.addEventListener("click", () => {
      if (!state.selectedOverview) return;
      populateMoveMailboxSelect();
      movePanel.classList.toggle("hidden");
    });
  }

  if (moveCancel && movePanel) {
    moveCancel.addEventListener("click", () => {
      movePanel.classList.add("hidden");
    });
  }

  if (moveConfirm && movePanel) {
    moveConfirm.addEventListener("click", () => {
      const select = document.getElementById("move-mailbox-select");
      if (!select || !state.selectedOverview) return;
      const targetMailbox = select.value;

      // TODO: implement backend call to move the email
      console.log("Move email to mailbox:", targetMailbox, state.selectedOverview);

      movePanel.classList.add("hidden");
    });
  }

  // Optional: stub handlers for archive/delete/reply...
  const archiveBtn = document.getElementById("btn-archive");
  const deleteBtn = document.getElementById("btn-delete");
  const replyBtn = document.getElementById("btn-reply");
  const replyAllBtn = document.getElementById("btn-reply-all");
  const forwardBtn = document.getElementById("btn-forward");

  if (archiveBtn) archiveBtn.addEventListener("click", () => {
    if (!state.selectedOverview) return;
    console.log("Archive", state.selectedOverview);
  });

  if (deleteBtn) deleteBtn.addEventListener("click", () => {
    if (!state.selectedOverview) return;
    console.log("Delete", state.selectedOverview);
  });

  if (replyBtn) replyBtn.addEventListener("click", () => {
    if (!state.selectedOverview) return;
    console.log("Reply", state.selectedOverview);
  });

  if (replyAllBtn) replyAllBtn.addEventListener("click", () => {
    if (!state.selectedOverview) return;
    console.log("Reply all", state.selectedOverview);
  });

  if (forwardBtn) forwardBtn.addEventListener("click", () => {
    if (!state.selectedOverview) return;
    console.log("Forward", state.selectedOverview);
  });
}

function populateMoveMailboxSelect() {
  const select = document.getElementById("move-mailbox-select");
  if (!select || !state.selectedOverview) return;

  const email = state.selectedOverview;
  const accountKey = findAccountForEmail(email);
  const mailboxes = state.mailboxData[accountKey] || [];

  select.innerHTML = "";

  for (const mb of mailboxes) {
    const opt = document.createElement("option");
    opt.value = mb;
    opt.textContent = mb;
    if (mb === state.currentMailbox) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }
}

/* ------------------ API calls ------------------ */

async function fetchMailboxes() {
  try {
    const res = await fetch("/api/emails/mailbox");
    if (!res.ok) throw new Error("Failed to fetch mailboxes");
    const data = await res.json(); // { user_email: [mailbox1, mailbox2], ... }

    state.mailboxData = data || {};
    renderMailboxList(data);
  } catch (err) {
    console.error("Error fetching mailboxes:", err);
  }
}

async function fetchOverview() {
  try {
    const params = new URLSearchParams({
      mailbox: state.currentMailbox,
      n: "200",
    });
    const res = await fetch(`/api/emails/overview?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch emails overview");
    const data = await res.json();
    state.emails = Array.isArray(data) ? data : [];
    buildColorMap();
    buildLegend();
    state.page = 1;
    applyFiltersAndRender();
  } catch (err) {
    console.error("Error fetching overview:", err);
    renderError("Failed to fetch emails.");
  }
}

async function fetchEmailDetail(overview) {
  if (!overview) {
    renderDetailFromOverviewOnly(overview);
    return;
  }

  const ref = overview.ref || {};

  const account = ref.account || overview.account;
  const mailbox = ref.mailbox || overview.mailbox;
  const uid = ref.uid;

  if (!account || !mailbox || uid == null) {
    renderDetailFromOverviewOnly(overview);
    return;
  }

  const accountEnc = encodeURIComponent(account);
  const mailboxEnc = encodeURIComponent(mailbox);
  const uidEnc = encodeURIComponent(uid);

  try {
    const res = await fetch(
      `/api/accounts/${accountEnc}/mailboxes/${mailboxEnc}/emails/${uidEnc}`
    );
    if (!res.ok) throw new Error("Failed to fetch email detail");
    const msg = await res.json();
    renderDetailFromMessage(overview, msg);
  } catch (err) {
    console.error("Error fetching email detail:", err);
    renderDetailFromOverviewOnly(overview);
  }
}

/* ------------------ State utilities ------------------ */

function getEmailId(email) {
  if (!email) return "";
  const ref = email.ref || {};
  if (ref.uid != null) {
    const account = ref.account || "";
    const mailbox = ref.mailbox || "";
    return `${account}:${mailbox}:${ref.uid}`;
  }
  if (email.uid != null) return String(email.uid);
  return "";
}

function buildColorMap() {
  const map = {};
  let colorIndex = 0;

  // First, assign colors to all known mailbox accounts
  const mailboxAccounts = Object.keys(state.mailboxData || {});
  for (const accountEmail of mailboxAccounts) {
    if (!map[accountEmail]) {
      map[accountEmail] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      colorIndex++;
    }
  }

  // Then ensure any other keys (fallbacks) also get a color
  for (const email of state.emails) {
    const key = findAccountForEmail(email);
    if (!map[key]) {
      map[key] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
      colorIndex++;
    }
  }

  state.colorMap = map;
}

function getAccountKey(email) {
  if (!email) return "unknown";
  const ref = email.ref || {};
  return ref.account || email.account || "unknown";
}

function findAccountForEmail(email) {
  if (!email) return "unknown";

  const mailboxAccounts = Object.keys(state.mailboxData || {});
  if (!mailboxAccounts.length) return getAccountKey(email);

  // Prefer structured `to` list
  const toList = Array.isArray(email.to) ? email.to : [];
  const toEmails = new Set(
    toList
      .map((a) => (a && a.email ? a.email.toLowerCase() : ""))
      .filter(Boolean)
  );

  for (const accountEmail of mailboxAccounts) {
    if (toEmails.has(String(accountEmail).toLowerCase())) {
      return accountEmail;
    }
  }

  // Optional: if backend sends a raw to_address field, also check that
  if (email.to_address) {
    const rawTo = String(email.to_address).toLowerCase();
    for (const accountEmail of mailboxAccounts) {
      if (rawTo.includes(String(accountEmail).toLowerCase())) {
        return accountEmail;
      }
    }
  }

  // Fallback to the original account key
  return getAccountKey(email);
}

function getColorForEmail(email) {
  const key = findAccountForEmail(email);
  return state.colorMap[key] || "#9ca3af";
}

function formatAddress(addr) {
  if (!addr) return "";
  if (addr.name) return `${addr.name} <${addr.email || ""}>`.trim();
  return addr.email || "";
}

function formatAddressList(list) {
  if (!Array.isArray(list)) return "";
  return list.map(formatAddress).filter(Boolean).join(", ");
}

/* ------------------ Filtering & rendering ------------------ */

function applyFiltersAndRender() {
  let filtered = [...state.emails];

  if (state.filterSenderKey) {
    filtered = filtered.filter(
      (e) => findAccountForEmail(e) === state.filterSenderKey
    );
  }

  if (state.searchText) {
    filtered = filtered.filter((e) => {
      const subject = (e.subject || "").toLowerCase();
      const snippet = (e.snippet || "").toLowerCase();
      const bodyPreview = (e.preview || "").toLowerCase();
      return (
        subject.includes(state.searchText) ||
        snippet.includes(state.searchText) ||
        bodyPreview.includes(state.searchText)
      );
    });
  }

  state.filteredEmails = filtered;
  renderListAndPagination();
  renderDetail();
}

function renderListAndPagination() {
  const listEl = document.getElementById("email-list");
  const emptyEl = document.getElementById("list-empty");
  const pageInfoEl = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");

  if (!listEl || !emptyEl || !pageInfoEl) return;

  const total = state.filteredEmails.length;
  const pageSize = state.pageSize || 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (state.page > totalPages) state.page = totalPages;

  const startIndex = (state.page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const slice = state.filteredEmails.slice(startIndex, endIndex);

  listEl.innerHTML = "";

  if (!slice.length) {
    emptyEl.classList.remove("hidden");
  } else {
    emptyEl.classList.add("hidden");
  }

  for (const email of slice) {
    const card = document.createElement("div");
    card.className = "email-card";

    const ref = email.ref || {};
    const emailId = getEmailId(email);

    card.dataset.uid = ref.uid != null ? ref.uid : "";
    card.dataset.account = ref.account || email.account || "";
    card.dataset.mailbox = ref.mailbox || email.mailbox || "";

    if (emailId && emailId === state.selectedId) {
      card.classList.add("selected");
    }

    const color = getColorForEmail(email);
    const fromObj = email.from_email || {};
    const fromAddr =
      fromObj.name ||
      fromObj.email ||
      "(unknown sender)";
    const dateStr = formatDate(email.date);
    const subj = email.subject || "(no subject)";
    const snippet = email.preview || "";

    card.innerHTML = `
      <div class="email-color-strip" style="background: ${color};"></div>
      <div class="email-main">
        <div class="email-row-top">
          <div class="email-from">${escapeHtml(fromAddr)}</div>
          <div class="email-date">${escapeHtml(dateStr)}</div>
        </div>
        <div class="email-subject">${escapeHtml(subj)}</div>
        <div class="email-snippet">${escapeHtml(snippet)}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      state.selectedId = getEmailId(email);
      state.selectedOverview = email;
      renderListAndPagination();
      fetchEmailDetail(email);
    });

    listEl.appendChild(card);
  }

  pageInfoEl.textContent = `Page ${state.page} / ${totalPages}`;

  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages;
}

function changePage(delta) {
  const total = state.filteredEmails.length;
  const pageSize = state.pageSize || 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const newPage = state.page + delta;
  if (newPage < 1 || newPage > totalPages) return;
  state.page = newPage;
  renderListAndPagination();
}

/* ------------------ Detail rendering ------------------ */

function renderDetail() {
  const placeholder = document.getElementById("detail-placeholder");
  const detail = document.getElementById("email-detail");
  if (!placeholder || !detail) return;

  if (!state.selectedOverview) {
    placeholder.classList.remove("hidden");
    detail.classList.add("hidden");
    return;
  }
}

/**
 * Overview-only fallback (no full message)
 */
function renderDetailFromOverviewOnly(overview) {
  const placeholder = document.getElementById("detail-placeholder");
  const detail = document.getElementById("email-detail");
  const bodyHtmlEl = document.getElementById("detail-body-html");
  const bodyTextEl = document.getElementById("detail-body-text");
  const subjectEl = document.getElementById("detail-subject");
  const fromEl = document.getElementById("detail-from");
  const toEl = document.getElementById("detail-to");
  const dtEl = document.getElementById("detail-datetime");
  const accountEl = document.getElementById("detail-account");
  const badgeEl = document.getElementById("detail-color-badge");

  if (!placeholder || !detail || !overview) return;

  placeholder.classList.add("hidden");
  detail.classList.remove("hidden");

  const fromObj = overview.from_email || {};
  const fromAddr =
    fromObj.name ||
    fromObj.email ||
    "(unknown sender)";
  const toAddr = formatAddressList(overview.to);
  const dateVerbose = formatDate(overview.date, true);
  const color = getColorForEmail(overview);

  if (subjectEl) subjectEl.textContent = overview.subject || "(no subject)";
  if (fromEl) fromEl.textContent = `From: ${fromAddr}`;
  if (toEl) toEl.textContent = toAddr ? `To: ${toAddr}` : "";
  if (dtEl) dtEl.textContent = `Date: ${dateVerbose}`;

  const ref = overview.ref || {};
  if (accountEl) {
    const account = ref.account || overview.account || "all";
    const mailbox = ref.mailbox || overview.mailbox || state.currentMailbox;
    accountEl.textContent = `Account: ${account} • Mailbox: ${mailbox}`;
  }

  if (badgeEl) badgeEl.style.background = color;

  // body: show preview as text
  if (bodyHtmlEl) {
    bodyHtmlEl.classList.add("hidden");
    bodyHtmlEl.innerHTML = "";
  }
  if (bodyTextEl) {
    bodyTextEl.classList.remove("hidden");
    bodyTextEl.textContent =
      overview.preview ||
      "(no body preview)";
  }
}

/**
 * Full message rendering: support both html + text
 */
function renderDetailFromMessage(overview, msg) {
  const placeholder = document.getElementById("detail-placeholder");
  const detail = document.getElementById("email-detail");
  if (!placeholder || !detail) return;

  placeholder.classList.add("hidden");
  detail.classList.remove("hidden");

  const subjectEl = document.getElementById("detail-subject");
  const fromEl = document.getElementById("detail-from");
  const toEl = document.getElementById("detail-to");
  const dtEl = document.getElementById("detail-datetime");
  const accountEl = document.getElementById("detail-account");
  const bodyHtmlEl = document.getElementById("detail-body-html");
  const bodyTextEl = document.getElementById("detail-body-text");
  const badgeEl = document.getElementById("detail-color-badge");

  const subj = msg.subject || (overview && overview.subject) || "(no subject)";

  const fromObj = msg.from_email || (overview && overview.from_email) || {};
  const fromAddr =
    fromObj.name ||
    fromObj.email ||
    "(unknown sender)";

  const toList = msg.to || (overview && overview.to) || [];
  const toAddr = formatAddressList(toList);

  const dateVal = msg.date || (overview && overview.date);
  const dateVerbose = formatDate(dateVal, true);

  const color = getColorForEmail(overview || msg);

  if (subjectEl) subjectEl.textContent = subj;
  if (fromEl) fromEl.textContent = `From: ${fromAddr}`;
  if (toEl) toEl.textContent = toAddr ? `To: ${toAddr}` : "";
  if (dtEl) dtEl.textContent = `Date: ${dateVerbose}`;

  const ref = (msg && msg.ref) || (overview && overview.ref) || {};
  if (accountEl) {
    const account = ref.account || (overview && overview.account) || "unknown";
    const mailbox = ref.mailbox || (overview && overview.mailbox) || state.currentMailbox;
    accountEl.textContent = `Account: ${account} • Mailbox: ${mailbox}`;
  }

  if (badgeEl) badgeEl.style.background = color;

  // Prepare bodies
  let textBody = msg.text || "";
  if (!textBody && msg.html) {
    // crude HTML -> text fallback for text pane
    textBody = msg.html.replace(/<[^>]+>/g, "");
  }
  if (!textBody && overview) {
    textBody = overview.preview || "";
  }

  const htmlBody = msg.html || "";

  // HTML body
  if (bodyHtmlEl) {
    if (htmlBody) {
      bodyHtmlEl.classList.remove("hidden");
      bodyHtmlEl.innerHTML = htmlBody;
    } else {
      bodyHtmlEl.classList.add("hidden");
      bodyHtmlEl.innerHTML = "";
    }
  }

  // Text body
  if (bodyTextEl) {
    if (textBody) {
      bodyTextEl.classList.remove("hidden");
      bodyTextEl.textContent = textBody;
    } else {
      bodyTextEl.classList.add("hidden");
      bodyTextEl.textContent = "";
    }
  }

  // If neither exists, show a simple fallback
  if (!htmlBody && !textBody && bodyTextEl) {
    bodyTextEl.classList.remove("hidden");
    bodyTextEl.textContent = "(no body)";
  }
}

/* ------------------ Mailbox list rendering ------------------ */

function renderMailboxList(mailboxData) {
  // mailboxData: { accountName: [mb1, mb2, ...] }
  const listEl = document.getElementById("mailbox-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  const entries = Object.entries(mailboxData || {});
  if (!entries.length) {
    listEl.textContent = "No mailboxes available.";
    return;
  }

  for (const [account, mailboxes] of entries) {
    const group = document.createElement("div");
    group.className = "mailbox-group";

    const accHeader = document.createElement("button");
    accHeader.type = "button";
    accHeader.className = "mailbox-account";
    accHeader.innerHTML = `
      <span class="mailbox-account-chev">▾</span>
      <span>${escapeHtml(account)}</span>
    `;

    const mbContainer = document.createElement("div");
    mbContainer.className = "mailbox-group-items";

    for (const m of mailboxes || []) {
      const item = document.createElement("div");
      item.className = "mailbox-item";
      item.dataset.mailbox = m;

      const dot = document.createElement("span");
      dot.className = "mailbox-dot";

      const label = document.createElement("span");
      label.textContent = m;

      item.appendChild(dot);
      item.appendChild(label);

      if (m === state.currentMailbox) {
        item.classList.add("active");
      }

      item.addEventListener("click", () => {
        state.currentMailbox = m;
        state.selectedId = null;
        state.selectedOverview = null;
        highlightMailboxSelection();
        fetchOverview();
      });

      mbContainer.appendChild(item);
    }

    accHeader.addEventListener("click", () => {
      const isCollapsed = mbContainer.classList.toggle("collapsed");
      accHeader.classList.toggle("collapsed", isCollapsed);
    });

    group.appendChild(accHeader);
    group.appendChild(mbContainer);
    listEl.appendChild(group);
  }

  highlightMailboxSelection();
}

function highlightMailboxSelection() {
  const listEl = document.getElementById("mailbox-list");
  if (!listEl) return;
  const items = listEl.querySelectorAll(".mailbox-item");
  items.forEach((item) => {
    const mb = item.dataset.mailbox;
    if (mb === state.currentMailbox) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

/* ------------------ Legend ------------------ */

function buildLegend() {
  const legendEl = document.getElementById("legend-list");
  if (!legendEl) return;

  legendEl.innerHTML = "";

  const mailboxAccounts = Object.keys(state.mailboxData || {});
  const counts = {};

  // Init counts for all mailbox accounts
  for (const accountEmail of mailboxAccounts) {
    counts[accountEmail] = 0;
  }

  // Count emails by which account appears in the To: field
  for (const email of state.emails) {
    const key = findAccountForEmail(email);
    if (key in counts) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  // Sort by count desc, then name
  const entries = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  for (const [accountEmail] of entries) {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.key = accountEmail;

    const color = state.colorMap[accountEmail] || "#9ca3af";

    item.innerHTML = `
      <span class="legend-color-dot" style="background: ${color};"></span>
      <span>${escapeHtml(accountEmail)}</span>
    `;

    item.addEventListener("click", () => {
      if (state.filterSenderKey === accountEmail) {
        state.filterSenderKey = null;
      } else {
        state.filterSenderKey = accountEmail;
      }
      state.page = 1;
      applyFiltersAndRender();
      highlightLegendSelection();
    });

    legendEl.appendChild(item);
  }

  highlightLegendSelection();
}

function highlightLegendSelection() {
  const legendEl = document.getElementById("legend-list");
  if (!legendEl) return;
  const items = legendEl.querySelectorAll(".legend-item");
  items.forEach((item) => {
    const key = item.dataset.key;
    if (key && key === state.filterSenderKey) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

/* ------------------ Misc utilities ------------------ */

function renderError(msg) {
  const listEl = document.getElementById("email-list");
  const emptyEl = document.getElementById("list-empty");
  if (listEl) listEl.innerHTML = "";
  if (emptyEl) {
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = msg;
  }
}

function formatDate(value, verbose = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  if (verbose) {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
