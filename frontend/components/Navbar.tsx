export function Navbar() {
  return (
    <nav className="rounded-2xl border border-[#c8d5e2] bg-[linear-gradient(125deg,#0d3b66_0%,#235887_65%,#2b6699_100%)] px-5 py-4 text-white shadow-lg">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-mono tracking-wide text-[#d9e5f2]">ARECO SYSTEMS</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Plataforma Text-to-SQL</h1>
        </div>
        <p className="text-sm text-[#e6edf5]">Consultas analíticas em linguagem natural com resultados em tempo real.</p>
      </div>
    </nav>
  );
}
