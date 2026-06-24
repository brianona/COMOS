import React from 'react';
import { Ship, Code, Lightbulb, ShieldCheck, Mail, ArrowUpRight } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-8 md:p-12 shadow-xl border border-blue-950">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-10 bottom-0 translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-4 md:space-y-6">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
            <Ship className="w-12 h-12 text-blue-300" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">COMOS</h1>
            <p className="text-sm md:text-lg text-blue-100/80 font-medium max-w-2xl">
              Compliance &amp; Operational Monitoring System
            </p>
          </div>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />
          <p className="text-xs md:text-sm text-blue-200/60 max-w-lg leading-relaxed font-mono">
            Empowering modern fleets with unified maritime compliance, certificate management, vessel tracking, and real-time voyage auditing.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Core Vision & Purpose */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Core Concept
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Vessel Compliance Redefined</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              COMOS simplifies and automates maritime compliance by consolidating crew list approvals, vessel voyage reports, fuel analytics, and multi-tier audits into a single, intuitive interface. Designed to minimize operational friction and keep marine ecosystems clean, safe, and efficient.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center gap-4">
            <div className="text-slate-400 text-xs font-mono">
              Version 1.0.0 (LTS)
            </div>
          </div>
        </div>

        {/* Development & Conceptualization Team */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">
              <Lightbulb className="w-3.5 h-3.5" /> Creative Minds
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Our Founders</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Conceptualized and built by visionary minds dedicated to modernizing maritime operations. COMOS stands as a testament to efficient software engineering and smart system design in marine industries.
            </p>
          </div>

          <div className="space-y-3.5 pt-4 border-t border-slate-100">
            {/* Developer 1 */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100/70 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-sm shadow-blue-100 shrink-0">
                EE
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-slate-800">Emeel Lenton Ebio</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Developer &amp; Conceptualizer</p>
              </div>
              <Code className="w-4 h-4 text-slate-300 shrink-0" />
            </div>

            {/* Developer 2 */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100/70 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-sm shadow-indigo-100 shrink-0">
                BO
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-slate-800">Brian Arthur Ona</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Developer &amp; Conceptualizer</p>
              </div>
              <Lightbulb className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          </div>
        </div>

      </div>

      {/* Feature Highlight Banner */}
      <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h4 className="text-sm font-bold text-slate-800">Looking for Technical Support?</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            For operational training, support inquiries, and compliance auditing system integration, please contact our administrative team via email.
          </p>
        </div>
        <a
          href="mailto:it.cleanocean@gmail.com"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-100 shrink-0"
        >
          <Mail className="w-4 h-4" /> Get in Touch <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
