import React, { useState, useEffect } from 'react';
import { Ship, ChevronLeft, Printer, Edit2, Save, X, FileText, CheckCircle2, Anchor, Compass, Shield, Wrench } from 'lucide-react';
import { Vessel } from '../types';

interface ShipParticularsViewProps {
  vessel: Vessel;
  vessels: Vessel[];
  onSelectVessel: (v: Vessel) => void;
  onBack: () => void;
  token: string;
  currentUserRole: string;
  onVesselUpdated?: () => void;
  flags?: any[];
}

const defaultLoadlineTable = [
  { loadline: 'Summer', freeboard: '', draft: '', displacement: '', deadweight: '' },
  { loadline: 'Tropical F. Water', freeboard: '', draft: '', displacement: '', deadweight: '' },
  { loadline: 'F. Water', freeboard: '', draft: '', displacement: '', deadweight: '' },
  { loadline: 'Winter', freeboard: '', draft: '', displacement: '', deadweight: '' },
  { loadline: 'Tropical', freeboard: '', draft: '', displacement: '', deadweight: '' }
];

export const parseLoadlineTable = (data: any) => {
  if (!data) return defaultLoadlineTable;
  if (Array.isArray(data)) return data;
  if (typeof data === 'string' && data.trim()) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore JSON parse error
    }
  }
  return defaultLoadlineTable;
};

