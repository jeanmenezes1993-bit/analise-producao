import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export default function Colaboradores() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("app_pp_colaboradores")
      .select("id,nome,ativo")
      .order("nome");
    setLista(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionar(e) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase
      .from("app_pp_colaboradores")
      .insert({ nome: nome.trim(), ativo: true });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome("");
    carregar();
  }

  async function remover(id) {
    if (!window.confirm("Remover este colaborador? Os registros de produção dele não serão apagados.")) return;
    await supabase.from("app_pp_colaboradores").delete().eq("id", id);
    carregar();
  }

  return (
    <div>
      <div className="page-eyebrow">Análise Produção Processamento</div>
      <h1 className="page-title">Colaboradores</h1>

      <div className="crud-layout">
        <form className="form-card crud-form" onSubmit={adicionar}>
          <div className="form-section-title" style={{ marginTop: 0 }}>Novo colaborador</div>
          <div className="form-field">
            <label>Nome</label>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          {erro && <div className="form-msg erro">{erro}</div>}
          <button type="submit" className="submit-btn" disabled={salvando}>
            {salvando ? "Adicionando..." : "+ Adicionar"}
          </button>
        </form>

        <div className="form-card crud-list">
          <div className="form-section-title" style={{ marginTop: 0 }}>Equipe ({lista.length})</div>
          {carregando ? (
            <div className="state-msg">Carregando…</div>
          ) : (
            <div>
              {lista.map((c) => (
                <div className="crud-row" key={c.id}>
                  <span>{c.nome}{!c.ativo && <span className="dupla-tag"> · inativo</span>}</span>
                  <button type="button" className="icon-btn" onClick={() => remover(c.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
