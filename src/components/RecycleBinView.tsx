import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Ship, 
  FileText, 
  Compass, 
  Layers,
  CheckCircle2,
  Calendar,
  Flag,
  Users,
  Wrench,
  ShieldCheck,
  Fuel,
  Droplets,
  ClipboardList,
  FolderOpen,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

interface RecycleBinViewProps {
  token: string;
  notify: (type: 'success' | 'error', message: string) => void;
}

type CategoryTab = 
  | 'all' 
  | 'sms_orders' 
  | 'fleet_flags' 
  | 'certificates' 
  | 'voyage_reports' 
  | 'technical_analysis' 
  | 'crew_audits' 
  | 'requisitions' 
  | 'users';

interface DeletedItem {
  id: number | string;
  dbType: string;
  categoryTab: CategoryTab;
  categoryLabel: string;
  title: string;
  subtitle: string;
  vesselName?: string;
  deletedAt?: string;
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = ({
  token,
  notify
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<Record<string, any[]>>({});
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const fetchRecycleBin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result || {});
        setSelectedKeys(new Set());
      } else {
        notify('error', 'Failed to load recycle bin items');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecycleBin();
  }, []);

  const handleRestore = async (type: string, id: number | string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin/restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, id })
      });
      if (res.ok) {
        notify('success', 'Item restored successfully');
        await fetchRecycleBin();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to restore item');
      }
    } catch (e: any) {
      notify('error', e.message || 'Restore failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (type: string, id: number | string) => {
    if (!window.confirm('This action cannot be undone. Are you sure you want to permanently delete this item?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin/permanent-delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, id })
      });
      if (res.ok) {
        notify('success', 'Item permanently deleted');
        await fetchRecycleBin();
      } else {
        const err = await res.json();
        notify('error', err.error || 'Failed to delete item permanently');
      }
    } catch (e: any) {
      notify('error', e.message || 'Permanent deletion failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Compile all deleted items from all backend tables
  const allItems: DeletedItem[] = [];

  // 1. Vessels
  (data.vessels || []).forEach((v: any) => {
    allItems.push({
      id: v.id,
      dbType: 'vessels',
      categoryTab: 'fleet_flags',
      categoryLabel: 'Vessel',
      title: v.name || 'Unnamed Vessel',
      subtitle: `IMO: ${v.imo || 'N/A'} • Type: ${v.type || 'Bulk Carrier'} • Team: ${v.team_name || 'Unassigned'}`,
      vesselName: v.name,
      deletedAt: v.deleted_at
    });
  });

  // 2. Flags
  (data.flags || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'flags',
      categoryTab: 'fleet_flags',
      categoryLabel: 'Flag State',
      title: f.name || 'Flag',
      subtitle: `Registered Maritime Flag Registry item`,
      deletedAt: f.deleted_at
    });
  });

  // 3. Teams
  (data.teams || []).forEach((t: any) => {
    allItems.push({
      id: t.id,
      dbType: 'teams',
      categoryTab: 'fleet_flags',
      categoryLabel: 'Technical Team',
      title: t.name || 'Team',
      subtitle: `Technical / Management Fleet Division`,
      deletedAt: t.deleted_at
    });
  });

  // 4. Certificates
  (data.certificates || []).forEach((c: any) => {
    allItems.push({
      id: c.id,
      dbType: 'certificates',
      categoryTab: 'certificates',
      categoryLabel: 'Certificate',
      title: c.name || 'Unnamed Certificate',
      subtitle: `Cert #: ${c.certificate_number || 'N/A'} • Expires: ${c.expiration_date || 'N/A'}`,
      vesselName: c.vessel_name || 'Fleet-wide',
      deletedAt: c.deleted_at
    });
  });

  // 5. Certificate Files
  (data.files || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'files',
      categoryTab: 'certificates',
      categoryLabel: 'Certificate Document',
      title: f.filename || f.original_name || 'Certificate File',
      subtitle: `Attached to: ${f.certificate_name || 'Certificate'} (${f.file_type || 'certificate'})`,
      vesselName: f.vessel_name,
      deletedAt: f.deleted_at
    });
  });

  // 6. Departure Reports
  (data.departure_reports || []).forEach((d: any) => {
    allItems.push({
      id: d.id,
      dbType: 'departure_reports',
      categoryTab: 'voyage_reports',
      categoryLabel: 'Departure Report',
      title: `Departure: ${d.departure_port || 'Port'} (${d.voyage_number || 'Voyage N/A'})`,
      subtitle: `Date/Time: ${d.utc_date_time || 'N/A'}`,
      vesselName: d.vessel_name,
      deletedAt: d.deleted_at
    });
  });

  // 7. Arrival Reports
  (data.arrival_reports || []).forEach((a: any) => {
    allItems.push({
      id: a.id,
      dbType: 'arrival_reports',
      categoryTab: 'voyage_reports',
      categoryLabel: 'Arrival Report',
      title: `Arrival: ${a.arrival_port || 'Port'} (${a.voyage_number || 'Voyage N/A'})`,
      subtitle: `Date/Time: ${a.utc_date_time || 'N/A'}`,
      vesselName: a.vessel_name,
      deletedAt: a.deleted_at
    });
  });

  // 8. Noon Reports
  (data.noon_reports || []).forEach((n: any) => {
    allItems.push({
      id: n.id,
      dbType: 'noon_reports',
      categoryTab: 'voyage_reports',
      categoryLabel: 'Noon Report',
      title: `Noon Report (${n.voyage_number || 'Voyage N/A'})`,
      subtitle: `Date: ${n.report_date || 'N/A'} • Lat: ${n.position_lat || '-'}, Long: ${n.position_long || '-'}`,
      vesselName: n.vessel_name,
      deletedAt: n.deleted_at
    });
  });

  // 9. Other Reports
  (data.other_reports || []).forEach((o: any) => {
    allItems.push({
      id: o.id,
      dbType: 'other_reports',
      categoryTab: 'voyage_reports',
      categoryLabel: 'General Report',
      title: `${o.report_type || 'Report'}: ${o.title || o.file_name || 'Document'}`,
      subtitle: `Date: ${o.report_date || 'N/A'}`,
      vesselName: o.vessel_name,
      deletedAt: o.deleted_at
    });
  });

  // 10. Fuel Analysis Reports
  (data.fuel_analysis_reports || []).forEach((r: any) => {
    allItems.push({
      id: r.id,
      dbType: 'fuel_analysis_reports',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Bunker Fuel Report',
      title: `Fuel Analysis: ${r.bunker_port || 'Port'} (${r.sample_source || 'Sample'})`,
      subtitle: `Date: ${r.report_date || 'N/A'} • Result: ${r.test_result || 'N/A'}`,
      vesselName: r.vessel_name,
      deletedAt: r.deleted_at
    });
  });

  // 11. Fuel Analysis Files
  (data.fuel_analysis_files || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'fuel_analysis_files',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Fuel Analysis Attachment',
      title: f.file_name || 'Fuel Attachment',
      subtitle: `Port: ${f.bunker_port || 'N/A'}`,
      vesselName: f.vessel_name,
      deletedAt: f.deleted_at
    });
  });

  // 12. Lube Oil LDR Reports
  (data.lube_oil_ldr_reports || []).forEach((r: any) => {
    allItems.push({
      id: r.id,
      dbType: 'lube_oil_ldr_reports',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Lube Oil LDR Report',
      title: `LDR: ${r.machinery_name || 'Machinery'}`,
      subtitle: `Date: ${r.report_date || 'N/A'} • Result: ${r.test_result || 'N/A'}`,
      vesselName: r.vessel_name,
      deletedAt: r.deleted_at
    });
  });

  // 13. Lube Oil LDR Files
  (data.lube_oil_ldr_files || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'lube_oil_ldr_files',
      categoryTab: 'technical_analysis',
      categoryLabel: 'LDR Attachment',
      title: f.file_name || 'LDR File',
      subtitle: `Machinery: ${f.machinery_name || 'N/A'}`,
      vesselName: f.vessel_name,
      deletedAt: f.deleted_at
    });
  });

  // 14. Lube Oil Analysis Reports
  (data.lube_oil_analysis_reports || []).forEach((r: any) => {
    allItems.push({
      id: r.id,
      dbType: 'lube_oil_analysis_reports',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Lube Oil Analysis Report',
      title: `Lube Oil: ${r.machinery_name || 'Machinery'} (${r.oil_type || 'Grade'})`,
      subtitle: `Date: ${r.report_date || 'N/A'} • Result: ${r.test_result || 'N/A'}`,
      vesselName: r.vessel_name,
      deletedAt: r.deleted_at
    });
  });

  // 15. Lube Oil Analysis Files
  (data.lube_oil_analysis_files || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'lube_oil_analysis_files',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Lube Oil Analysis Attachment',
      title: f.file_name || 'Lube Oil File',
      subtitle: `Machinery: ${f.machinery_name || 'N/A'}`,
      vesselName: f.vessel_name,
      deletedAt: f.deleted_at
    });
  });

  // 16. Bunker BDN Reports
  (data.bunker_bdn_reports || []).forEach((r: any) => {
    allItems.push({
      id: r.id,
      dbType: 'bunker_bdn_reports',
      categoryTab: 'technical_analysis',
      categoryLabel: 'Bunker BDN Record',
      title: `BDN: ${r.bunker_port || 'Port'} • ${r.supplier_name || 'Supplier'}`,
      subtitle: `Grade: ${r.fuel_grade || 'N/A'} • Date: ${r.report_date || 'N/A'}`,
      vesselName: r.vessel_name,
      deletedAt: r.deleted_at
    });
  });

  // 17. Bunker BDN Files
  (data.bunker_bdn_files || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'bunker_bdn_files',
      categoryTab: 'technical_analysis',
      categoryLabel: 'BDN Attachment',
      title: f.file_name || 'BDN File',
      subtitle: `Port: ${f.bunker_port || 'N/A'}`,
      vesselName: f.vessel_name,
      deletedAt: f.deleted_at
    });
  });

  // 18. Crew Members
  (data.crew_members || []).forEach((c: any) => {
    allItems.push({
      id: c.id,
      dbType: 'crew_members',
      categoryTab: 'crew_audits',
      categoryLabel: 'Crew Profile',
      title: c.name || 'Crew Member',
      subtitle: `Rank: ${c.rank_name || 'N/A'} • Nationality: ${c.nationality || 'N/A'} • Passport: ${c.passport_no || 'N/A'}`,
      vesselName: c.vessel_name,
      deletedAt: c.deleted_at
    });
  });

  // 19. Audit Records
  (data.audit_records || []).forEach((a: any) => {
    allItems.push({
      id: a.id,
      dbType: 'audit_records',
      categoryTab: 'crew_audits',
      categoryLabel: 'Audit Record',
      title: `${a.audit_type || 'Audit'}: ${a.auditor_name || 'Auditor'}`,
      subtitle: `Date: ${a.audit_date || 'N/A'} • Status: ${a.status || 'N/A'}`,
      vesselName: a.vessel_name,
      deletedAt: a.deleted_at
    });
  });

  // 20. Non-Conformities
  (data.non_conformities || []).forEach((nc: any) => {
    allItems.push({
      id: nc.id,
      dbType: 'non_conformities',
      categoryTab: 'crew_audits',
      categoryLabel: 'Non-Conformity (NCR)',
      title: `NCR: ${nc.ncr_number || 'N/A'} - ${nc.category || 'General'}`,
      subtitle: `${nc.description ? nc.description.substring(0, 80) + '...' : 'No description'} • Status: ${nc.status || 'Open'}`,
      vesselName: nc.vessel_name,
      deletedAt: nc.deleted_at
    });
  });

  // 21. Trouble Reports
  (data.trouble_reports || []).forEach((tr: any) => {
    allItems.push({
      id: tr.id,
      dbType: 'trouble_reports',
      categoryTab: 'crew_audits',
      categoryLabel: 'Trouble Report',
      title: `${tr.report_number ? '[' + tr.report_number + '] ' : ''}${tr.title || 'Incident Report'}`,
      subtitle: `Category: ${tr.category || 'General'} • Status: ${tr.status || 'Pending'}`,
      vesselName: tr.vessel_name,
      deletedAt: tr.deleted_at
    });
  });

  // 22. Spare Parts Requisitions
  (data.spare_parts_requisitions || []).forEach((spr: any) => {
    allItems.push({
      id: spr.id,
      dbType: 'spare_parts_requisitions',
      categoryTab: 'requisitions',
      categoryLabel: 'Spare Parts Requisition',
      title: `Requisition: ${spr.requisition_no || 'N/A'}`,
      subtitle: `Department: ${spr.department || 'Engine/Deck'} • Status: ${spr.status || 'Pending'}`,
      vesselName: spr.vessel_name,
      deletedAt: spr.deleted_at
    });
  });

  // 23. Requisition Attachments
  (data.requisition_attachments || []).forEach((a: any) => {
    allItems.push({
      id: a.id,
      dbType: 'requisition_attachments',
      categoryTab: 'requisitions',
      categoryLabel: 'Requisition Attachment',
      title: a.file_name || 'Requisition Attachment',
      subtitle: `Attached to Req: ${a.requisition_no || 'N/A'}`,
      vesselName: a.vessel_name,
      deletedAt: a.deleted_at
    });
  });

  // 24. SMS Orders (Order Lists)
  (data.sms_orders || []).forEach((o: any) => {
    allItems.push({
      id: o.id,
      dbType: 'sms_orders',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS Order List',
      title: o.label || o.name || 'Order List',
      subtitle: `Target Vessels: ${o.vessel_count ?? 'Multiple'} • Items: ${o.item_count ?? 'N/A'} • Deadline: ${o.deadline_date || 'N/A'}`,
      deletedAt: o.deleted_at
    });
  });

  // 25. SMS Order Uploads
  (data.sms_order_uploads || []).forEach((u: any) => {
    allItems.push({
      id: u.id,
      dbType: 'sms_order_uploads',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS Checklist Upload',
      title: u.file_name || 'Order Upload',
      subtitle: `Order: ${u.order_label || u.order_id || 'SMS Order'} • Form: ${u.form_code || 'Checklist'} • Size: ${u.file_size || 'N/A'}`,
      vesselName: u.vessel_name,
      deletedAt: u.deleted_at
    });
  });

  // 26. SMS Order Templates
  (data.sms_order_templates || []).forEach((t: any) => {
    allItems.push({
      id: t.id,
      dbType: 'sms_order_templates',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS Order Template',
      title: t.title || 'Audit Pack Template',
      subtitle: `${t.description || 'Pre-configured audit/checklist pack'} • Created by: ${t.created_by || 'Management'}`,
      deletedAt: t.deleted_at
    });
  });

  // 27. SMS Uploads (Monthly Direct)
  (data.sms_uploads || []).forEach((u: any) => {
    allItems.push({
      id: u.id,
      dbType: 'sms_uploads',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS Monthly Direct Upload',
      title: u.file_name || 'Monthly Upload',
      subtitle: `Period: ${u.month || ''} ${u.year || ''} • Size: ${u.file_size || 'N/A'}`,
      vesselName: u.vessel_name,
      deletedAt: u.deleted_at
    });
  });

  // 28. SMS Forms
  (data.sms_forms || []).forEach((f: any) => {
    allItems.push({
      id: f.id,
      dbType: 'sms_forms',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS System Form Definition',
      title: `${f.formCode || 'Form'}: ${f.description ? f.description.substring(0, 60) + '...' : ''}`,
      subtitle: `Category: ${f.category || '1. Monthly'} • Date: ${f.formDate || 'N/A'} • Scope: ${f.scope || 'All Vessels'}`,
      deletedAt: f.deleted_at
    });
  });

  // 29. SMS Submission Periods
  (data.sms_submission_periods || []).forEach((sp: any) => {
    allItems.push({
      id: sp.id || sp.vessel_id,
      dbType: 'sms_submission_periods',
      categoryTab: 'sms_orders',
      categoryLabel: 'SMS Vessel Submission Period',
      title: `Submission Period: ${sp.vessel_name || 'Vessel'}`,
      subtitle: `Active Period: ${sp.month || ''} ${sp.year || ''}`,
      vesselName: sp.vessel_name,
      deletedAt: sp.deleted_at
    });
  });

  // 30. Users
  (data.users || []).forEach((u: any) => {
    allItems.push({
      id: u.id,
      dbType: 'users',
      categoryTab: 'users',
      categoryLabel: 'User Account',
      title: u.username || 'User',
      subtitle: `Role: ${u.role || 'user'} • Email: ${u.email || 'N/A'}`,
      vesselName: u.vessel_name,
      deletedAt: u.deleted_at
    });
  });

  // Filter items
  const filteredItems = allItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.categoryTab === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;

    const matchesQuery = 
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q) ||
      (item.vesselName && item.vesselName.toLowerCase().includes(q)) ||
      item.dbType.toLowerCase().includes(q);

    return matchesCategory && matchesQuery;
  });

  // Batch Selection Handlers
  const handleToggleSelect = (itemKey: string) => {
    const next = new Set(selectedKeys);
    if (next.has(itemKey)) {
      next.delete(itemKey);
    } else {
      next.add(itemKey);
    }
    setSelectedKeys(next);
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedKeys(new Set());
    } else {
      const next = new Set<string>();
      filteredItems.forEach(item => next.add(`${item.dbType}::${item.id}`));
      setSelectedKeys(next);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedKeys.size === 0) return;
    setActionLoading(true);
    try {
      const grouped: Record<string, (string | number)[]> = {};
      selectedKeys.forEach(k => {
        const [type, idStr] = k.split('::');
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(isNaN(Number(idStr)) ? idStr : Number(idStr));
      });

      for (const [type, ids] of Object.entries(grouped)) {
        await fetch('/api/admin/recycle-bin/restore', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type, ids })
        });
      }

      notify('success', `Restored ${selectedKeys.size} item(s) successfully`);
      await fetchRecycleBin();
    } catch (e: any) {
      notify('error', e.message || 'Batch restore failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchPurge = async () => {
    if (selectedKeys.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently purge ${selectedKeys.size} item(s)? This CANNOT be undone.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const grouped: Record<string, (string | number)[]> = {};
      selectedKeys.forEach(k => {
        const [type, idStr] = k.split('::');
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(isNaN(Number(idStr)) ? idStr : Number(idStr));
      });

      for (const [type, ids] of Object.entries(grouped)) {
        await fetch('/api/admin/recycle-bin/permanent-delete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type, ids })
        });
      }

      notify('success', `Permanently deleted ${selectedKeys.size} item(s)`);
      await fetchRecycleBin();
    } catch (e: any) {
      notify('error', e.message || 'Batch purge failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for category counts
  const categoryCounts = {
    all: allItems.length,
    sms_orders: allItems.filter(i => i.categoryTab === 'sms_orders').length,
    fleet_flags: allItems.filter(i => i.categoryTab === 'fleet_flags').length,
    certificates: allItems.filter(i => i.categoryTab === 'certificates').length,
    voyage_reports: allItems.filter(i => i.categoryTab === 'voyage_reports').length,
    technical_analysis: allItems.filter(i => i.categoryTab === 'technical_analysis').length,
    crew_audits: allItems.filter(i => i.categoryTab === 'crew_audits').length,
    requisitions: allItems.filter(i => i.categoryTab === 'requisitions').length,
    users: allItems.filter(i => i.categoryTab === 'users').length
  };

  const categoryTabConfigs: { key: CategoryTab; label: string; icon: any }[] = [
    { key: 'all', label: 'All Items', icon: Layers },
    { key: 'sms_orders', label: 'SMS & Orders', icon: ClipboardList },
    { key: 'fleet_flags', label: 'Fleet & Flags', icon: Ship },
    { key: 'certificates', label: 'Certificates', icon: FileText },
    { key: 'voyage_reports', label: 'Voyage Reports', icon: Compass },
    { key: 'technical_analysis', label: 'Fuel & Oil Analysis', icon: Fuel },
    { key: 'crew_audits', label: 'Crew & Audits', icon: ShieldCheck },
    { key: 'requisitions', label: 'Requisitions', icon: Wrench },
    { key: 'users', label: 'Users', icon: Users }
  ];

  const getItemIcon = (tab: CategoryTab) => {
    switch (tab) {
      case 'sms_orders': return ClipboardList;
      case 'fleet_flags': return Ship;
      case 'certificates': return FileText;
      case 'voyage_reports': return Compass;
      case 'technical_analysis': return Fuel;
      case 'crew_audits': return ShieldCheck;
      case 'requisitions': return Wrench;
      case 'users': return Users;
      default: return Layers;
    }
  };

  const isAllSelected = filteredItems.length > 0 && selectedKeys.size === filteredItems.length;

  return (
    <div className="space-y-6" id="recycle-bin-view">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Admin Recycle Bin</h1>
            <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-100 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              {allItems.length} Deleted Items
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Safely restore soft-deleted items across all database components (SMS Orders, Checklists, Flags, Reports, Audits, Certificates) or permanently purge them.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchRecycleBin}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {categoryTabConfigs.map(tab => {
          const Icon = tab.icon;
          const count = categoryCounts[tab.key];
          const isActive = activeCategory === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveCategory(tab.key);
                setSelectedKeys(new Set());
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Container */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Search & Batch Actions Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, vessel, category, form code, or type..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {selectedKeys.size > 0 && (
            <div className="flex items-center gap-2 shrink-0 bg-blue-50/80 p-1.5 px-3 rounded-xl border border-blue-200/80 animate-in fade-in">
              <span className="text-xs font-bold text-blue-900">
                {selectedKeys.size} selected
              </span>
              <div className="h-4 w-px bg-blue-200 mx-1" />
              <button
                type="button"
                onClick={handleBatchRestore}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Selected</span>
              </button>
              <button
                type="button"
                onClick={handleBatchPurge}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                <span>Purge Selected</span>
              </button>
            </div>
          )}
        </div>

        {/* Multi-select Header Control */}
        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between py-2 px-3 bg-slate-50/80 border border-slate-100 rounded-xl text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-2 hover:text-slate-800 transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${filteredItems.length} items)`}</span>
            </button>
            <span>Displaying {filteredItems.length} of {allItems.length} deleted records</span>
          </div>
        )}

        {/* Item List */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500 opacity-60" />
              <p className="text-xs font-semibold">Scanning database for deleted components...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Recycle Bin is empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery ? 'No deleted items matching your search criteria.' : 'No deleted items found in this category.'}
              </p>
            </div>
          ) : (
            filteredItems.map(item => {
              const itemKey = `${item.dbType}::${item.id}`;
              const isSelected = selectedKeys.has(itemKey);
              const ItemIcon = getItemIcon(item.categoryTab);

              return (
                <div 
                  key={itemKey} 
                  className={`py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl transition-all ${
                    isSelected ? 'bg-blue-50/40 border border-blue-100' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(itemKey)}
                      className="mt-1 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>

                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                      <ItemIcon className="w-4 h-4" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                          {item.categoryLabel}
                        </span>
                        {item.vesselName && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                            <Ship className="w-2.5 h-2.5" />
                            {item.vesselName}
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-slate-900 truncate">{item.title}</h3>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.subtitle}</p>

                      {item.deletedAt && (
                        <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Deleted: {format(new Date(item.deletedAt), 'yyyy-MM-dd HH:mm')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleRestore(item.dbType, item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      title="Restore item"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handlePermanentDelete(item.dbType, item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      title="Permanently delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
