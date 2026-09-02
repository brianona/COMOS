import React from "react";
import { 
  Home, Ship, Navigation, Activity, Droplets, Fuel, AlertTriangle, 
  Wrench, Users, ListChecks, FileText, Settings, Info, LogOut, 
  ChevronDown, ChevronRight, Eye, Shield, Tag, MessageSquare, Network,
  Clock, Map as MapIcon, File as FileIcon, Search, CheckSquare, Package,
  Waves, FlaskConical, Plus, CheckCircle2, ShieldCheck, Compass, Trash2, Monitor
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, getRoleLabel } from "../utils/helpers";
import { LogoContainer } from "./Logo";
import { User, ViewType } from "../types";

export const SidebarContent = ({ 
  view, setView, setIsSidebarOpen, user, isAdminTreeOpen, setIsAdminTreeOpen, isVoyageReportOpen, setIsVoyageReportOpen, isMonitoringOpen, setIsMonitoringOpen, isDefectsOpen, setIsDefectsOpen, isSparePartsOpen, setIsSparePartsOpen, isBunkerOpen, setIsBunkerOpen, isLubeOilOpen, setIsLubeOilOpen, isStoreChemicalsOpen, setIsStoreChemicalsOpen, isCrewOpen, setIsCrewOpen, isAuditsOpen, setIsAuditsOpen, isCertificatesOpen, setIsCertificatesOpen, onLogout, setIsChangePasswordOpen, pendingAckCount, smsSidebarStatus
}: { 
  view: string, 
  setView: (v: any) => void, 
  setIsSidebarOpen: (v: boolean) => void, 
  user: User, 
  isAdminTreeOpen: boolean, 
  setIsAdminTreeOpen: (v: boolean) => void,
  isVoyageReportOpen: boolean,
  setIsVoyageReportOpen: (v: boolean) => void,
  isMonitoringOpen: boolean,
  setIsMonitoringOpen: (v: boolean) => void,
  isDefectsOpen: boolean,
  setIsDefectsOpen: (v: boolean) => void,
  isSparePartsOpen: boolean,
  setIsSparePartsOpen: (v: boolean) => void,
  isBunkerOpen: boolean,
  setIsBunkerOpen: (v: boolean) => void,
  isLubeOilOpen: boolean,
  setIsLubeOilOpen: (v: boolean) => void,
  isStoreChemicalsOpen: boolean,
  setIsStoreChemicalsOpen: (v: boolean) => void,
  isCrewOpen: boolean,
  setIsCrewOpen: (v: boolean) => void,
  isAuditsOpen: boolean,
  setIsAuditsOpen: (v: boolean) => void,
  isCertificatesOpen: boolean,
  setIsCertificatesOpen: (v: boolean) => void,
  onLogout: () => void,
  setIsChangePasswordOpen: (v: boolean) => void,
  pendingAckCount?: number,
  smsSidebarStatus?: {
    statusColor: 'red' | 'orange' | 'normal';
    urgentCount: number;
    uncheckedCount: number;
    replaceRequestedCount?: number;
    pendingFilesCount?: number;
    hasUrgentDeadline?: boolean;
    hasUncheckedUploads?: boolean;
  }
}) => {
  const [isSmsReportingOpen, setIsSmsReportingOpen] = React.useState(false);
  // Beautiful interactive helper styling functions
  const getTopLevelClass = (active: boolean) => cn(
    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left cursor-pointer",
    active 
      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10 hover:bg-blue-700" 
      : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
  );

  const getCategoryToggleClass = (active: boolean, isOpen: boolean) => cn(
    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left cursor-pointer",
    active 
      ? "bg-blue-50/70 text-blue-700 font-bold" 
      : isOpen
        ? "text-slate-800 bg-slate-50"
        : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
  );

  const getSubItemClass = (active: boolean) => cn(
    "w-full flex items-center gap-3 pl-9 pr-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 text-left relative cursor-pointer",
    active 
      ? "bg-blue-50/50 text-blue-700 font-black border-l-2 border-blue-600 pl-[34px]" 
      : "text-slate-500 hover:bg-slate-50/40 hover:text-blue-600 hover:pl-[38px]"
  );

  const getOrderListItemClass = (active: boolean) => {
    if (smsSidebarStatus?.statusColor === 'red') {
      return cn(
        "w-full flex items-center justify-between pl-9 pr-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 text-left relative cursor-pointer",
        active 
          ? "bg-rose-50 text-rose-700 font-black border-l-2 border-rose-600 pl-[34px]" 
          : "text-rose-600 font-bold bg-rose-50/50 hover:bg-rose-100/70 hover:text-rose-800 hover:pl-[38px]"
      );
    }
    if (smsSidebarStatus?.statusColor === 'orange') {
      return cn(
        "w-full flex items-center justify-between pl-9 pr-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 text-left relative cursor-pointer",
        active 
          ? "bg-amber-50 text-amber-800 font-black border-l-2 border-amber-500 pl-[34px]" 
          : "text-amber-600 font-bold bg-amber-50/50 hover:bg-amber-100/70 hover:text-amber-800 hover:pl-[38px]"
      );
    }
    return cn(getSubItemClass(active), "justify-between");
  };

  return (
    <>
      <button 
        onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
        className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity text-left w-full cursor-pointer"
      >
        <LogoContainer size="sm" className="border-none shadow-none" />
        <span className="font-bold text-lg tracking-tight text-blue-900">COMOS</span>
      </button>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {/* Core Navigation Section */}
        <button 
          onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
          className={getTopLevelClass(view === 'dashboard')}
        >
          <Clock className="w-4 h-4" /> Dashboard
        </button>

        {user.role !== 'vessel' && (
          <button 
            onClick={() => { setView('vessels'); setIsSidebarOpen(false); }}
            className={getTopLevelClass(view === 'vessels' || view === 'vessel_details')}
          >
            <Ship className="w-4 h-4" /> Vessels
          </button>
        )}

        <button 
          onClick={() => { setView('routing'); setIsSidebarOpen(false); }}
          className={getTopLevelClass(view === 'routing')}
        >
          <Compass className="w-4 h-4" /> Vessel Routing
        </button>

        {/* Voyage Report collapsible */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsVoyageReportOpen(!isVoyageReportOpen)}
            className={getCategoryToggleClass(
              ['departure', 'arrival', 'noon_to_noon', 'other_report'].includes(view),
              isVoyageReportOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> Voyage Report
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isVoyageReportOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isVoyageReportOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('noon_to_noon'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'noon_to_noon')}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" /> Noon to Noon
                </button>
                <button 
                  onClick={() => { setView('arrival'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'arrival')}
                >
                  <MapIcon className="w-3.5 h-3.5 shrink-0" /> Arrival
                </button>
                <button 
                  onClick={() => { setView('departure'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'departure')}
                >
                  <Navigation className="w-3.5 h-3.5 shrink-0" /> Departure
                </button>
                <button 
                  onClick={() => { setView('other_report'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'other_report')}
                >
                  <FileIcon className="w-3.5 h-3.5 shrink-0" /> Other Report
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SMS Group */}
        <div className="space-y-1">
          <button 
            onClick={() => {
              setView('sms_overview');
              setIsSmsReportingOpen(true);
            }}
            className={getCategoryToggleClass(
              view === 'sms_overview' || view === 'sms' || view === 'sms_reporting' || view === 'sms_order_list' || view === 'sms_find_report',
              isSmsReportingOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> SMS
            </div>
            <div className="flex items-center gap-1.5">
              {!isSmsReportingOpen && smsSidebarStatus?.statusColor === 'red' && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse ring-2 ring-rose-200" title="Urgent deadline in SMS Order List" />
              )}
              {!isSmsReportingOpen && user.role !== 'vessel' && smsSidebarStatus?.statusColor === 'orange' && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 animate-pulse" title="Unchecked vessel uploads in SMS Order List" />
              )}
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSmsReportingOpen(!isSmsReportingOpen);
                }}
                className="p-0.5 hover:bg-slate-200/50 rounded transition-colors"
                title={isSmsReportingOpen ? "Collapse Submenu" : "Expand Submenu"}
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isSmsReportingOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
              </span>
            </div>
          </button>
          
          <AnimatePresence>
            {isSmsReportingOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('sms'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'sms')}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" /> SMS Management
                  </button>
                )}
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('sms_reporting'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'sms_reporting')}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" /> SMS Reporting
                  </button>
                )}
                <button 
                  onClick={() => { setView('sms_order_list'); setIsSidebarOpen(false); }}
                  className={getOrderListItemClass(view === 'sms_order_list')}
                  title={
                    smsSidebarStatus?.statusColor === 'red'
                      ? `${smsSidebarStatus.urgentCount} order(s) deadline within 7 days or overdue!`
                      : smsSidebarStatus?.statusColor === 'orange' && user.role !== 'vessel'
                        ? `${smsSidebarStatus.uncheckedCount} uploaded file(s) waiting for management review.`
                        : 'Order List'
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ListChecks className={cn("w-3.5 h-3.5 shrink-0", 
                      smsSidebarStatus?.statusColor === 'red' ? "text-rose-600" :
                      smsSidebarStatus?.statusColor === 'orange' && user.role !== 'vessel' ? "text-amber-600" : ""
                    )} />
                    <span className="truncate">Order List</span>
                  </div>
                  {smsSidebarStatus?.statusColor === 'red' && smsSidebarStatus.urgentCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full leading-none shadow-2xs shrink-0 animate-pulse">
                      {smsSidebarStatus.urgentCount}
                    </span>
                  )}
                  {user.role !== 'vessel' && smsSidebarStatus?.statusColor === 'orange' && smsSidebarStatus.uncheckedCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full leading-none shadow-2xs shrink-0">
                      {smsSidebarStatus.uncheckedCount}
                    </span>
                  )}
                  {user.role === 'vessel' && (
                    (smsSidebarStatus?.replaceRequestedCount || 0) > 0 ? (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full leading-none shadow-2xs shrink-0 animate-pulse flex items-center gap-1" title={`${smsSidebarStatus?.replaceRequestedCount} file(s) requested for revision by management`}>
                        {smsSidebarStatus?.replaceRequestedCount} Revision
                      </span>
                    ) : (smsSidebarStatus?.pendingFilesCount || 0) > 0 ? (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full leading-none shadow-2xs shrink-0" title={`${smsSidebarStatus?.pendingFilesCount} file(s) to submit`}>
                        {smsSidebarStatus?.pendingFilesCount}
                      </span>
                    ) : null
                  )}
                </button>
                <button 
                  onClick={() => { setView('sms_find_report'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'sms_find_report')}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" /> Find SMS Report
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Monitoring & Operations group (Fully flattened child items for exceptional usability!) */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsMonitoringOpen(!isMonitoringOpen)}
            className={getCategoryToggleClass(
              ['defects_5_2', 'spare_requisition_ship', 'bunker_bdn', 'bunker_fuel_analysis', 'lube_oil_ldr', 'lube_oil_analysis', 'store_chemical_requisition'].includes(view),
              isMonitoringOpen
            )}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" /> Operations &amp; Monitoring
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isMonitoringOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isMonitoringOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('defects_5_2'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'defects_5_2')}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" /> Defects &amp; Troubles
                </button>

                <button 
                  onClick={() => { setView('spare_requisition_ship'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(['spare_requisition_ship', 'spare_quotation_pic', 'spare_logistic_pic', 'spare_delivery_note_ship'].includes(view))}
                >
                  <Package className="w-3.5 h-3.5 shrink-0" /> Spare Requisitions
                </button>

                <button 
                  onClick={() => { setView('bunker_bdn'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'bunker_bdn')}
                >
                  <Fuel className="w-3.5 h-3.5 shrink-0" /> Bunker BDN Logs
                </button>

                <button 
                  onClick={() => { setView('bunker_fuel_analysis'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'bunker_fuel_analysis')}
                >
                  <Droplets className="w-3.5 h-3.5 shrink-0 text-sky-500" /> Fuel Lab Analysis
                </button>

                <button 
                  onClick={() => { setView('lube_oil_ldr'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'lube_oil_ldr')}
                >
                  <Waves className="w-3.5 h-3.5 shrink-0 text-blue-400" /> Lube Oil LDR
                </button>

                <button 
                  onClick={() => { setView('lube_oil_analysis'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'lube_oil_analysis')}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" /> Lube Oil Analysis
                </button>

                <button 
                  onClick={() => { setView('store_chemical_requisition'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'store_chemical_requisition')}
                >
                  <FlaskConical className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Store &amp; Chemicals
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Certificates Group - Now elevated to top-level category for immediate action */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsCertificatesOpen(!isCertificatesOpen)}
            className={getCategoryToggleClass(
              ['admin_add_cert', 'admin_cert_list'].includes(view),
              isCertificatesOpen
            )}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" /> Certificates &amp; Reports
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isCertificatesOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isCertificatesOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('admin_add_cert'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'admin_add_cert')}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" /> Add Cert/Report
                </button>
                <button 
                  onClick={() => { setView('admin_cert_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'admin_cert_list')}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> Certificate/Service Report list
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Crew Group */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsCrewOpen(!isCrewOpen)}
            className={getCategoryToggleClass(
              user.role === 'vessel' ? ['crew_list'].includes(view) : ['crew_list', 'crew_compliance'].includes(view),
              isCrewOpen
            )}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" /> Crew Management
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isCrewOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isCrewOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('crew_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'crew_list')}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" /> Onboard Crew
                </button>
                {user.role !== 'vessel' && (
                  <button 
                    onClick={() => { setView('crew_compliance'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'crew_compliance')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Crew Pool List
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Audits Group */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsAuditsOpen(!isAuditsOpen)}
            className={getCategoryToggleClass(
              ['audit_list', 'audit_internal', 'audit_external', 'audit_vir', 'audit_navigational'].includes(view),
              isAuditsOpen
            )}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4" /> Audits &amp; Inspections
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isAuditsOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
          </button>
          
          <AnimatePresence>
            {isAuditsOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-1 space-y-1"
              >
                <button 
                  onClick={() => { setView('audit_list'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_list')}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Audit Registry
                </button>
                <button 
                  onClick={() => { setView('audit_internal'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_internal')}
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" /> Internal Audit
                </button>
                <button 
                  onClick={() => { setView('audit_external'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_external')}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> External Audit
                </button>
                <button 
                  onClick={() => { setView('audit_vir'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_vir')}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" /> VIR Report
                </button>
                <button 
                  onClick={() => { setView('audit_navigational'); setIsSidebarOpen(false); }}
                  className={getSubItemClass(view === 'audit_navigational')}
                >
                  <Compass className="w-3.5 h-3.5 shrink-0 text-blue-500" /> Navigational Audit
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Administration panel */}
        {(user.role === 'admin' || user.role === 'team_pic' || user.role === 'user') && (
          <div className="space-y-1">
            <button 
              onClick={() => setIsAdminTreeOpen(!isAdminTreeOpen)}
              className={getCategoryToggleClass(
                view.startsWith('admin'),
                isAdminTreeOpen
              )}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4" /> Admin Panel
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform duration-250", isAdminTreeOpen ? "rotate-180 text-blue-600" : "text-slate-400")} />
            </button>
            
            <AnimatePresence>
              {isAdminTreeOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-1 space-y-1"
                >
                  <button 
                    onClick={() => { setView('admin_new_vessel'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_new_vessel')}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" /> New Vessel
                  </button>
                  <button 
                    onClick={() => { setView('admin_vessel_list'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_vessel_list')}
                  >
                    <Ship className="w-3.5 h-3.5 shrink-0" /> Vessel List
                  </button>
                  <button 
                    onClick={() => { setView('admin'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin')}
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" /> Admin Settings
                  </button>
                  <button 
                    onClick={() => { setView('admin_recycle_bin'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'admin_recycle_bin')}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> Recycle Bin
                  </button>
                  <button 
                    onClick={() => { setView('graphify'); setIsSidebarOpen(false); }}
                    className={getSubItemClass(view === 'graphify')}
                  >
                    <Network className="w-3.5 h-3.5 shrink-0 text-blue-500" /> Graphify Architecture
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {user.role !== 'vessel' && (
          <button 
            onClick={() => { setView('slideshow'); setIsSidebarOpen(false); }}
            className={getTopLevelClass(view === 'slideshow')}
          >
            <Monitor className="w-4 h-4" /> Slideshow
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-white/80 backdrop-blur-md">
        <button 
          onClick={() => { setIsChangePasswordOpen(true); setIsSidebarOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 group-hover:bg-blue-200 transition-colors">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-slate-800">{user.username}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{getRoleLabel(user.role)}</p>
          </div>
          <Settings className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/70 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );
};

