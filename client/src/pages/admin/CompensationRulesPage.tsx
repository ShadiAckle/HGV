import { useState, useEffect } from 'react';
import { Settings, DollarSign, Filter, Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type {
  TourStatusConfig,
  TourStatusConfigInput,
  CompRuleConfig,
  CompRuleConfigInput,
  RepFilterConfig,
  RepFilterConfigInput,
} from '@shared/compConfigTypes';
import { formatTourStatusDisplay } from '@shared/compConfigTypes';

type TabType = 'tour-status' | 'comp-rules' | 'rep-filters';

export function CompensationRulesPage() {
  const { activeRepId, appReady } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabType>('tour-status');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tour Status Config State
  const [tourStatusConfigs, setTourStatusConfigs] = useState<TourStatusConfig[]>([]);
  const [editingTourStatus, setEditingTourStatus] = useState<TourStatusConfig | null>(null);
  const [showTourStatusForm, setShowTourStatusForm] = useState(false);

  // Comp Rule Config State
  const [compRuleConfigs, setCompRuleConfigs] = useState<CompRuleConfig[]>([]);
  const [editingCompRule, setEditingCompRule] = useState<CompRuleConfig | null>(null);
  const [showCompRuleForm, setShowCompRuleForm] = useState(false);

  // Rep Filter Config State
  const [repFilterConfigs, setRepFilterConfigs] = useState<RepFilterConfig[]>([]);
  const [editingRepFilter, setEditingRepFilter] = useState<RepFilterConfig | null>(null);
  const [showRepFilterForm, setShowRepFilterForm] = useState(false);

  useEffect(() => {
    if (appReady) {
      loadTourStatusConfigs();
      loadCompRuleConfigs();
      loadRepFilterConfigs();
    }
  }, [appReady]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Tour Status Config CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const loadTourStatusConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tour-status-config');
      const data = await res.json();
      setTourStatusConfigs(data.configs || []);
    } catch (err) {
      showMessage('error', 'Failed to load tour status configs');
    } finally {
      setLoading(false);
    }
  };

  const saveTourStatusConfig = async (input: TourStatusConfigInput) => {
    setLoading(true);
    try {
      const url = editingTourStatus
        ? `/api/admin/tour-status-config/${editingTourStatus.config_id}`
        : '/api/admin/tour-status-config';
      const method = editingTourStatus ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Save failed');

      showMessage('success', `Tour status config ${editingTourStatus ? 'updated' : 'created'} successfully`);
      setShowTourStatusForm(false);
      setEditingTourStatus(null);
      await loadTourStatusConfigs();
    } catch (err) {
      showMessage('error', 'Failed to save tour status config');
    } finally {
      setLoading(false);
    }
  };

  const deleteTourStatusConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this tour status mapping?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tour-status-config/${configId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Delete failed');

      showMessage('success', 'Tour status config deleted successfully');
      await loadTourStatusConfigs();
    } catch (err) {
      showMessage('error', 'Failed to delete tour status config');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Comp Rule Config CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const loadCompRuleConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/comp-rule-config');
      const data = await res.json();
      setCompRuleConfigs(data.configs || []);
    } catch (err) {
      showMessage('error', 'Failed to load comp rule configs');
    } finally {
      setLoading(false);
    }
  };

  const saveCompRuleConfig = async (input: CompRuleConfigInput) => {
    setLoading(true);
    try {
      const url = editingCompRule
        ? `/api/admin/comp-rule-config/${editingCompRule.config_id}`
        : '/api/admin/comp-rule-config';
      const method = editingCompRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Save failed');

      showMessage('success', `Comp rule ${editingCompRule ? 'updated' : 'created'} successfully`);
      setShowCompRuleForm(false);
      setEditingCompRule(null);
      await loadCompRuleConfigs();
    } catch (err) {
      showMessage('error', 'Failed to save comp rule config');
    } finally {
      setLoading(false);
    }
  };

  const deleteCompRuleConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this compensation rule?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/comp-rule-config/${configId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Delete failed');

      showMessage('success', 'Comp rule deleted successfully');
      await loadCompRuleConfigs();
    } catch (err) {
      showMessage('error', 'Failed to delete comp rule');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Rep Filter Config CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const loadRepFilterConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rep-filter-config');
      const data = await res.json();
      setRepFilterConfigs(data.configs || []);
    } catch (err) {
      showMessage('error', 'Failed to load rep filter configs');
    } finally {
      setLoading(false);
    }
  };

  const saveRepFilterConfig = async (input: RepFilterConfigInput) => {
    setLoading(true);
    try {
      const url = editingRepFilter
        ? `/api/admin/rep-filter-config/${editingRepFilter.config_id}`
        : '/api/admin/rep-filter-config';
      const method = editingRepFilter ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Save failed');

      showMessage('success', `Rep filter ${editingRepFilter ? 'updated' : 'created'} successfully`);
      setShowRepFilterForm(false);
      setEditingRepFilter(null);
      await loadRepFilterConfigs();
    } catch (err) {
      showMessage('error', 'Failed to save rep filter config');
    } finally {
      setLoading(false);
    }
  };

  const deleteRepFilterConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this rep filter rule?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rep-filter-config/${configId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: activeRepId || 'system' }),
      });

      if (!res.ok) throw new Error('Delete failed');

      showMessage('success', 'Rep filter deleted successfully');
      await loadRepFilterConfigs();
    } catch (err) {
      showMessage('error', 'Failed to delete rep filter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0a2540 0%, #12365a 100%)' }}
      >
        <div className="px-8 py-8 sm:px-10 sm:py-9">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white/90 border border-white/15">
            Admin Configuration
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Compensation Rules
          </h1>
          <p className="mt-2 text-sm text-white/75 max-w-3xl leading-relaxed">
            Self-service configuration for tour status payouts, credit attribution policies, and rep filtering rules.
            Changes apply immediately to new comp calculations.
          </p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`rounded-lg p-4 flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-900' : 'text-red-900'}`}>
            {message.text}
          </span>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl p-1.5"
        style={{ background: '#eef1f5', border: '1px solid #dde3ea' }}
      >
        <TabButton
          active={activeTab === 'tour-status'}
          onClick={() => setActiveTab('tour-status')}
          icon={<DollarSign className="h-4 w-4" />}
          label="Tour Status Payouts"
        />
        <TabButton
          active={activeTab === 'comp-rules'}
          onClick={() => setActiveTab('comp-rules')}
          icon={<Settings className="h-4 w-4" />}
          label="Comp Rules"
        />
        <TabButton
          active={activeTab === 'rep-filters'}
          onClick={() => setActiveTab('rep-filters')}
          icon={<Filter className="h-4 w-4" />}
          label="Rep Filters"
        />
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in-up">
        {activeTab === 'tour-status' && (
          <TourStatusConfigTab
            configs={tourStatusConfigs}
            loading={loading}
            onAdd={() => {
              setEditingTourStatus(null);
              setShowTourStatusForm(true);
            }}
            onEdit={(config) => {
              setEditingTourStatus(config);
              setShowTourStatusForm(true);
            }}
            onDelete={deleteTourStatusConfig}
            showForm={showTourStatusForm}
            editingConfig={editingTourStatus}
            onSave={saveTourStatusConfig}
            onCancel={() => {
              setShowTourStatusForm(false);
              setEditingTourStatus(null);
            }}
          />
        )}

        {activeTab === 'comp-rules' && (
          <CompRuleConfigTab
            configs={compRuleConfigs}
            loading={loading}
            onAdd={() => {
              setEditingCompRule(null);
              setShowCompRuleForm(true);
            }}
            onEdit={(config) => {
              setEditingCompRule(config);
              setShowCompRuleForm(true);
            }}
            onDelete={deleteCompRuleConfig}
            showForm={showCompRuleForm}
            editingConfig={editingCompRule}
            onSave={saveCompRuleConfig}
            onCancel={() => {
              setShowCompRuleForm(false);
              setEditingCompRule(null);
            }}
          />
        )}

        {activeTab === 'rep-filters' && (
          <RepFilterConfigTab
            configs={repFilterConfigs}
            loading={loading}
            onAdd={() => {
              setEditingRepFilter(null);
              setShowRepFilterForm(true);
            }}
            onEdit={(config) => {
              setEditingRepFilter(config);
              setShowRepFilterForm(true);
            }}
            onDelete={deleteRepFilterConfig}
            showForm={showRepFilterForm}
            editingConfig={editingRepFilter}
            onSave={saveRepFilterConfig}
            onCancel={() => {
              setShowRepFilterForm(false);
              setEditingRepFilter(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Button Component
// ─────────────────────────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold transition-all"
      style={
        active
          ? { background: '#fff', color: '#0a2540', boxShadow: '0 1px 4px rgba(10,37,64,0.12)' }
          : { color: '#64748b' }
      }
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour Status Config Tab
// ─────────────────────────────────────────────────────────────────────────────

interface TourStatusConfigTabProps {
  configs: TourStatusConfig[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (config: TourStatusConfig) => void;
  onDelete: (configId: string) => void;
  showForm: boolean;
  editingConfig: TourStatusConfig | null;
  onSave: (input: TourStatusConfigInput) => void;
  onCancel: () => void;
}

function TourStatusConfigTab({
  configs,
  loading,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingConfig,
  onSave,
  onCancel,
}: TourStatusConfigTabProps) {
  const [formData, setFormData] = useState<TourStatusConfigInput>({
    tour_status_desc: '',
    payout_amount: 0,
    is_active: true,
    effective_start_date: new Date().toISOString().split('T')[0],
    created_by: '',
  });

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        tour_status_desc: editingConfig.tour_status_desc,
        payout_amount: editingConfig.payout_amount,
        is_active: editingConfig.is_active,
        effective_start_date: editingConfig.effective_start_date,
        effective_end_date: editingConfig.effective_end_date ?? undefined,
        created_by: '',
      });
    } else {
      setFormData({
        tour_status_desc: '',
        payout_amount: 0,
        is_active: true,
        effective_start_date: new Date().toISOString().split('T')[0],
        created_by: '',
      });
    }
  }, [editingConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Tour Status Payout Mappings</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Define payout amounts for each tour status value from Cognos data
          </p>
        </div>
        {!showForm && (
          <button
            onClick={onAdd}
            className="btn btn-primary flex items-center gap-2"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            Add Status
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tour Status <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.tour_status_desc || ''}
                onChange={(e) => setFormData({ ...formData, tour_status_desc: e.target.value || null })}
                className="input w-full"
                placeholder="e.g., SHOW, TOUR, NO SHOW, null"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty for null/unknown status</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Payout Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.payout_amount}
                onChange={(e) => setFormData({ ...formData, payout_amount: parseFloat(e.target.value) || 0 })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effective_start_date}
                onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={formData.effective_end_date || ''}
                onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value || undefined })}
                className="input w-full"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="ts-is-active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="ts-is-active" className="text-xs text-foreground">
                Active (applies to comp calculations)
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={loading}>
              <Save className="h-4 w-4" />
              {editingConfig ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary flex items-center gap-2">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold text-foreground">Status</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Payout</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Effective Date</th>
                <th className="text-center py-2 px-3 font-semibold text-foreground">Status</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.config_id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 font-mono">{formatTourStatusDisplay(config.tour_status_desc)}</td>
                  <td className="py-2 px-3 text-right font-semibold">${config.payout_amount.toFixed(2)}</td>
                  <td className="py-2 px-3">{config.effective_start_date}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => onEdit(config)}
                      className="text-primary hover:text-primary-dark mr-2"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => onDelete(config.config_id)}
                      className="text-destructive hover:text-destructive-dark"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comp Rule Config Tab (Simplified similar structure)
