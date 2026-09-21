import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitMerge, 
  X, 
  Ship, 
  FileText, 
  Upload, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Search, 
  Plus, 
  Trash2, 
  Layers, 
  Loader2, 
  Info, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { OrderVesselsTooltip, OrderRequirementsTooltip } from './SMSOrderList';

interface OrderVessel {
  id?: number;
  order_id?: string;
  vessel_id: string;
  vessel_name: string;
  status: 'Pending' | 'Completed' | string;
  completed_at?: string;
  submittedCount?: number;
  totalRequiredCount?: number;
  totalFilesUploaded?: number;
}

interface OrderItem {
  id?: number;
  form_id: string;
  form_code: string;
  category: string;
  description: string;
  form_date?: string;
  type: string;
  is_hira: boolean;
  remove_filename_restriction: boolean;
  allowed_file_types: string[];
  template_file_name?: string;
}

interface OrderUpload {
  id: number;
  order_id: string;
  vessel_id: string;
  vessel_name: string;
  form_id: string;
  form_code: string;
  file_name: string;
  file_size: string;
  file_mimetype: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface SMSOrder {
  id: string;
  label: string;
  deadlineDate: string;
  instructions?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  vessels: OrderVessel[];
  items: OrderItem[];
  uploads?: OrderUpload[];
}

interface MergeOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: SMSOrder[];
  initialSelectedOrderIds?: string[];
  token: string;
  onSuccess: (targetOrderId: string, label: string) => void;
}

