import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { ORIGENS } from "./origem.js";

const PROCESSOS = [
  { key: "etiquetagem", label: "Etiquetagem" },
  { key: "triagem", label: "Triagem" },
  { key: "embalar", label: "Embalar" }
];

function tempoMinEntre(inicio, fim) {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? diff : 0;
}

// Edita UMA linha de app_pp_producoes. Em registros de dupla, a outra
// metade da dupla é uma linha separada e não é alterada aqui (mesma
// regra do sistema anterior: "a alteração afeta apenas esta linha").
export default function EditarRegistroModal({ registro, colaboradores, skus, onClose, onSaved }) {
  const opcoesColaborador = useMemo(() => {
    const existe = colaboradores.some((c) => c.id === registro.colaborador_id);
    if (existe) return colaboradores;
    // Colaborador do registro não está na lista de ativos (ex.: removido/inativo).
    return [
      { id: registro.colaborador_id || "__atual", nome: registro.colaborador_nome },
      ...colaboradores
    ];
  }, [colaboradores, registro]);

  const [colaboradorId, setColaboradorId] = useState(
    registro.colaborador_id || opcoesColaborador[0]?.id || ""
  );
  const [skuSel, setSkuSel] = useState(
    registro.sku ? { codigo: registro.sku, nome: registro.sku_nome } : null
  );
  const [skuQuery, setSkuQuery] = useState("");
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [quantidade, setQuantidade] = useState(String(registro.quantidade ?? ""));
  const [origem, setOrigem] = useState(registro.origem || "nacional");
  const [processos, setProcessos] = useState({
    etiquetagem: !!registro.etiquetagem,
    triagem: !!registro.triagem,
    embalar: !!registro.embalar
  });
  const [horaInicio, setHoraInicio] = useState((registro.hora_inicio || "").slice(0, 5));
  const [horaFim, setHoraFim] = useState((registro.hora_fim || "").slice(0, 5));
  const [data, setData] = useState(registro.data);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const numProcessos = Object.values(processos).filter(Boolean).length;
  const qtdNum = Number(quantidade) || 0;
  const unidadesBrutas = qtdNum * numProcessos;
  const unidadesLinha = registro.em_dupla ? unidadesBrutas / 2 : unidadesBrutas;

  const skusFiltrados = useMemo(() => {
    if (!skuQuery.trim()) return skus.slice(0, 20);
    const q = skuQuery.trim().toLowerCase();
    return skus
      .filter((s) => s.codigo.toLowerCase().includes(q) || (s.nome || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [skus, skuQuery]);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    const colab = opcoesColaborador.find((c) => c.id === colaboradorId);
    if (!colab) return setErro("Selecione o colaborador.");
    if (qtdNum <= 0) return setErro("Informe a quantidade.");
    if (numProcessos === 0) return setErro("Marque ao menos um processo.");

    const colaboradorIdFinal = colaboradorId === "__atual" ? registro.colaborador_id : colaboradorId;

    setSalvando(true);
    const { error } = await supabase
      .from("app_pp_producoes")
      .update({
        colaborador_id: colaboradorIdFinal,
        colaborador_nome: colab.nome,
        sku: skuSel ? skuSel.codigo : registro.sku,
        sku_nome: skuSel ? skuSel.nome : registro.sku_nome,
        quantidade: qtdNum,
        etiquetagem: processos.etiquetagem,
        triagem: processos.triagem,
        embalar: processos.embalar,
        num_processos: numProcessos,
        unidades_efetivas: unidadesLinha,
        origem,
        hora_inicio: horaInicio || null,
        hora_fim: horaFim || null,
        tempo_min: tempoMinEntre(horaInicio, horaFim),
        data
      })
      .eq("id", registro.id);
    setSalvando(false);

    if (error) {
      setErro("Erro ao salvar: " + error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-panel" onSubmit={salvar}>
        <div className="modal-title">Editar registro</div>
        {registro.em_dupla && (
          <div className="modal-aviso">
            Registro em dupla — a alteração afeta apenas esta linha ({registro.colaborador_nome}).
          </div>
        )}

        <div className="form-field">
          <label>Colaborador</label>
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            {opcoesColaborador.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="form-field" style={{ position: "relative" }}>
          <label>Produto / SKU</label>
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={
              skuSel
                ? `${skuSel.codigo}${skuSel.nome ? " — " + skuSel.nome : ""}`
                : skuQuery
            }
            onChange={(e) => {
              setSkuSel(null);
              setSkuQuery(e.target.value);
              setMostrarDropdown(true);
            }}
            onFocus={() => setMostrarDropdown(true)}
            onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
          />
          {mostrarDropdown && skusFiltrados.length > 0 && (
            <div className="sku-dropdown">
              {skusFiltrados.map((s) => (
                <div
                  key={s.id}
                  className="sku-dropdown-item"
                  onMouseDown={() => {
                    setSkuSel({ codigo: s.codigo, nome: s.nome });
                    setSkuQuery("");
                    setMostrarDropdown(false);
                  }}
                >
                  <strong>{s.codigo}</strong> — {s.nome}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label>Quantidade</label>
            <input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 2 }}>
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
        </div>

        <div className="form-field">
          <label>Processos executados</label>
          <div className="toggle-group">
            {PROCESSOS.map((p) => (
              <button
                type="button"
                key={p.key}
                className={"toggle-btn" + (processos[p.key] ? " active" : "")}
                onClick={() => setProcessos((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label>Hora início</label>
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label>Hora fim</label>
            <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <div className="calculo-preview">
          <span>Cálculo</span>
          <span>
            {qtdNum} × {numProcessos} = <strong>{Math.round(unidadesBrutas)}</strong> un.
            {registro.em_dupla && (
              <> · <strong>{Math.round(unidadesLinha)}</strong> p/ esta linha</>
            )}
          </span>
        </div>

        {erro && <div className="form-msg erro">{erro}</div>}

        <div className="modal-actions">
          <button type="button" className="export-mini-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="submit-btn" style={{ width: "auto", padding: "10px 22px" }} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
