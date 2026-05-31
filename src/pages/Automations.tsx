export function Automations() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Automatizaciones & WhatsApp</h2>
        <p className="text-slate-500">Configura respuestas automáticas y flujos de seguimiento.</p>
      </div>
      <div className="p-8 border-2 border-dashed rounded-lg bg-slate-50 text-center">
        <h3 className="font-semibold text-lg">Conectar WhatsApp API</h3>
        <p className="text-slate-500 max-w-md mx-auto mt-2">
          Vincula tu número comercial para empezar a enviar mensajes automáticos a leads nuevos que vieron tus propiedades.
        </p>
        <button className="mt-4 px-4 py-2 bg-[#25D366] text-white rounded-md font-medium hover:bg-[#20b858]">
          Vincular WhatsApp
        </button>
      </div>
    </div>
  );
}
