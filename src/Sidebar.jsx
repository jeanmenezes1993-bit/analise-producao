import React from "react";
import { LayoutGrid, CirclePlus, Shuffle, Users, Tag, Sun, Moon, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { id: "painel", label: "Painel", Icon: LayoutGrid },
  { id: "registrar", label: "Registrar", Icon: CirclePlus },
  { id: "comparativo", label: "Comparativo", Icon: Shuffle },
  { id: "colaboradores", label: "Colaboradores", Icon: Users },
  { id: "produtos", label: "Produtos", Icon: Tag }
];

export default function Sidebar({ page, onNavigate, theme, onToggleTheme, onSair }) {
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
            <item.Icon size={18} strokeWidth={2} />
            {item.label}
          </button>
        ))}
      </nav>
      <button type="button" className="sidebar-theme-toggle" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
      <button type="button" className="sidebar-theme-toggle" onClick={onSair}>
        <LogOut size={16} />
        Sair
      </button>
    </aside>
  );
}
