const { useState, useEffect } = React;

function DashboardApp() {
  const [token, setToken] = useState(localStorage.getItem('lc_token') || '');
  const [user, setUser] = useState(null);
  const [view, setView] = useState('summary'); // 'summary' | 'widgets' | 'submissions'
  
  const [summary, setSummary] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState('');
  const [widgetSubmissions, setWidgetSubmissions] = useState([]);
  const [widgetStats, setWidgetStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auth form
  const [isRegister, setIsRegister] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOrgName, setAuthOrgName] = useState('');

  // Create Widget form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetType, setNewWidgetType] = useState('signup');
  const [newWidgetDesc, setNewWidgetDesc] = useState('');
  const [newWidgetBtn, setNewWidgetBtn] = useState('Get Started');

  useEffect(() => {
    if (token) {
      fetchUser();
      loadDashboardData();
    }
  }, [token]);

  async function apiFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...options.headers
    };
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Request failed with status ' + res.status);
    }
    return data;
  }

  async function fetchUser() {
    try {
      const res = await apiFetch('/api/auth/me');
      setUser(res.data);
    } catch (err) {
      logout();
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    setError('');
    try {
      const [sumRes, widgRes] = await Promise.all([
        apiFetch('/api/dashboard/summary'),
        apiFetch('/api/widgets')
      ]);
      setSummary(sumRes.data);
      setWidgets(widgRes.data || []);
      if (widgRes.data && widgRes.data.length > 0 && !selectedWidgetId) {
        setSelectedWidgetId(widgRes.data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister 
        ? { email: authEmail, password: authPassword, tenantName: authOrgName }
        : { email: authEmail, password: authPassword };
      
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('lc_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('lc_token');
    setToken('');
    setUser(null);
    setSummary(null);
    setWidgets([]);
  }

  async function handleCreateWidget(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/widgets', {
        method: 'POST',
        body: JSON.stringify({
          title: newWidgetTitle,
          type: newWidgetType,
          description: newWidgetDesc,
          buttonText: newWidgetBtn,
          formFields: [
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'email', label: 'Work Email', type: 'email', required: true },
            { name: 'company', label: 'Company / Note', type: 'text', required: false }
          ]
        })
      });
      setShowCreateModal(false);
      setNewWidgetTitle('');
      setNewWidgetDesc('');
      setSuccessMsg('Widget created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadDashboardData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteWidget(id) {
    if (!confirm('Are you sure you want to delete this widget? All its submissions will also be deleted.')) return;
    try {
      await apiFetch('/api/widgets/' + id, { method: 'DELETE' });
      loadDashboardData();
    } catch (err) {
      alert('Error deleting widget: ' + err.message);
    }
  }

  async function loadWidgetSubmissions(widgetId) {
    if (!widgetId) return;
    setLoading(true);
    try {
      const [subRes, statRes] = await Promise.all([
        apiFetch('/api/dashboard/widgets/' + widgetId + '/submissions'),
        apiFetch('/api/dashboard/widgets/' + widgetId + '/stats')
      ]);
      setWidgetSubmissions(subRes.data.submissions || []);
      setWidgetStats(statRes.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (view === 'submissions' && selectedWidgetId) {
      loadWidgetSubmissions(selectedWidgetId);
    }
  }, [view, selectedWidgetId]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white text-2xl font-bold mb-3 shadow-lg shadow-blue-500/30">
              ⚡
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Lead Capture Platform</h1>
            <p className="text-slate-500 text-sm mt-1">
              {isRegister ? 'Register your organization account' : 'Sign in to your organization dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Organization Name</label>
                <input 
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={authOrgName}
                  onChange={e => setAuthOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
              <input 
                type="email"
                required
                placeholder="owner@example.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Password</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isRegister ? 'Register' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {isRegister ? (
              <span>Already have an account? <button onClick={() => { setIsRegister(false); setError(''); }} className="text-blue-600 font-semibold hover:underline">Log in</button></span>
            ) : (
              <span>New customer? <button onClick={() => { setIsRegister(true); setError(''); }} className="text-blue-600 font-semibold hover:underline">Create account</button></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <nav className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">⚡</span>
          <div>
            <span className="font-bold tracking-tight text-lg">Lead Capture Platform</span>
            <span className="ml-3 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
              {user?.tenantName || 'Tenant Organization'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <span className="text-sm text-slate-400">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Sub Navigation */}
      <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
        <div className="flex space-x-4">
          <button
            onClick={() => setView('summary')}
            className={'text-sm font-medium px-3 py-1.5 rounded-lg transition ' + (view === 'summary' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900')}
          >
            📊 Overview & Analytics
          </button>
          <button
            onClick={() => setView('widgets')}
            className={'text-sm font-medium px-3 py-1.5 rounded-lg transition ' + (view === 'widgets' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900')}
          >
            🧩 Widgets ({widgets.length})
          </button>
          <button
            onClick={() => setView('submissions')}
            className={'text-sm font-medium px-3 py-1.5 rounded-lg transition ' + (view === 'submissions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900')}
          >
            📥 Submissions Feed
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/test-customer-site.html"
            target="_blank"
            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition"
          >
            ↗ Customer Test Site
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-sm"
          >
            + Create Widget
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
            {successMsg}
          </div>
        )}

        {/* VIEW 1: Summary Analytics */}
        {view === 'summary' && summary && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">{summary.totalSubmissions}</p>
                <span className="text-xs text-blue-600 font-medium mt-1 inline-block">Organization total</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified Leads</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-2">{summary.validSubmissions}</p>
                <span className="text-xs text-emerald-600 font-medium mt-1 inline-block">Clean human visitors</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spam Blocked</p>
                <p className="text-3xl font-extrabold text-amber-600 mt-2">{summary.spamSubmissions}</p>
                <span className="text-xs text-amber-600 font-medium mt-1 inline-block">Honeypot trapped</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Widgets</p>
                <p className="text-3xl font-extrabold text-blue-600 mt-2">{summary.totalWidgets}</p>
                <span className="text-xs text-slate-500 font-medium mt-1 inline-block">Tenant isolated</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Geographies */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center justify-between">
                  <span>🌍 Top Visitor Geographies</span>
                  <span className="text-xs font-normal text-slate-500">Auto-enriched via Fallback Chain</span>
                </h3>
                {summary.topCountries.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No location data recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.topCountries.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-medium">{c.country}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full" 
                              style={{ width: Math.min(100, (c.count / (summary.totalSubmissions || 1)) * 100) + '%' }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-900 w-8 text-right">{c.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Submissions */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 text-base mb-4">⏱️ Recent Inbound Leads</h3>
                {summary.recentSubmissions.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No submissions received yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {summary.recentSubmissions.map((s, i) => (
                      <div key={i} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {s.answers?.email || s.answers?.name || 'Anonymous Visitor'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Widget: {s.widget?.title || s.widgetId} • {s.country || 'Unknown location'}
                          </p>
                        </div>
                        <div className="text-right">
                          {s.isSpam ? (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">BOT SPAM</span>
                          ) : (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">VALID LEAD</span>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            {new Date(s.submittedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Widgets Management */}
        {view === 'widgets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Your Organization's Widgets</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                + Add New Widget
              </button>
            </div>

            {widgets.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                <p className="text-slate-500 mb-4">You haven't created any widgets yet.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  Create your first widget
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {widgets.map(w => (
                  <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded uppercase">
                            {w.type}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900 mt-2">{w.title}</h3>
                          {w.description && <p className="text-sm text-slate-500 mt-1">{w.description}</p>}
                        </div>
                        <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                          {w.submissionCount || 0} leads
                        </span>
                      </div>

                      <div className="mt-4 p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono select-all overflow-x-auto">
                        {w.embedSnippet}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <a
                        href={'/test-customer-site.html?id=' + w.id}
                        target="_blank"
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        ↗ Test Live in Customer Demo
                      </a>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => { setSelectedWidgetId(w.id); setView('submissions'); }}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          View Leads
                        </button>
                        <button
                          onClick={() => handleDeleteWidget(w.id)}
                          className="text-xs text-red-600 hover:bg-red-50 font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Submissions Feed */}
        {view === 'submissions' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Lead Submissions Feed</h2>
                <p className="text-sm text-slate-500">Live incoming leads and spam protection metrics</p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-xs font-semibold text-slate-600">Select Widget:</label>
                <select
                  value={selectedWidgetId}
                  onChange={e => setSelectedWidgetId(e.target.value)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {widgets.map(w => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Widget Stats Banner */}
            {widgetStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Total Submissions</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{widgetStats.totalSubmissions}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Valid Leads</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{widgetStats.validSubmissions}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-semibold">Spam Blocked</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{widgetStats.spamSubmissions}</p>
                </div>
              </div>
            )}

            {/* Submissions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {widgetSubmissions.length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-sm">No submissions recorded for this widget yet.</p>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Submitted Answers</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {widgetSubmissions.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <pre className="text-xs bg-slate-50 p-1.5 rounded font-mono max-w-xs overflow-x-auto">
                            {JSON.stringify(s.answers, null, 2)}
                          </pre>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">{s.ipAddress || '127.0.0.1'}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {s.city ? s.city + ', ' : ''}{s.country || 'Unknown'}
                        </td>
                        <td className="py-3 px-4">
                          {s.isSpam ? (
                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold">Bot Spam</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold">Valid</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(s.submittedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Create Widget */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Lead Capture Widget</h3>
            <form onSubmit={handleCreateWidget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Widget Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Join the Beta Waitlist"
                  value={newWidgetTitle}
                  onChange={e => setNewWidgetTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Widget Type</label>
                <select
                  value={newWidgetType}
                  onChange={e => setNewWidgetType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="signup">Signup / Newsletter Form</option>
                  <option value="contact">Contact Inquiry Form</option>
                  <option value="feedback">Feedback / Survey Form</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Description</label>
                <textarea
                  placeholder="e.g. Subscribe to receive weekly industry insights."
                  value={newWidgetDesc}
                  onChange={e => setNewWidgetDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Button Text</label>
                <input
                  type="text"
                  required
                  value={newWidgetBtn}
                  onChange={e => setNewWidgetBtn(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create & Generate Snippet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DashboardApp />);
