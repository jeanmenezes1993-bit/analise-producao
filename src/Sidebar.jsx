import React from "react";

const NAV_ITEMS = [
  { id: "painel", label: "Painel", icon: "🗂️" },
  { id: "registrar", label: "Registrar", icon: "➕" },
  { id: "comparativo", label: "Comparativo", icon: "🔀" },
  { id: "colaboradores", label: "Colaboradores", icon: "👥" },
  { id: "produtos", label: "Produtos", icon: "🏷️" }
];

export default function Sidebar({ page, onNavigate, theme, onToggleTheme }) {
  return (
    <aside className="sidebar no-print">
      <div className="sidebar-brand">
        <div className="sidebar-brand-title">Análise Produção</div>
        <div className="sidebar-brand-sub">Processamento</div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"sidebar-link" + (page === item.id ? " active" : "")}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <button type="button" className="sidebar-theme-toggle" onClick={onToggleTheme}>
        {theme === "dark" ? "☀️ Tema claro" : "🌙 Tema escuro"}
      </button>
    </aside>
  );
}
