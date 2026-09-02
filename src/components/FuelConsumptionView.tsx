import React from "react";
import { Fuel, Ship, Activity, Droplets } from "lucide-react";
import { Vessel, DepartureReport, ArrivalReport } from "../types";

export const FuelConsumptionView = ({ vessels, departureReports, arrivalReports }: { 
  vessels: Vessel[], 
  departureReports: DepartureReport[],
  arrivalReports: ArrivalReport[]
}) => {
  const consumptionData = React.useMemo(() => {
    return vessels.map(vessel => {
      const vDepartures = departureReports.filter(r => r.vessel_id === vessel.id);
      const vArrivals = arrivalReports.filter(r => r.vessel_id === vessel.id);

      const totalPortHsfo = vDepartures.reduce((acc, r) => acc + (r.foc_port_hsfo || 0), 0);
      const totalPortLsfo = vDepartures.reduce((acc, r) => acc + (r.foc_port_lsfo || 0), 0);
      const totalPortMgo = vDepartures.reduce((acc, r) => acc + (r.foc_port_mgo || 0), 0);
      const totalPortMdo = vDepartures.reduce((acc, r) => acc + (r.foc_port_mdo || 0), 0);

      const totalSeaHsfo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_hsfo || 0), 0);
      const totalSeaLsfo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_lsfo || 0), 0);
      const totalSeaMgo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_mgo || 0), 0);
      const totalSeaMdo = vArrivals.reduce((acc, r) => acc + (r.foc_sea_mdo || 0), 0);

      return {
        vesselName: vessel.name,
        hsfo: (totalPortHsfo + totalSeaHsfo).toFixed(2),
        lsfo: (totalPortLsfo + totalSeaLsfo).toFixed(2),
        mgo: (totalPortMgo + totalSeaMgo).toFixed(2),
        mdo: (totalPortMdo + totalSeaMdo).toFixed(2),
        total: (totalPortHsfo + totalSeaHsfo + totalPortLsfo + totalSeaLsfo + totalPortMgo + totalSeaMgo + totalPortMdo + totalSeaMdo).toFixed(2)
      };
    });
  }, [vessels, departureReports, arrivalReports]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-900">Fuel Consumption</h1>
        <p className="text-slate-500">Aggregated fuel consumption data from all reports.</p>
      </header>

      <div className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="px-6 py-4">Vessel Name</th>
                <th className="px-6 py-4 text-right">Total HSFO (mt)</th>
                <th className="px-6 py-4 text-right">Total LSFO (mt)</th>
                <th className="px-6 py-4 text-right">Total MGO (mt)</th>
                <th className="px-6 py-4 text-right">Total MDO (mt)</th>
                <th className="px-6 py-4 text-right">Grand Total (mt)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {consumptionData.map((data, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{data.vesselName}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.hsfo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.lsfo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.mgo}</td>
                  <td className="px-6 py-4 font-mono text-sm text-right">{data.mdo}</td>
                  <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600 text-right">{data.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

