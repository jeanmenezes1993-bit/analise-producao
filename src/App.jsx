import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import Painel from "./Painel.jsx";
import Registrar from "./Registrar.jsx";
import Comparativo from "./Comparativo.jsx";
import Colaboradores from "./Colaboradores.jsx";
import Produtos from "./Produtos.jsx";
import Login from "./Login.jsx";

function usePersistedTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("vx-theme") || "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vx-theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

const PAGINAS = {
  painel: Painel,
  registrar: Registrar,
  comparativo: Comparativo,
  colaboradores: Colaboradores,
  produtos: Produtos
};

export default function App() {
  const [page, setPage] = useState("painel");
  const [theme, setTheme] = usePersistedTheme();
  const [logado, setLogado] = useState(false);

  const Pagina = PAGINAS[page] || Painel;

  if (!logado) {
    return <Login onEntrar={() => setLogado(true)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <main className="main">
        <Pagina />
      </main>
    </div>
  );
}
