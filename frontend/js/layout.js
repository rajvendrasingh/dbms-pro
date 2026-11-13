/* =============================================
   Shared layout — sidebar + topbar
   Include this AFTER api.js on every page
   ============================================= */

function buildLayout(pageTitle, activePage) {
  const officer = getOfficer();
  const isAdmin = officer && ['SP','DSP','Inspector'].includes(officer.rank);

  document.body.innerHTML = `
    <div class="app-layout">

      <!-- SIDEBAR -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div style="font-size:1.6rem">🚦</div>
          <div class="logo-title">Traffic Challan</div>
          <div class="logo-sub">Smart Management System</div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-label">Main</div>
          <a class="nav-item" data-page="dashboard" href="/pages/dashboard.html">
            <span class="nav-icon">📊</span> Dashboard
          </a>
          <a class="nav-item" data-page="issue-challan" href="/pages/issue-challan.html">
            <span class="nav-icon">📝</span> Issue Challan
          </a>
          <a class="nav-item" data-page="challans" href="/pages/challans.html">
            <span class="nav-icon">📋</span> All Challans
          </a>
          <a class="nav-item" data-page="payment" href="/pages/payment.html">
            <span class="nav-icon">💳</span> Record Payment
          </a>

          <div class="nav-section-label">Vehicles</div>
          <a class="nav-item" data-page="vehicles" href="/pages/vehicles.html">
            <span class="nav-icon">🚗</span> Vehicles
          </a>
          <a class="nav-item" data-page="register-vehicle" href="/pages/register-vehicle.html">
            <span class="nav-icon">➕</span> Register Vehicle
          </a>
          <a class="nav-item" data-page="lookup" href="/pages/lookup.html">
            <span class="nav-icon">🔍</span> Vehicle Lookup
          </a>

          ${isAdmin ? `
          <div class="nav-section-label">Admin</div>
          <a class="nav-item" data-page="officers" href="/pages/officers.html">
            <span class="nav-icon">👮</span> Officers
          </a>
          <a class="nav-item" data-page="disputes" href="/pages/disputes.html">
            <span class="nav-icon">⚖️</span> Disputes
          </a>
          <a class="nav-item" data-page="reports" href="/pages/reports.html">
            <span class="nav-icon">📈</span> Reports
          </a>
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <div class="officer-info" id="sidebar-officer"></div>
          <button class="btn btn-outline btn-sm" style="margin-top:.6rem;width:100%;color:#9ca3af;border-color:#374151"
            onclick="logout()">🚪 Logout</button>
        </div>
      </aside>

      <!-- MAIN -->
      <div class="main-content">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:.75rem">
            <button id="sidebar-toggle" class="btn btn-outline btn-sm" style="display:none"
              onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button>
            <span class="topbar-title" id="page-title">${pageTitle}</span>
          </div>
          <div class="topbar-actions">
            <span style="font-size:.82rem;color:#6b7280" id="topbar-officer-name"></span>
          </div>
        </header>

        <div class="page-content" id="page-content">
          <!-- Page content injected here -->
        </div>
      </div>
    </div>
  `;

  renderSidebarOfficer();
  setActiveNav(activePage);

  const o = getOfficer();
  if (o) document.getElementById('topbar-officer-name').textContent = `${o.full_name} (${o.rank})`;

  // Mobile toggle
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar-toggle').style.display = 'flex';
  }
}