export const MergeOrdersModal: React.FC<MergeOrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialSelectedOrderIds = [],
  token,
  onSuccess,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetOrderId, setTargetOrderId] = useState<string>('');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [searchToAdd, setSearchToAdd] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize selection when opened
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    let initialIds = initialSelectedOrderIds.filter(id => orders.some(o => o.id === id));
    if (initialIds.length < 2 && orders.length >= 2) {
      // If user opened without at least 2 preselected, seed with initial or first 2
      const candidateIds = Array.from(new Set([...initialIds, ...orders.map(o => o.id)])).slice(0, 2);
      initialIds = candidateIds;
    }
    setSelectedIds(initialIds);

    const initialTargetId = initialIds[0] || '';
    setTargetOrderId(initialTargetId);

    const initialTarget = orders.find(o => o.id === initialTargetId);
    if (initialTarget) {
      setCustomLabel(initialTarget.label);
      setCustomDeadline(initialTarget.deadlineDate);
      setCustomInstructions(initialTarget.instructions || '');
    }
  }, [isOpen, initialSelectedOrderIds, orders]);

  // Handle changing target order
  const handleSelectTarget = (newTargetId: string) => {
    setTargetOrderId(newTargetId);
    const target = orders.find(o => o.id === newTargetId);
    if (target) {
      setCustomLabel(target.label);
      setCustomDeadline(target.deadlineDate);
      
      // Auto-populate combined notes
      const sources = orders.filter(o => selectedIds.includes(o.id) && o.id !== newTargetId);
      const sourceNotes = sources
        .map(so => so.instructions && so.instructions.trim() ? `[From "${so.label}"]:\n${so.instructions.trim()}` : null)
        .filter(Boolean);
      
      if (target.instructions && target.instructions.trim()) {
        setCustomInstructions([target.instructions.trim(), ...sourceNotes].join('\n\n'));
      } else {
        setCustomInstructions(sourceNotes.join('\n\n'));
      }
    }
  };

  // The active list of orders in the merge pool
  const selectedOrders = useMemo(() => {
    return orders.filter(o => selectedIds.includes(o.id));
  }, [orders, selectedIds]);

  const targetOrder = useMemo(() => {
    return selectedOrders.find(o => o.id === targetOrderId) || selectedOrders[0];
  }, [selectedOrders, targetOrderId]);

  const sourceOrders = useMemo(() => {
    return selectedOrders.filter(o => o.id !== targetOrder?.id);
  }, [selectedOrders, targetOrder]);

  // Calculate merge metrics
  const mergeMetrics = useMemo(() => {
    // Unique vessels
    const vesselMap = new Map<string, { vessel_id: string; vessel_name: string; originOrderLabels: string[] }>();
    selectedOrders.forEach(ord => {
      ord.vessels.forEach(v => {
        const key = String(v.vessel_id).toLowerCase().trim() || v.vessel_name.toLowerCase().trim();
        if (!vesselMap.has(key)) {
          vesselMap.set(key, { vessel_id: String(v.vessel_id), vessel_name: v.vessel_name, originOrderLabels: [ord.label] });
        } else {
          const existing = vesselMap.get(key)!;
          if (!existing.originOrderLabels.includes(ord.label)) {
            existing.originOrderLabels.push(ord.label);
          }
        }
      });
    });

    // Unique requirements / form items
    const itemMap = new Map<string, { form_code: string; description: string; type: string; inTarget: boolean }>();
    if (targetOrder) {
      targetOrder.items.forEach(it => {
        const key = (it.form_code || String(it.form_id)).toLowerCase().trim();
        itemMap.set(key, { form_code: it.form_code, description: it.description, type: it.type, inTarget: true });
      });
    }
    sourceOrders.forEach(so => {
      so.items.forEach(it => {
        const key = (it.form_code || String(it.form_id)).toLowerCase().trim();
        if (!itemMap.has(key)) {
          itemMap.set(key, { form_code: it.form_code, description: it.description, type: it.type, inTarget: false });
        }
      });
    });

    // Total uploads to be consolidated
    let totalUploads = 0;
    let targetUploads = 0;
    let sourceUploads = 0;
    selectedOrders.forEach(ord => {
      const upCount = ord.uploads?.length || 0;
      totalUploads += upCount;
      if (ord.id === targetOrder?.id) {
        targetUploads += upCount;
      } else {
        sourceUploads += upCount;
      }
    });

    return {
      allVessels: Array.from(vesselMap.values()),
      allItems: Array.from(itemMap.values()),
      targetItemsCount: targetOrder?.items.length || 0,
      newItemsFromSourceCount: Array.from(itemMap.values()).filter(i => !i.inTarget).length,
      totalUploads,
      targetUploads,
      sourceUploads
    };
  }, [selectedOrders, targetOrder, sourceOrders]);

  // Candidates that can be added into merge pool
  const candidateOrders = useMemo(() => {
    const query = searchToAdd.toLowerCase().trim();
    return orders.filter(o => !selectedIds.includes(o.id) && (
      !query || o.label.toLowerCase().includes(query) || o.id.toLowerCase().includes(query)
    ));
  }, [orders, selectedIds, searchToAdd]);

  const handleAddOrderToMerge = (orderId: string) => {
    setSelectedIds(prev => [...prev, orderId]);
    setSearchToAdd('');
  };

  const handleRemoveOrderFromMerge = (orderId: string) => {
    if (selectedIds.length <= 2) {
      setErrorMessage('A minimum of 2 orders are required to perform a merge.');
      return;
    }
    setErrorMessage(null);
    const remaining = selectedIds.filter(id => id !== orderId);
    setSelectedIds(remaining);
    if (targetOrderId === orderId && remaining.length > 0) {
      handleSelectTarget(remaining[0]);
    }
  };

  const handleExecuteMerge = async () => {
    if (selectedOrders.length < 2) {
      setErrorMessage('Please select at least 2 orders to merge.');
      return;
    }
    if (!targetOrder) {
      setErrorMessage('Please specify the destination master order.');
      return;
    }
    if (!customLabel.trim()) {
      setErrorMessage('Consolidated order label is required.');
      return;
    }
    if (!customDeadline.trim()) {
      setErrorMessage('Consolidated deadline date is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/sms/orders/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetOrderId: targetOrder.id,
          sourceOrderIds: sourceOrders.map(o => o.id),
          label: customLabel.trim(),
          deadlineDate: customDeadline.trim(),
          instructions: customInstructions.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to merge orders');
      }

      onSuccess(targetOrder.id, customLabel.trim());
      onClose();
    } catch (err: any) {
      console.error('Error merging orders:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while merging orders.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Merge SMS Orders</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                  Office Action
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Consolidate requirements, assigned vessels, and submitted documents from multiple orders into one master order.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 font-medium flex-1">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Section 1: Orders to Merge */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Select Orders to Combine ({selectedOrders.length})</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Choose which order serves as the primary master. The other orders will be safely merged and archived.
                </p>
              </div>

              {/* Add More Order Dropdown */}
              {candidateOrders.length > 0 && (
                <div className="relative">
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) handleAddOrderToMerge(e.target.value);
                    }}
                    className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl px-3 py-1.5 outline-none cursor-pointer transition-colors"
                  >
                    <option value="">+ Add Another Order...</option>
                    {candidateOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.label} ({o.vessels.length} vessels, due {o.deadlineDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Orders Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedOrders.map(order => {
                const isTarget = order.id === targetOrder?.id;
                const uploadCount = order.uploads?.length || 0;
                return (
                  <div
                    key={order.id}
                    onClick={() => handleSelectTarget(order.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isTarget
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="radio"
                            name="targetOrderRadio"
                            checked={isTarget}
                            onChange={() => handleSelectTarget(order.id)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {order.label}
                          </span>
                        </div>

                        {selectedOrders.length > 2 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveOrderFromMerge(order.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove from merge pool"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Status Tag */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        {isTarget ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                            <Check className="w-3 h-3" />
                            Primary Destination
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Source (Will be merged)
                          </span>
                        )}
                      </div>

                      {/* Order Info Pills */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                        <OrderVesselsTooltip
                          vessels={order.vessels}
                          totalForms={order.items.length}
                          orderUploads={order.uploads}
                          orderItems={order.items}
                          position="bottom"
                        >
                          <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md font-medium text-slate-700 hover:text-blue-600 cursor-help">
                            <Ship className="w-3 h-3 text-slate-500" />
                            {order.vessels.length} {order.vessels.length === 1 ? 'vessel' : 'vessels'}
                          </span>
                        </OrderVesselsTooltip>

                        <OrderRequirementsTooltip
                          items={order.items}
                          position="bottom"
                        >
                          <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md font-medium text-slate-700 hover:text-blue-600 cursor-help">
                            <FileText className="w-3 h-3 text-slate-500" />
                            {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </OrderRequirementsTooltip>

                        <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded-md font-medium text-slate-700">
                          <Upload className="w-3 h-3 text-slate-500" />
                          {uploadCount} {uploadCount === 1 ? 'upload' : 'uploads'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Due: {order.deadlineDate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Consolidated Order Details */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Master Order Settings</span>
              </h4>
              <p className="text-xs text-slate-500">
                You can review or adjust the consolidated order's title, target due date, and instructions below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Consolidated Order Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="e.g., Monthly Safety & Deck Verification (Consolidated)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Deadline Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={customDeadline}
                  onChange={e => setCustomDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Consolidated Instructions & Notes
              </label>
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                rows={3}
                placeholder="Optional instructions for vessels submitting items for this merged order..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Section 3: Merge Impact Preview */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Merge Summary & Impact Preview</span>
            </h4>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Ship className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900 leading-tight">
                    {mergeMetrics.allVessels.length}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Target Vessels Combined
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900 leading-tight">
                    {mergeMetrics.allItems.length}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Requirements ({mergeMetrics.newItemsFromSourceCount} added)
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-black text-emerald-700 leading-tight">
                    {mergeMetrics.totalUploads}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Documents Preserved ({mergeMetrics.sourceUploads} transferred)
                  </div>
                </div>
              </div>
            </div>

            {/* Vessel list chips preview */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-2">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-slate-500" />
                <span>Assigned Fleet:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mergeMetrics.allVessels.map(v => (
                  <span
                    key={v.vessel_id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    <span>{v.vessel_name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({v.originOrderLabels.length > 1 ? 'shared' : v.originOrderLabels[0]})
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Informational Callout */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 leading-relaxed">
                All submitted vessel files, read states, and replacement notes from the source orders will be safely moved to <strong>{targetOrder?.label}</strong>. No uploaded documents or records will be deleted. Source orders will be archived in order list history.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={isSubmitting || selectedOrders.length < 2 || !customLabel.trim() || !customDeadline.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Merging Orders...</span>
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                <span>Confirm & Merge {selectedOrders.length} Orders</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
