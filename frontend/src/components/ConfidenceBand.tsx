import type {ConfidenceBand} from "../types";
export default function ConfidenceBand({band}:{band:ConfidenceBand}){
 const fmt=(v:string)=>new Date(v).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
 return <div className="space-y-2">
  <div className="relative h-2 rounded-full bg-white/10 overflow-hidden"><div className="absolute inset-y-0 left-[8%] right-[8%] rounded-full bg-blue-500/60"/><div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(59,130,246,.9)]"/></div>
  <div className="flex justify-between text-[11px] text-white/45"><span>Early {fmt(band.p10)}</span><span className="text-blue-300">Likely {fmt(band.p50)}</span><span>Late {fmt(band.p90)}</span></div>
 </div>
}
