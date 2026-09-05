/**
 * Findrome Admin Dashboard - Client Logic
 * Handles authentication, submissions table, search/filter, and Excel export.
 */

// 1. DOM Elements
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPassword = document.getElementById("adminPassword");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

const submissionsTableBody = document.getElementById("submissionsTableBody");
const searchInput = document.getElementById("searchInput");
const filterProgram = document.getElementById("filterProgram");
const downloadExcelBtn = document.getElementById("downloadExcelBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

const statTotal = document.getElementById("statTotal");
const visibleCount = document.getElementById("visibleCount");
const themeToggle = document.getElementById("themeToggle");

let allSubmissions = [];
let authToken = localStorage.getItem("findrome_admin_token") || "";

// 2. Theme Toggle
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const newTheme = isDark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });
}

// 3. Authentication Management
function showLogin() {
    loginSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
    logoutBtn.classList.add("hidden");
}

function showDashboard() {
    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loadDashboardData();
}

async function verifyAuth() {
    try {
        const res = await fetch("/api/admin/check-auth", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (res.ok) {
            showDashboard();
        } else {
            logout();
        }
    } catch {
        showLogin();
    }
}

function logout() {
    authToken = "";
    localStorage.removeItem("findrome_admin_token");
    fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    showLogin();
}

// Check initial session
if (authToken) {
    verifyAuth();
} else {
    showLogin();
}

// Login Handler
if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginError.classList.add("hidden");

        const password = adminPassword.value.trim();
        if (!password) return;

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });

            const data = await res.json();
            if (data.success && data.token) {
                authToken = data.token;
                localStorage.setItem("findrome_admin_token", authToken);
                adminPassword.value = "";
                showDashboard();
            } else {
                loginError.textContent = data.message || "Invalid password";
                loginError.classList.remove("hidden");
            }
        } catch {
            loginError.textContent = "Could not connect to server.";
            loginError.classList.remove("hidden");
        }
    });
}

if (logoutBtn) logoutBtn.addEventListener("click", logout);

// 4. Data Formatting Helper
function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

// 5. Load & Render Submissions
async function loadDashboardData() {
    try {
        submissionsTableBody.innerHTML = `<tr><td colspan="7" class="table-loading">Loading registrations...</td></tr>`;

        const [subRes, statsRes] = await Promise.all([
            fetch("/api/admin/submissions", { headers: { "Authorization": `Bearer ${authToken}` } }),
            fetch("/api/admin/stats", { headers: { "Authorization": `Bearer ${authToken}` } })
        ]);

        if (subRes.status === 401 || subRes.status === 403) {
            logout();
            return;
        }

        const subData = await subRes.json();
        allSubmissions = subData.submissions || [];

        if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statTotal) statTotal.textContent = statsData.total || 0;
        }

        renderTable();
    } catch (err) {
        submissionsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Error loading data: ${err.message}</td></tr>`;
    }
}

function renderTable() {
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const prog = filterProgram ? filterProgram.value : "";

    const filtered = allSubmissions.filter(item => {
        const matchSearch = !search ||
            (item.full_name && item.full_name.toLowerCase().includes(search)) ||
            (item.email && item.email.toLowerCase().includes(search)) ||
            (item.phone && item.phone.includes(search)) ||
            (item.sap_id && item.sap_id.includes(search)) ||
            (item.branch && item.branch.toLowerCase().includes(search));

        const matchProg = !prog || item.program === prog;

        return matchSearch && matchProg;
    });

    if (visibleCount) visibleCount.textContent = filtered.length;

    if (filtered.length === 0) {
        submissionsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No registrations found.</td></tr>`;
        return;
    }

    submissionsTableBody.innerHTML = filtered.map(row => {
        return `
            <tr>
                <td><strong>#${row.id}</strong></td>
                <td style="white-space: nowrap; font-size: 12px;">${escapeHtml(row.submitted_at)}</td>
                <td>
                    <div class="candidate-name">${escapeHtml(row.full_name)}</div>
                </td>
                <td>
                    <div>${escapeHtml(row.email)}</div>
                    <div style="color: var(--text-muted); font-size: 12px;">📞 ${escapeHtml(row.phone)}</div>
                </td>
                <td><code>${escapeHtml(row.sap_id)}</code></td>
                <td>
                    <strong>${escapeHtml(row.program)}</strong>
                    <div style="color: var(--text-muted); font-size: 12px;">Year ${escapeHtml(row.year_of_study)}</div>
                </td>
                <td>
                    <span style="font-weight: 600;">${escapeHtml(row.branch)}</span>
                </td>
            </tr>
        `;
    }).join("");
}

// 6. Search & Filter Listeners
if (searchInput) searchInput.addEventListener("input", renderTable);
if (filterProgram) filterProgram.addEventListener("change", renderTable);

// 7. Download Excel
if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener("click", async () => {
        try {
            downloadExcelBtn.disabled = true;
            downloadExcelBtn.innerHTML = "Downloading...";

            const res = await fetch("/api/admin/download-excel", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            if (!res.ok) {
                alert("Failed to download Excel file. Please log in again.");
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Findrome_Event_Registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert("Error downloading Excel: " + err.message);
        } finally {
            downloadExcelBtn.disabled = false;
            downloadExcelBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Excel (.xlsx)
            `;
        }
    });
}

// 8. Clear All Test Entries
if (clearAllBtn) {
    clearAllBtn.addEventListener("click", async () => {
        const confirmed = confirm(
            "⚠️ ARE YOU SURE YOU WANT TO CLEAR ALL TEST ENTRIES?\n\nThis will permanently delete all submissions, uploaded files, and reset the Excel file."
        );
        if (!confirmed) return;

        try {
            clearAllBtn.disabled = true;
            clearAllBtn.innerHTML = "Clearing Entries...";

            const res = await fetch("/api/admin/clear-all", {
                method: "POST",
                headers: { "Authorization": `Bearer ${authToken}` }
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert(data.message || "All test entries have been cleared successfully.");
                allSubmissions = [];
                if (statTotal) statTotal.textContent = "0";
                renderTable();
            } else {
                alert(data.message || "Failed to clear entries.");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            clearAllBtn.disabled = false;
            clearAllBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Clear All Test Entries
            `;
        }
    });
}
