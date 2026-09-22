import React from 'react';
import { 
  Ship, 
  Save, 
  MapPin, 
  Calendar, 
  Clock, 
  Anchor, 
  Navigation, 
  Compass, 
  CheckCircle2, 
  Info,
  Layers,
  ArrowRight,
  Package
} from 'lucide-react';

interface Vessel {
  id: number;
  name: string;
  team_id?: number;
  team_name?: string;
  has_photo?: boolean;
  next_port?: string | null;
}

interface VesselRoutingUserViewProps {
  vessel: Vessel;
  form: any;
  updating: boolean;
  onUpdateRow: (vesselId: number, field: string, value: string) => void;
  onSave: () => void;
  latestOperationType?: string;
}

export const VesselRoutingUserView: React.FC<VesselRoutingUserViewProps> = ({
  vessel,
  form,
  updating,
  onUpdateRow,
  onSave,
  latestOperationType
}) => {
  const currentNavStatus = form.route_status || '';
  const currentOperationType = form.operation_type !== undefined ? (form.operation_type || '') : (latestOperationType || '');
  const currentLoadStatus = form.loading_status || (currentOperationType.toUpperCase() === 'DISCHARGING' ? 'Ballast' : 'Laden');
  const nextPortValue = form.next_port !== undefined ? form.next_port : (vessel.next_port || '');

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="vessel-routing-user-view">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Ship className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{vessel.name} Routing</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Update voyage schedule, next port of call, and current operational status.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={updating}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 disabled:opacity-50"
        >
          {updating ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Save Routing Details</span>
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl border border-blue-100/80 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Next Destination / Port</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nextPortValue}
                onChange={e => onUpdateRow(vessel.id, 'next_port', e.target.value)}
                placeholder="e.g. Rotterdam, Singapore"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Navigational Status</label>
            <select
              value={currentNavStatus}
              onChange={e => onUpdateRow(vessel.id, 'route_status', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">Select Status</option>
              <option value="At sea">At sea</option>
              <option value="At port">At port</option>
              <option value="In Port">In Port</option>
              <option value="Anchorage">Anchorage</option>
              <option value="At Anchor">At Anchor</option>
              <option value="Drifting">Drifting</option>
              <option value="Transiting">Transiting</option>
            </select>
          </div>

          {(currentNavStatus === 'At Anchor' || currentNavStatus === 'Anchor' || currentNavStatus === 'Anchorage') && (
            <div>
              <label className="text-[10px] font-bold uppercase text-amber-600 block mb-1">Number of Shackles</label>
              <input
                type="number"
                value={form.shackles || ''}
                onChange={e => onUpdateRow(vessel.id, 'shackles', e.target.value)}
                placeholder="e.g. 7"
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-amber-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cargo / Loading Condition</label>
            <select
              value={currentLoadStatus}
              onChange={e => onUpdateRow(vessel.id, 'loading_status', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="Laden">Laden</option>
              <option value="Ballast">Ballast</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Operation Type</label>
            <select
              value={currentOperationType}
              onChange={e => onUpdateRow(vessel.id, 'operation_type', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">Select Operation</option>
              <option value="Discharging">Discharging</option>
              <option value="Loading">Loading</option>
              <option value="DISCHARGING">DISCHARGING</option>
              <option value="LOADING">LOADING</option>
              <option value="Bunkering">Bunkering</option>
              <option value="BUNKERING">BUNKERING</option>
              <option value="Ship-to-Ship">Ship-to-Ship</option>
              <option value="ship-to-ship cargo operation">SHIP-TO-SHIP</option>
              <option value="Others">Others</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estimated Time of Arrival (ETA)</label>
            <input
              type="datetime-local"
              value={form.eta_atb ? form.eta_atb.slice(0, 16) : (form.eta_date ? form.eta_date.slice(0, 16) : '')}
              onChange={e => {
                onUpdateRow(vessel.id, 'eta_atb', e.target.value);
                onUpdateRow(vessel.id, 'eta_date', e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estimated Time of Departure (ETD)</label>
            <input
              type="datetime-local"
              value={form.etd_atd ? form.etd_atd.slice(0, 16) : (form.etd_date ? form.etd_date.slice(0, 16) : '')}
              onChange={e => {
                onUpdateRow(vessel.id, 'etd_atd', e.target.value);
                onUpdateRow(vessel.id, 'etd_date', e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Routing Remarks & Cargo Details</label>
          <textarea
            rows={3}
            value={form.remark_from_vessel !== undefined ? form.remark_from_vessel : (form.remarks || '')}
            onChange={e => {
              onUpdateRow(vessel.id, 'remark_from_vessel', e.target.value);
              onUpdateRow(vessel.id, 'remarks', e.target.value);
            }}
            placeholder="Enter any relevant voyage notes, charterer instructions, or operational constraints..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
