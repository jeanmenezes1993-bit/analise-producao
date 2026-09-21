import React, { useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useColaboradores } from "./useColaboradores.js";
import { useSkus } from "./useSkus.js";
import { ORIGENS } from "./origem.js";
import EditarRegistroModal from "./EditarRegistroModal.jsx";
import { Pencil } from "lucide-react";

const REGISTROS_POR_PAGINA = 15;
const MAX_PAGINAS = 10;

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function tempoMinEntre(inicio, fim) {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  const min1 = h1 * 60 + m1;
  const min2 = h2 * 60 + m2;
  const diff = min2 - min1;
  return diff > 0 ? diff : 0;
}

const PROCESSOS = [
  { key: "etiquetagem", label: "Etiquetagem" },
  { key: "triagem", label: "Triagem" },
  { key: "embalar", label: "Embalar" }
];

const CSV_COLUNAS = [
  "Data", "Colaborador", "Dupla", "Produto/SKU", "Descrição",
  "Quantidade", "Processos", "Nº Processos", "Unidades", "Origem",
  "Hora início", "Hora fim", "Duração (min)"
];

function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function baixarCSV(registros) {
  const linhas = registros.map((r) => {
    const processos = [
      r.etiquetagem ? "Etiquetagem" : null,
      r.triagem ? "Triagem" : null,
      r.embalar ? "Embalar" : null
    ].filter(Boolean).join(" + ");
    return [
      r.data.split("-").reverse().join("/"),
      r.colaborador_nome,
      r.em_dupla ? "Sim" : "Não",
      r.sku || "",
      r.sku_nome || "",
      r.quantidade ?? "",
      processos,
      r.num_processos ?? "",
      Math.round(Number(r.unidades_efetivas || 0)),
      r.origem,
      r.hora_inicio || "",
      r.hora_fim || "",
      r.tempo_min ?? ""
    ];
  });
  const csv = [CSV_COLUNAS, ...linhas]
    .map((linha) => linha.map(csvEscape).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registros-producao-${hojeISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Registrar() {
  const colaboradores = useColaboradores();
  const { skus } = useSkus();

  const [colaboradorId, setColaboradorId] = useState("");
  const [emDupla, setEmDupla] = useState(false);
  const [colaboradorId2, setColaboradorId2] = useState("");

  const [skuQuery, setSkuQuery] = useState("");
  const [skuSelecionado, setSkuSelecionado] = useState(null);
  const [mostrarSkuDropdown, setMostrarSkuDropdown] = useState(false);

  const [quantidade, setQuantidade] = useState("");
  const [origem, setOrigem] = useState("nacional");
  const [processos, setProcessos] = useState({ etiquetagem: false, triagem: false, embalar: false });
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [data, setData] = useState(hojeISO());

  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [registros, setRegistros] = useState([]);
  const [buscaRegistros, setBuscaRegistros] = useState("");
  const [carregandoRegistros, setCarregandoRegistros] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [editando, setEditando] = useState(null);

  const fingerprintsSessao = useRef(new Set());

  const numProcessos = Object.values(processos).filter(Boolean).length;
  const tempoMin = tempoMinEntre(horaInicio, horaFim);
  const qtdNum = Number(quantidade) || 0;
  const unidadesBrutas = qtdNum * numProcessos;
  const unidadesPreview = emDupla ? unidadesBrutas / 2 : unidadesBrutas;

  const skusFiltrados = useMemo(() => {
    if (!skuQuery.trim()) return skus.slice(0, 20);
    const q = skuQuery.trim().toLowerCase();
    return skus
      .filter((s) => s.codigo.toLowerCase().includes(q) || (s.nome || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [skus, skuQuery]);

  async function carregarRegistros(termo, paginaAlvo = 1) {
    setCarregandoRegistros(true);
    const de = (paginaAlvo - 1) * REGISTROS_POR_PAGINA;
    const ate = de + REGISTROS_POR_PAGINA - 1;
    let query = supabase
      .from("app_pp_producoes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(de, ate);
    if (termo && termo.trim()) {
      query = query.or(`colaborador_nome.ilike.%${termo}%,sku_nome.ilike.%${termo}%,sku.ilike.%${termo}%`);
    }
    const { data: regs, count } = await query;
    setRegistros(regs || []);
    setTotalRegistros(count || 0);
    setPagina(paginaAlvo);
    setCarregandoRegistros(false);
  }

  React.useEffect(() => {
    carregarRegistros("", 1);
  }, []);

  const totalPaginas = Math.min(
    MAX_PAGINAS,
    Math.max(1, Math.ceil(totalRegistros / REGISTROS_POR_PAGINA))
  );

  function fingerprint() {
    const cols = [colaboradorId, emDupla ? colaboradorId2 : ""].filter(Boolean).sort().join("+");
    return [data, horaInicio, horaFim, cols, skuSelecionado ? skuSelecionado.codigo : skuQuery].join("|");
  }

  function limparFormulario() {
    setColaboradorId("");
    setEmDupla(false);
    setColaboradorId2("");
    setSkuQuery("");
    setSkuSelecionado(null);
    setQuantidade("");
    setProcessos({ etiquetagem: false, triagem: false, embalar: false });
    setHoraInicio("");
    setHoraFim("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);

    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) {
      setMensagem({ tipo: "erro", texto: "Selecione o colaborador." });
      return;
    }
    if (emDupla && !colaboradorId2) {
      setMensagem({ tipo: "erro", texto: "Selecione o 2º colaborador da dupla." });
      return;
    }
    if (emDupla && colaboradorId === colaboradorId2) {
      setMensagem({ tipo: "erro", texto: "Os dois colaboradores devem ser diferentes." });
      return;
    }
    if (qtdNum <= 0) {
      setMensagem({ tipo: "erro", texto: "Informe a quantidade." });
      return;
    }
    if (numProcessos === 0) {
      setMensagem({ tipo: "erro", texto: "Marque ao menos um processo." });
      return;
    }

    const fp = fingerprint();
    if (fingerprintsSessao.current.has(fp)) {
      const prosseguir = window.confirm(
        "Já existe um cadastro feito agora, nesta mesma visita, com o mesmo horário, " +
          "colaborador(es) e produto.\n\nDeseja cadastrar mesmo assim?"
      );
      if (!prosseguir) return;
    }

    setSalvando(true);

    const grupoId = crypto.randomUUID();
    const skuCodigo = skuSelecionado ? skuSelecionado.codigo : skuQuery || null;
    const skuNome = skuSelecionado ? skuSelecionado.nome : null;
    const colaborador2 = emDupla ? colaboradores.find((c) => c.id === colaboradorId2) : null;

    const base = {
      grupo_id: grupoId,
      sku: skuCodigo,
      sku_nome: skuNome,
      quantidade: qtdNum,
      etiquetagem: processos.etiquetagem,
      triagem: processos.triagem,
      embalar: processos.embalar,
      num_processos: numProcessos,
      origem,
      hora_inicio: horaInicio || null,
      hora_fim: horaFim || null,
      tempo_min: tempoMin,
      data
    };

    const linhas = emDupla
      ? [
          {
            ...base,
            colaborador_id: colaborador.id,
            colaborador_nome: colaborador.nome,
            em_dupla: true,
            parceiro_nome: colaborador2.nome,
            unidades_efetivas: unidadesBrutas / 2
          },
          {
            ...base,
            colaborador_id: colaborador2.id,
            colaborador_nome: colaborador2.nome,
            em_dupla: true,
            parceiro_nome: colaborador.nome,
            unidades_efetivas: unidadesBrutas / 2
          }
        ]
      : [
          {
            ...base,
            colaborador_id: colaborador.id,
            colaborador_nome: colaborador.nome,
            em_dupla: false,
            parceiro_nome: null,
            unidades_efetivas: unidadesBrutas
          }
        ];

    const { error } = await supabase.from("app_pp_producoes").insert(linhas);

    setSalvando(false);

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro ao registrar: " + error.message });
      return;
    }

    fingerprintsSessao.current.add(fp);
    setMensagem({ tipo: "sucesso", texto: "Produção registrada com sucesso." });
    limparFormulario();
    carregarRegistros(buscaRegistros);
  }

  return (
    <div>
      <div className="page-eyebrow">Análise Produção Processamento</div>
      <h1 className="page-title">Registro de Produção</h1>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-section-title">Identificação</div>
        <div className="form-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label>Colaborador</label>
            <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
              <option value="">Selecione...</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={emDupla} onChange={(e) => setEmDupla(e.target.checked)} />
            Em dupla
          </label>
        </div>

        {emDupla && (
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label>2º colaborador da dupla</label>
              <select value={colaboradorId2} onChange={(e) => setColaboradorId2(e.target.value)}>
                <option value="">Selecione...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="form-section-title">Produto e Quantidade</div>
        <div className="form-field" style={{ position: "relative" }}>
          <label>Produto / SKU</label>
          <input
            type="text"
            placeholder="Buscar por código ou nome..."
            value={skuSelecionado ? `${skuSelecionado.codigo} — ${skuSelecionado.nome}` : skuQuery}
            onChange={(e) => {
              setSkuSelecionado(null);
              setSkuQuery(e.target.value);
              setMostrarSkuDropdown(true);
            }}
            onFocus={() => setMostrarSkuDropdown(true)}
            onBlur={() => setTimeout(() => setMostrarSkuDropdown(false), 150)}
          />
          {mostrarSkuDropdown && skusFiltrados.length > 0 && (
            <div className="sku-dropdown">
              {skusFiltrados.map((s) => (
                <div
                  key={s.id}
                  className="sku-dropdown-item"
                  onMouseDown={() => {
                    setSkuSelecionado(s);
                    setSkuQuery("");
                    setMostrarSkuDropdown(false);
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
            <input
              type="number"
              placeholder="Ex: 100"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
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

        <div className="form-section-title">Processos Executados</div>
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

        <div className="form-section-title">Período de Trabalho</div>
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
            {qtdNum} un × {numProcessos} processo(s) = <strong>{Math.round(unidadesBrutas)}</strong> un.
            {emDupla && (
              <> · <strong>{Math.round(unidadesPreview)}</strong> un. por colaborador (dupla)</>
            )}
          </span>
        </div>

        {mensagem && (
          <div className={"form-msg " + mensagem.tipo}>{mensagem.texto}</div>
        )}

        <button type="submit" className="submit-btn" disabled={salvando}>
          {salvando ? "Registrando..." : "+ Registrar Produção"}
        </button>
      </form>

      <div className="registros-recentes">
        <div className="registros-recentes-header">
          <strong>Registros recentes</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Buscar colaborador ou produto..."
              className="date-input"
              value={buscaRegistros}
              onChange={(e) => {
                setBuscaRegistros(e.target.value);
                carregarRegistros(e.target.value, 1);
              }}
            />
            <button type="button" className="export-mini-btn" onClick={() => baixarCSV(registros)}>
              ⬇ Exportar
            </button>
          </div>
        </div>
        {carregandoRegistros ? (
          <div className="state-msg">Carregando…</div>
        ) : registros.length === 0 ? (
          <div className="state-msg">Nenhum registro encontrado.</div>
        ) : (
          <table className="registros-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Un. efetivas</th>
                <th>Origem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td>{r.data.split("-").reverse().join("/")}</td>
                  <td>
                    {r.colaborador_nome}
                    {r.em_dupla && <span className="dupla-tag"> · dupla</span>}
                  </td>
                  <td>{r.sku_nome ? `${r.sku} — ${r.sku_nome}` : (r.sku || "—")}</td>
                  <td>{r.quantidade}</td>
                  <td>{Math.round(Number(r.unidades_efetivas || 0))}</td>
                  <td>{r.origem}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Editar registro"
                      aria-label="Editar registro"
                      onClick={() => setEditando(r)}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="paginacao">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={"pagina-btn" + (n === pagina ? " active" : "")}
              onClick={() => carregarRegistros(buscaRegistros, n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {editando && (
        <EditarRegistroModal
          registro={editando}
          colaboradores={colaboradores}
          skus={skus}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            carregarRegistros(buscaRegistros, pagina);
          }}
        />
      )}
    </div>
  );
}
