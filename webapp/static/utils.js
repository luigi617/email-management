(function (global) {
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

  function formatDate(value, verbose) {
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

  function formatAddress(addr) {
    if (!addr) return "";
    if (addr.name && addr.email) return `${addr.name} <${addr.email}>`;
    if (addr.name) return addr.name;
    return addr.email || "";
  }

  function formatAddressList(list) {
    if (!Array.isArray(list)) return "";
    return list.map(formatAddress).filter(Boolean).join(", ");
  }

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

  function getAccountKey(email) {
    if (!email) return "unknown";
    const ref = email.ref || {};
    return ref.account || email.account || "unknown";
  }

  function findAccountForEmail(email, mailboxData) {
    if (!email) return "unknown";

    const ref = email.ref || {};
    if (ref.account) return ref.account;

    const mailboxAccounts = Object.keys(mailboxData || {});
    if (!mailboxAccounts.length) return getAccountKey(email);

    const toList = Array.isArray(email.to) ? email.to : [];
    const toEmails = new Set(
      toList
        .map((a) => (a && a.email ? a.email.toLowerCase() : ""))
        .filter(Boolean)
    );

    for (const account of mailboxAccounts) {
      if (toEmails.has(String(account).toLowerCase())) {
        return account;
      }
    }

    if (email.to_address) {
      const rawTo = String(email.to_address).toLowerCase();
      for (const account of mailboxAccounts) {
        if (rawTo.includes(String(account).toLowerCase())) {
          return account;
        }
      }
    }

    return getAccountKey(email);
  }

  function buildColorMap(emails, mailboxData) {
    const map = {};
    let colorIndex = 0;

    const mailboxAccounts = Object.keys(mailboxData || {});
    for (const account of mailboxAccounts) {
      if (!map[account]) {
        map[account] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
      }
    }

    for (const email of emails || []) {
      const key = findAccountForEmail(email, mailboxData);
      if (!map[key]) {
        map[key] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
      }
    }

    return map;
  }

  function getColorForEmail(email, mailboxData, colorMap) {
    const key = findAccountForEmail(email, mailboxData);
    return (colorMap && colorMap[key]) || "#9ca3af";
  }

  global.Utils = {
    COLOR_PALETTE,
    formatDate,
    escapeHtml,
    formatAddress,
    formatAddressList,
    getEmailId,
    getAccountKey,
    findAccountForEmail,
    buildColorMap,
    getColorForEmail,
  };
})(window);
