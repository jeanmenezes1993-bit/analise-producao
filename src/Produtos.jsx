import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useSkus } from "./useSkus.js";
import { ORIGENS } from "./origem.js";

export default function Produtos() {
  const { skus, carregando, recarregar } = useSkus();
  const [busca, setBusca] = useState("");

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [origem, setOrigem] = useState("nacional");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const listaFiltrada = useMemo(() => {
    if (!busca.trim()) return skus;
    const q = busca.trim().toLowerCase();
    return skus.filter(
      (s) => s.codigo.toLowerCase().includes(q) || (s.nome || "").toLowerCase().includes(q)
    );
  }, [skus, busca]);

  async function adicionar(e) {
    e.preventDefault();
    setErro(null);
    if (!codigo.trim()) return;
    setSalvando(true);
    const { error } = await supabase
      .from("app_pp_skus")
      .insert({ codigo: codigo.trim(), nome: descricao.trim() || null, origem });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setCodigo("");
    setDescricao("");
    recarregar();
  }

  async function remover(item) {
    if (item.externo) {
      alert("Produtos da base existente não podem ser removidos aqui.");
      return;
    }
    if (!window.confirm("Remover este produto do catálogo?")) return;
    await supabase.from("app_pp_skus").delete().eq("id", item.id);
    recarregar();
  }

  return (
    <div>
      <div className="page-eyebrow">Análise Produção Processamento</div>
      <h1 className="page-title">Produtos</h1>

      <div className="crud-layout">
        <form className="form-card crud-form" onSubmit={adicionar}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Novo produto</div>
          <div className="form-field">
            <label>Código</label>
            <input
              type="text"
              placeholder="Código / nomenclatura"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Descrição</label>
            <input
              type="text"
              placeholder="Opcional"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Origem</label>
            <div className="toggle-group">
              {ORIGENS.map((o) => (
                <button
                  type="button"
                  key={o.valor}
                  className={"toggle-btn" + (origem === o.valor ? " active" : "")}
                  style={origem === o.valor ? { background: o.cor, borderColor: o.cor } : {}}
                  onClick={() => setOrigem(o.valor)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {erro && <div className="form-msg erro">{erro}</div>}
          <button type="submit" className="submit-btn" disabled={salvando}>
            {salvando ? "Adicionando..." : "+ Adicionar"}
          </button>
        </form>

        <div className="form-card crud-list">
          <div className="form-section-title" style={{ marginTop: 0 }}>Catálogo ({skus.length})</div>
          <input
            type="text"
            className="date-input"
            style={{ width: "100%", marginBottom: 12 }}
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {carregando ? (
            <div className="state-msg">Carregando…</div>
          ) : (
            <div className="crud-list-scroll">
              {listaFiltrada.slice(0, 300).map((p) => (
                <div className="crud-row" key={p.id}>
                  <span>
                    <strong>{p.codigo}</strong> — {p.nome || "(sem descrição)"}
                    {p.externo && <span className="dupla-tag"> · base externa</span>}
                  </span>
                  <button type="button" className="icon-btn" onClick={() => remover(p)}>🗑️</button>
                </div>
              ))}
              {listaFiltrada.length > 300 && (
                <div className="state-msg" style={{ padding: 12 }}>
                  Mostrando 300 de {listaFiltrada.length} — refine a busca para ver outros.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
