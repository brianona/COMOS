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
  const currentLoadStatus = form.loading_status || (latestOperationType === 'DISCHARGING' ? 'Ballast' : 'Laden');

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
                value={form.next_port || ''}
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
              <option value="In Port">In Port</option>
              <option value="At Anchor">At Anchor</option>
              <option value="Drifting">Drifting</option>
            </select>
          </div>

          {currentNavStatus === 'At Anchor' && (
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
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estimated Time of Arrival (ETA)</label>
            <input
              type="datetime-local"
              value={form.eta_date ? form.eta_date.slice(0, 16) : ''}
              onChange={e => onUpdateRow(vessel.id, 'eta_date', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estimated Time of Departure (ETD)</label>
            <input
              type="datetime-local"
              value={form.etd_date ? form.etd_date.slice(0, 16) : ''}
              onChange={e => onUpdateRow(vessel.id, 'etd_date', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Routing Remarks & Cargo Details</label>
          <textarea
            rows={3}
            value={form.remarks || ''}
            onChange={e => onUpdateRow(vessel.id, 'remarks', e.target.value)}
            placeholder="Enter any relevant voyage notes, charterer instructions, or operational constraints..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};