// ─────────────────────────────────────────────────────────────────────────────

interface CompRuleConfigTabProps {
  configs: CompRuleConfig[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (config: CompRuleConfig) => void;
  onDelete: (configId: string) => void;
  showForm: boolean;
  editingConfig: CompRuleConfig | null;
  onSave: (input: CompRuleConfigInput) => void;
  onCancel: () => void;
}

function CompRuleConfigTab({
  configs,
  loading,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingConfig,
  onSave,
  onCancel,
}: CompRuleConfigTabProps) {
  const [formData, setFormData] = useState<CompRuleConfigInput>({
    rule_name: '',
    rule_value: '',
    is_active: true,
    effective_start_date: new Date().toISOString().split('T')[0],
    created_by: '',
  });

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        rule_name: editingConfig.rule_name,
        rule_value: editingConfig.rule_value,
        rule_description: editingConfig.rule_description ?? undefined,
        is_active: editingConfig.is_active,
        effective_start_date: editingConfig.effective_start_date,
        effective_end_date: editingConfig.effective_end_date ?? undefined,
        created_by: '',
      });
    } else {
      setFormData({
        rule_name: 'multi_rep_credit_policy',
        rule_value: 'first_rep_only',
        is_active: true,
        effective_start_date: new Date().toISOString().split('T')[0],
        created_by: '',
      });
    }
  }, [editingConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Compensation Rules</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Global rules for credit attribution, thresholds, and business logic
          </p>
        </div>
        {!showForm && (
          <button onClick={onAdd} className="btn btn-primary flex items-center gap-2" disabled={loading}>
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                className="input w-full"
                required
              >
                <option value="multi_rep_credit_policy">Multi-Rep Credit Policy</option>
                <option value="min_tour_count_threshold">Min Tour Count Threshold</option>
                <option value="default_payout_amount">Default Payout Amount</option>
                <option value="null_status_handling">Null Status Handling</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Rule Value <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.rule_value}
                onChange={(e) => setFormData({ ...formData, rule_value: e.target.value })}
                className="input w-full"
                placeholder="e.g., first_rep_only, 5, 50.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effective_start_date}
                onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={formData.effective_end_date || ''}
                onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value || undefined })}
                className="input w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">Description (Optional)</label>
              <textarea
                value={formData.rule_description ?? ''}
                onChange={(e) => setFormData({ ...formData, rule_description: e.target.value || null })}
                className="input w-full"
                rows={2}
                placeholder="Explain what this rule does..."
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="cr-is-active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="cr-is-active" className="text-xs text-foreground">
                Active (applies to comp calculations)
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={loading}>
              <Save className="h-4 w-4" />
              {editingConfig ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary flex items-center gap-2">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold text-foreground">Rule Name</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Value</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Effective Date</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Description</th>
                <th className="text-center py-2 px-3 font-semibold text-foreground">Status</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.config_id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 font-mono text-xs">{config.rule_name}</td>
                  <td className="py-2 px-3 font-semibold">{config.rule_value}</td>
                  <td className="py-2 px-3">{config.effective_start_date}</td>
                  <td className="py-2 px-3 text-muted-foreground">{config.rule_description ?? '—'}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => onEdit(config)}
                      className="text-primary hover:text-primary-dark mr-2"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => onDelete(config.config_id)}
                      className="text-destructive hover:text-destructive-dark"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep Filter Config Tab (Similar structure)
