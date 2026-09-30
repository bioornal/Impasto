/** Monthly planned amounts only. Actual expenses belong to the monthly result. */
export function presupuestoMensual(fijos:Array<{activo?:unknown;monto?:unknown}>,variables:Array<{monto_referencia?:unknown}>):number {
  const amount=(raw:unknown)=>{
    if((typeof raw!=='number' && typeof raw!=='string') || String(raw).trim()==='')throw new Error('Presupuesto mensual inválido');
    if(typeof raw==='string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))throw new Error('Presupuesto mensual inválido');
    const value=Number(raw);if(!Number.isFinite(value) || value<0)throw new Error('Presupuesto mensual inválido');return value;
  };
  const total=fijos.filter(row=>row.activo===true).reduce((sum,row)=>sum+amount(row.monto),0)+variables.reduce((sum,row)=>sum+amount(row.monto_referencia),0);
  if(!Number.isFinite(total))throw new Error('Presupuesto mensual fuera de rango');
  return total;
}
