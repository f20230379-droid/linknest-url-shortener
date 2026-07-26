(async () => {
const {
    data: { session }
} = await window.supabaseClient.auth.getSession();

if (!session) {
    window.location.href = "/login.html";
    return;
}


const user = session.user;
const form = document.querySelector("#link-form");
const destinationInput = document.querySelector("#destination");
const aliasInput = document.querySelector("#alias");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const list = document.querySelector("#link-list");
const toast = document.querySelector("#toast");

let toastTimer;

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(value) {
  if (!value) return "No visits yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

async function copyLink(shortUrl) {
  try {
    await navigator.clipboard.writeText(shortUrl);
    showToast("Short link copied");
  } catch {
    showToast("Copy failed — select the link instead");
  }
}

async function deleteLink(code) {
  if (!window.confirm("Delete this short link? This cannot be undone.")) return;
  const response = await fetch(`/api/links/${encodeURIComponent(code)}`, { method: "DELETE" });
  if (!response.ok) return showToast("Could not delete that link");
  showToast("Link deleted");
  loadDashboard();
}

function renderLinks(links) {
  list.innerHTML = "";
  if (!links.length) {
    list.append(document.querySelector("#empty-state").content.cloneNode(true));
    return;
  }
  links.forEach((link) => {
    const row = document.createElement("article");
    row.className = "link-row";
    row.innerHTML = `
      <div><a class="short-link" href="${escapeHtml(link.shortUrl)}" target="_blank" rel="noopener">${escapeHtml(link.shortUrl.replace(/^https?:\/\//, ""))}</a><div class="destination" title="${escapeHtml(link.destination)}">${escapeHtml(link.destination)}</div></div>
      <div><span class="metric-label">Clicks</span><strong class="metric-value">${link.clicks}</strong></div>
      <div class="visit-metric"><span class="metric-label">Last visited</span><strong class="metric-value">${formatTime(link.lastVisitedAt)}</strong></div>
      <div><button class="copy-button" type="button">Copy</button><button class="delete-button" type="button" aria-label="Delete ${escapeHtml(link.code)}">×</button></div>`;
    row.querySelector(".copy-button").addEventListener("click", () => copyLink(link.shortUrl));
    row.querySelector(".delete-button").addEventListener("click", () => deleteLink(link.code));
    list.append(row);
  });
}

async function loadDashboard() {
  try {
    const [linksResponse, summaryResponse] = await Promise.all([fetch("/api/links"), fetch("/api/summary")]);
    if (!linksResponse.ok || !summaryResponse.ok) throw new Error();
    const { links } = await linksResponse.json();
    const summary = await summaryResponse.json();
    document.querySelector("#link-count").textContent = summary.linkCount;
    document.querySelector("#click-count").textContent = summary.clicks;
    document.querySelector("#latest-visit").textContent = formatDate(summary.latestVisit);
    document.querySelector("#domain-prefix").textContent = `${window.location.host}/`;
    renderLinks(links);
  } catch {
    list.innerHTML = '<div class="empty-state"><h3>Could not load your dashboard</h3><p>Check that the server is running and refresh the page.</p></div>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  message.className = "form-message";
  submitButton.disabled = true;
  submitButton.textContent = "Creating…";
  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: destinationInput.value, alias: aliasInput.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    form.reset();
    message.textContent = `Ready to share: ${result.link.shortUrl}`;
    message.classList.add("success");
    showToast("Your short link is ready");
    await loadDashboard();
  } catch (error) {
    message.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Create link <span>→</span>';
  }
});

document.querySelector("#refresh-button").addEventListener("click", loadDashboard);
loadDashboard();
})();