// ─────────────────────────────────────────────────────────────────────────────

interface RepFilterConfigTabProps {
  configs: RepFilterConfig[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (config: RepFilterConfig) => void;
  onDelete: (configId: string) => void;
  showForm: boolean;
  editingConfig: RepFilterConfig | null;
  onSave: (input: RepFilterConfigInput) => void;
  onCancel: () => void;
}

function RepFilterConfigTab({
  configs,
  loading,
  onAdd,
  onEdit,
  onDelete,
  showForm,
  editingConfig,
  onSave,
  onCancel,
}: RepFilterConfigTabProps) {
  const [formData, setFormData] = useState<RepFilterConfigInput>({
    filter_name: '',
    filter_type: 'exclude_pattern',
    filter_value: '',
    is_active: true,
    effective_start_date: new Date().toISOString().split('T')[0],
    created_by: '',
  });

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        filter_name: editingConfig.filter_name,
        filter_type: editingConfig.filter_type,
        filter_value: editingConfig.filter_value,
        is_active: editingConfig.is_active,
        effective_start_date: editingConfig.effective_start_date,
        effective_end_date: editingConfig.effective_end_date ?? undefined,
        created_by: '',
      });
    } else {
      setFormData({
        filter_name: '',
        filter_type: 'exclude_pattern',
        filter_value: '',
        is_active: true,
        effective_start_date: new Date().toISOString().split('T')[0],
        created_by: '',
      });
    }
  }, [editingConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Rep Filtering Rules</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Define rules to include/exclude reps from dim_marketing_rep
          </p>
        </div>
        {!showForm && (
          <button onClick={onAdd} className="btn btn-primary flex items-center gap-2" disabled={loading}>
            <Plus className="h-4 w-4" />
            Add Filter
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Filter Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.filter_name}
                onChange={(e) => setFormData({ ...formData, filter_name: e.target.value })}
                className="input w-full"
                placeholder="e.g., Exclude UNASSIGNED"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Filter Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.filter_type}
                onChange={(e) => setFormData({ ...formData, filter_type: e.target.value })}
                className="input w-full"
                required
              >
                <option value="exclude_pattern">Exclude Pattern</option>
                <option value="min_tour_count">Min Tour Count</option>
                <option value="site_filter">Site Filter</option>
                <option value="role_filter">Role Filter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Filter Value <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.filter_value}
                onChange={(e) => setFormData({ ...formData, filter_value: e.target.value })}
                className="input w-full"
                placeholder="e.g., UNASSIGNED, TBD, 5"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effective_start_date}
                onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={formData.effective_end_date || ''}
                onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value || undefined })}
                className="input w-full"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="rf-is-active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="rf-is-active" className="text-xs text-foreground">
                Active (applies to rep list generation)
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={loading}>
              <Save className="h-4 w-4" />
              {editingConfig ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary flex items-center gap-2">
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold text-foreground">Name</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Type</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Value</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Effective Date</th>
                <th className="text-center py-2 px-3 font-semibold text-foreground">Status</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.config_id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3">{config.filter_name}</td>
                  <td className="py-2 px-3">{config.filter_type}</td>
                  <td className="py-2 px-3 font-mono">{config.filter_value}</td>
                  <td className="py-2 px-3">{config.effective_start_date}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => onEdit(config)}
                      className="text-primary hover:text-primary-dark mr-2"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => onDelete(config.config_id)}
                      className="text-destructive hover:text-destructive-dark"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