export const ShipParticularsView: React.FC<ShipParticularsViewProps> = ({
  vessel,
  vessels,
  onSelectVessel,
  onBack,
  token,
  currentUserRole,
  onVesselUpdated,
  flags = []
}) => {
  const canEdit = currentUserRole !== 'vessel';

  // State for particulars data initialized blank or with vessel basic info
  const [particulars, setParticulars] = useState({
    nameOfVessel: vessel.name || '',
    portOfRegistry: (vessel as any).port_of_registry || '',
    nationality: vessel.flag || '',
    owners: (vessel as any).owners || vessel.owner || '',
    managingOperator: (vessel as any).managing_operator || '',
    callSign: (vessel as any).call_sign || '',
    officialNumber: (vessel as any).official_number || '',
    imoNumber: (vessel as any).imo_number || '',
    keelLaid: (vessel as any).keel_laid || '',
    mmsi: (vessel as any).mmsi || '',
    grossTonnage: (vessel as any).gross_tonnage || '',
    netTonnage: (vessel as any).net_tonnage || '',
    lengthOverall: (vessel as any).length_overall || '',
    lengthBetweenPerpendiculars: (vessel as any).length_between_perpendiculars || '',
    breadthMoulded: (vessel as any).breadth_moulded || '',
    depthMoulded: (vessel as any).depth_moulded || '',
    designDraft: (vessel as any).design_draft || '',
    scantlingDraft: (vessel as any).scantling_draft || '',
    deadweight: (vessel as any).deadweight || '',
    displacement: (vessel as any).displacement || '',
    lightship: (vessel as any).lightship || '',
    containerCapacity: (vessel as any).container_capacity || '',
    hatchcoverType: (vessel as any).hatchcover_type || '',
    onDeckStackingWeight: (vessel as any).on_deck_stacking_weight || '',
    inHoldStackingWeight: (vessel as any).in_hold_stacking_weight || '',
    tanktopStackingWeight: (vessel as any).tanktop_stacking_weight || '',
    reeferSockets: (vessel as any).reefer_sockets || '',
    blockCoefficient: (vessel as any).block_coefficient || '',
    shipBuilt: (vessel as any).ship_built || vessel.date_built || '',
    airDraft: (vessel as any).air_draft || '',
    cargoHandlingGear: (vessel as any).cargo_handling_gear || '',
    freshWaterCapacity: (vessel as any).fresh_water_capacity || '',
    ballastWaterCapacity: (vessel as any).ballast_water_capacity || '',
    bunkerCapacity: (vessel as any).bunker_capacity || '',
    mainEngineType: (vessel as any).main_engine_type || '',
    auxilliaryEngineType: (vessel as any).auxilliary_engine_type || '',
    propellerType: (vessel as any).propeller_type || '',
    bowthruster: (vessel as any).bowthruster || '',
    rudderType: (vessel as any).rudder_type || '',
    serviceSpeed: (vessel as any).service_speed || '',
    suezCanalGrossTonnage: (vessel as any).suez_canal_gross_tonnage || '',
    suezCanalNetTonnage: (vessel as any).suez_canal_net_tonnage || '',
    classificationSociety: (vessel as any).classification_society || '',
    vsat: (vessel as any).vsat || '',
    fbb: (vessel as any).fbb || '',
    satc: (vessel as any).satc || '',
    email: vessel.email || '',
    companyAddress: (vessel as any).company_address || '',
    loadlineTable: parseLoadlineTable((vessel as any).loadline_table)
  });

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!vessel || isEditing) return;
    setParticulars({
      nameOfVessel: vessel.name || '',
      portOfRegistry: (vessel as any).port_of_registry || '',
      nationality: vessel.flag || '',
      owners: (vessel as any).owners || vessel.owner || '',
      managingOperator: (vessel as any).managing_operator || '',
      callSign: (vessel as any).call_sign || '',
      officialNumber: (vessel as any).official_number || '',
      imoNumber: (vessel as any).imo_number || '',
      keelLaid: (vessel as any).keel_laid || '',
      mmsi: (vessel as any).mmsi || '',
      grossTonnage: (vessel as any).gross_tonnage || '',
      netTonnage: (vessel as any).net_tonnage || '',
      lengthOverall: (vessel as any).length_overall || '',
      lengthBetweenPerpendiculars: (vessel as any).length_between_perpendiculars || '',
      breadthMoulded: (vessel as any).breadth_moulded || '',
      depthMoulded: (vessel as any).depth_moulded || '',
      designDraft: (vessel as any).design_draft || '',
      scantlingDraft: (vessel as any).scantling_draft || '',
      deadweight: (vessel as any).deadweight || '',
      displacement: (vessel as any).displacement || '',
      lightship: (vessel as any).lightship || '',
      containerCapacity: (vessel as any).container_capacity || '',
      hatchcoverType: (vessel as any).hatchcover_type || '',
      onDeckStackingWeight: (vessel as any).on_deck_stacking_weight || '',
      inHoldStackingWeight: (vessel as any).in_hold_stacking_weight || '',
      tanktopStackingWeight: (vessel as any).tanktop_stacking_weight || '',
      reeferSockets: (vessel as any).reefer_sockets || '',
      blockCoefficient: (vessel as any).block_coefficient || '',
      shipBuilt: (vessel as any).ship_built || vessel.date_built || '',
      airDraft: (vessel as any).air_draft || '',
      cargoHandlingGear: (vessel as any).cargo_handling_gear || '',
      freshWaterCapacity: (vessel as any).fresh_water_capacity || '',
      ballastWaterCapacity: (vessel as any).ballast_water_capacity || '',
      bunkerCapacity: (vessel as any).bunker_capacity || '',
      mainEngineType: (vessel as any).main_engine_type || '',
      auxilliaryEngineType: (vessel as any).auxilliary_engine_type || '',
      propellerType: (vessel as any).propeller_type || '',
      bowthruster: (vessel as any).bowthruster || '',
      rudderType: (vessel as any).rudder_type || '',
      serviceSpeed: (vessel as any).service_speed || '',
      suezCanalGrossTonnage: (vessel as any).suez_canal_gross_tonnage || '',
      suezCanalNetTonnage: (vessel as any).suez_canal_net_tonnage || '',
      classificationSociety: (vessel as any).classification_society || '',
      vsat: (vessel as any).vsat || '',
      fbb: (vessel as any).fbb || '',
      satc: (vessel as any).satc || '',
      email: vessel.email || '',
      companyAddress: (vessel as any).company_address || '',
      loadlineTable: parseLoadlineTable((vessel as any).loadline_table)
    });
  }, [vessel, isEditing]);

  const handleSaveParticulars = async () => {
    setSaving(true);
    try {
      const payload = {
        name: particulars.nameOfVessel,
        flag: particulars.nationality,
        email: particulars.email,
        owners: particulars.owners,
        port_of_registry: particulars.portOfRegistry,
        managing_operator: particulars.managingOperator,
        call_sign: particulars.callSign,
        official_number: particulars.officialNumber,
        imo_number: particulars.imoNumber,
        keel_laid: particulars.keelLaid,
        mmsi: particulars.mmsi,
        gross_tonnage: particulars.grossTonnage,
        net_tonnage: particulars.netTonnage,
        length_overall: particulars.lengthOverall,
        length_between_perpendiculars: particulars.lengthBetweenPerpendiculars,
        breadth_moulded: particulars.breadthMoulded,
        depth_moulded: particulars.depthMoulded,
        design_draft: particulars.designDraft,
        scantling_draft: particulars.scantlingDraft,
        deadweight: particulars.deadweight,
        displacement: particulars.displacement,
        lightship: particulars.lightship,
        container_capacity: particulars.containerCapacity,
        hatchcover_type: particulars.hatchcoverType,
        on_deck_stacking_weight: particulars.onDeckStackingWeight,
        in_hold_stacking_weight: particulars.inHoldStackingWeight,
        tanktop_stacking_weight: particulars.tanktopStackingWeight,
        reefer_sockets: particulars.reeferSockets,
        block_coefficient: particulars.blockCoefficient,
        ship_built: particulars.shipBuilt,
        air_draft: particulars.airDraft,
        cargo_handling_gear: particulars.cargoHandlingGear,
        fresh_water_capacity: particulars.freshWaterCapacity,
        ballast_water_capacity: particulars.ballastWaterCapacity,
        bunker_capacity: particulars.bunkerCapacity,
        main_engine_type: particulars.mainEngineType,
        auxilliary_engine_type: particulars.auxilliaryEngineType,
        propeller_type: particulars.propellerType,
        bowthruster: particulars.bowthruster,
        rudder_type: particulars.rudderType,
        service_speed: particulars.serviceSpeed,
        suez_canal_gross_tonnage: particulars.suezCanalGrossTonnage,
        suez_canal_net_tonnage: particulars.suezCanalNetTonnage,
        classification_society: particulars.classificationSociety,
        vsat: particulars.vsat,
        fbb: particulars.fbb,
        satc: particulars.satc,
        company_address: particulars.companyAddress,
        loadline_table: particulars.loadlineTable
      };

      const res = await fetch(`/api/vessels/${vessel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error || 'Failed to update ship particulars');
      }

      setToastMessage('Ship particulars saved successfully.');
      setTimeout(() => setToastMessage(null), 3000);
      setIsEditing(false);

      if (resData?.vessel) {
        const v = resData.vessel;
        setParticulars({
          nameOfVessel: v.name || '',
          portOfRegistry: v.port_of_registry || '',
          nationality: v.flag || '',
          owners: v.owners || v.owner || '',
          managingOperator: v.managing_operator || '',
          callSign: v.call_sign || '',
          officialNumber: v.official_number || '',
          imoNumber: v.imo_number || '',
          keelLaid: v.keel_laid || '',
          mmsi: v.mmsi || '',
          grossTonnage: v.gross_tonnage || '',
          netTonnage: v.net_tonnage || '',
          lengthOverall: v.length_overall || '',
          lengthBetweenPerpendiculars: v.length_between_perpendiculars || '',
          breadthMoulded: v.breadth_moulded || '',
          depthMoulded: v.depth_moulded || '',
          designDraft: v.design_draft || '',
          scantlingDraft: v.scantling_draft || '',
          deadweight: v.deadweight || '',
          displacement: v.displacement || '',
          lightship: v.lightship || '',
          containerCapacity: v.container_capacity || '',
          hatchcoverType: v.hatchcover_type || '',
          onDeckStackingWeight: v.on_deck_stacking_weight || '',
          inHoldStackingWeight: v.in_hold_stacking_weight || '',
          tanktopStackingWeight: v.tanktop_stacking_weight || '',
          reeferSockets: v.reefer_sockets || '',
          blockCoefficient: v.block_coefficient || '',
          shipBuilt: v.ship_built || v.date_built || '',
          airDraft: v.air_draft || '',
          cargoHandlingGear: v.cargo_handling_gear || '',
          freshWaterCapacity: v.fresh_water_capacity || '',
          ballastWaterCapacity: v.ballast_water_capacity || '',
          bunkerCapacity: v.bunker_capacity || '',
          mainEngineType: v.main_engine_type || '',
          auxilliaryEngineType: v.auxilliary_engine_type || '',
          propellerType: v.propeller_type || '',
          bowthruster: v.bowthruster || '',
          rudderType: v.rudder_type || '',
          serviceSpeed: v.service_speed || '',
          suezCanalGrossTonnage: v.suez_canal_gross_tonnage || '',
          suezCanalNetTonnage: v.suez_canal_net_tonnage || '',
          classificationSociety: v.classification_society || '',
          vsat: v.vsat || '',
          fbb: v.fbb || '',
          satc: v.satc || '',
          email: v.email || '',
          companyAddress: v.company_address || '',
          loadlineTable: parseLoadlineTable(v.loadline_table)
        });
        onSelectVessel(v);
      }

      onVesselUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Error saving particulars');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    {
      title: 'General Identification',
      icon: Ship,
      rows: [
        { label: 'Name of Vessel', key: 'nameOfVessel', bold: true },
        { label: 'Port of Registry', key: 'portOfRegistry' },
        { label: 'Nationality / Flag', key: 'nationality' },
        { label: 'Owners', key: 'owners' },
        { label: 'Managing Operator', key: 'managingOperator' },
        { label: 'Call Sign / Distinctive number', key: 'callSign' },
        { label: 'Official Number', key: 'officialNumber' },
        { label: 'IMO Number', key: 'imoNumber' },
        { label: 'Keel Laid Date', key: 'keelLaid' },
        { label: 'MMSI', key: 'mmsi' },
        { label: 'Ship Built By', key: 'shipBuilt' }
      ]
    },
    {
      title: 'Dimensions & Tonnages',
      icon: Anchor,
      rows: [
        { label: 'Gross Tonnage', key: 'grossTonnage' },
        { label: 'Net Tonnage', key: 'netTonnage' },
        { label: 'Length Overall (LOA)', key: 'lengthOverall' },
        { label: 'Length Between Perpendiculars (LBP)', key: 'lengthBetweenPerpendiculars' },
        { label: 'Breadth Moulded', key: 'breadthMoulded' },
        { label: 'Depth Moulded', key: 'depthMoulded' },
        { label: 'Design Draft', key: 'designDraft' },
        { label: 'Scantling Draft', key: 'scantlingDraft' },
        { label: 'Deadweight (design/scantling)', key: 'deadweight' },
        { label: 'Displacement (scantling)', key: 'displacement' },
        { label: 'Lightship', key: 'lightship' },
        { label: 'Block Coefficient (Design draft)', key: 'blockCoefficient' },
        { label: 'Air Draft', key: 'airDraft' },
        { label: 'Suez Canal Gross Tonnage', key: 'suezCanalGrossTonnage' },
        { label: 'Suez Canal Net Tonnage', key: 'suezCanalNetTonnage' }
      ]
    },
    {
      title: 'Cargo & Capacities',
      icon: Compass,
      rows: [
        { label: 'Container Capacity', key: 'containerCapacity' },
        { label: 'Hatchcover Type', key: 'hatchcoverType' },
        { label: 'On deck Stacking Weight (20\' / 40\')', key: 'onDeckStackingWeight' },
        { label: 'In hold Stacking Weight (20\' / 40\')', key: 'inHoldStackingWeight' },
        { label: 'Tanktop Stacking Weight (20\' / 40\')', key: 'tanktopStackingWeight' },
        { label: 'Reefer Sockets', key: 'reeferSockets' },
        { label: 'Cargo Handling Gear', key: 'cargoHandlingGear' },
        { label: 'Fresh Water Capacity', key: 'freshWaterCapacity' },
        { label: 'Ballast Water Capacity', key: 'ballastWaterCapacity' },
        { label: 'Bunker Capacity', key: 'bunkerCapacity', multiline: true }
      ]
    },
    {
      title: 'Machinery & Performance',
      icon: Wrench,
      rows: [
        { label: 'Main Engine Type', key: 'mainEngineType', multiline: true },
        { label: 'Auxilliary Engine Type', key: 'auxilliaryEngineType' },
        { label: 'Propeller Type', key: 'propellerType' },
        { label: 'Bowthruster', key: 'bowthruster' },
        { label: 'Rudder Type', key: 'rudderType' },
        { label: 'Service Speed', key: 'serviceSpeed' }
      ]
    },
    {
      title: 'Communication & Administration',
      icon: Shield,
      rows: [
        { label: 'Classification Society / NK Reg', key: 'classificationSociety' },
        { label: 'VSAT', key: 'vsat', multiline: true },
        { label: 'FBB', key: 'fbb' },
        { label: 'SAT-C', key: 'satc' },
        { label: 'E-mail', key: 'email', isEmail: true },
        { label: 'Company Address', key: 'companyAddress', multiline: true }
      ]
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-blue-100 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors flex items-center gap-1.5 font-bold text-xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Vessel Details</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Ship className="w-5 h-5 text-blue-600" /> Ship Particulars — {vessel.name}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Official Technical Characteristics, Capacities, Loadlines & Machinery Specifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Switch Vessel Dropdown */}
          <select 
            value={String(vessel.id)}
            onChange={(e) => {
              const v = vessels.find(item => String(item.id) === e.target.value);
              if (v) onSelectVessel(v);
            }}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20"
          >
            {vessels.map(v => (
              <option key={v.id} value={String(v.id)}>{v.name}</option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Sheet</span>
          </button>

          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-100"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit Particulars</span>
            </button>
          )}

          {canEdit && isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveParticulars}
                disabled={saving}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-100 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Redesigned Modern System UI Card Layout for Ship Particulars */}
      <div className="space-y-6">
        {sections.map((sec, secIdx) => {
          const SecIcon = sec.icon;
          return (
            <div key={secIdx} className="bg-white rounded-3xl border border-blue-100/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-blue-100/60 flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-2xs">
                  <SecIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{sec.title}</h3>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sec.rows.map((r, rIdx) => {
                  const val = (particulars as any)[r.key] || '';
                  return (
                    <div key={rIdx} className={r.multiline ? "md:col-span-2 lg:col-span-3 space-y-1.5" : "space-y-1.5"}>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        {r.label}
                      </label>
                      {isEditing ? (
                        r.key === 'nationality' ? (
                          <select
                            value={val}
                            onChange={e => setParticulars({ ...particulars, [r.key]: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800 cursor-pointer"
                          >
                            <option value="">Select Flag State</option>
                            {flags.map((f: any) => {
                              const flagName = typeof f === 'string' ? f : f.name;
                              return <option key={flagName} value={flagName}>{flagName}</option>;
                            })}
                          </select>
                        ) : r.multiline ? (
                          <textarea
                            rows={3}
                            value={val}
                            onChange={e => setParticulars({ ...particulars, [r.key]: e.target.value })}
                            placeholder="Enter details..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800"
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={e => setParticulars({ ...particulars, [r.key]: e.target.value })}
                            placeholder="Not specified"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800"
                          />
                        )
                      ) : (
                        <div className="px-3 py-2.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs font-bold text-slate-800 min-h-[38px] flex items-center">
                          {r.isEmail && val ? (
                            <a href={`mailto:${val}`} className="text-blue-600 hover:underline">{val}</a>
                          ) : (
                            <span className={val ? "whitespace-pre-wrap" : "text-slate-400 font-normal italic"}>
                              {val || 'Not specified'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Loadline & Draft Table Card */}
        <div className="bg-white rounded-3xl border border-blue-100/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/80 border-b border-blue-100/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-2xs">
                <Anchor className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Loadline, Freeboard & Draft Table</h3>
            </div>
          </div>

          <div className="p-6 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Loadline</th>
                  <th className="py-3 px-4">Freeboard</th>
                  <th className="py-3 px-4">Draft</th>
                  <th className="py-3 px-4">Displacement</th>
                  <th className="py-3 px-4">Deadweight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {particulars.loadlineTable.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 text-xs">{row.loadline}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={row.freeboard} 
                          onChange={e => {
                            const copy = [...particulars.loadlineTable];
                            copy[i].freeboard = e.target.value;
                            setParticulars({ ...particulars, loadlineTable: copy });
                          }}
                          placeholder="e.g. 6.932m"
                          className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                      ) : (row.freeboard || <span className="text-slate-400 italic">N/A</span>)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={row.draft} 
                          onChange={e => {
                            const copy = [...particulars.loadlineTable];
                            copy[i].draft = e.target.value;
                            setParticulars({ ...particulars, loadlineTable: copy });
                          }}
                          placeholder="e.g. 11.029m"
                          className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                      ) : (row.draft || <span className="text-slate-400 italic">N/A</span>)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={row.displacement} 
                          onChange={e => {
                            const copy = [...particulars.loadlineTable];
                            copy[i].displacement = e.target.value;
                            setParticulars({ ...particulars, loadlineTable: copy });
                          }}
                          placeholder="e.g. 50,719"
                          className="w-32 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                      ) : (row.displacement || <span className="text-slate-400 italic">N/A</span>)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={row.deadweight} 
                          onChange={e => {
                            const copy = [...particulars.loadlineTable];
                            copy[i].deadweight = e.target.value;
                            setParticulars({ ...particulars, loadlineTable: copy });
                          }}
                          placeholder="e.g. 38,938"
                          className="w-32 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                        />
                      ) : (row.deadweight || <span className="text-slate-400 italic">N/A</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
