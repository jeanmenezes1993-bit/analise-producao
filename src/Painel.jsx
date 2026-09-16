import React, { useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from "recharts";
import { usePainelData } from "./usePainelData.js";
import { ORIGENS, origemCor } from "./origem.js";
import ExportarRelatorio from "./ExportarRelatorio.jsx";

const LINHA_CORES = ["#16C2C2", "#F5A623", "#8B5CF6", "#3B82F6", "#22C55E", "#EAB308"];
const PERIODOS = [
  { valor: "dia", label: "Dia" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" }
];

function numero(v) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

function pct(v, total) {
  if (!total) return "0%";
  return Math.round((v / total) * 100) + "%";
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Painel() {
  const [periodo, setPeriodo] = useState("dia");
  const [dataRef, setDataRef] = useState(hojeISO());
  const [tabMapa, setTabMapa] = useState("ideal");
  const { loading, error, data } = usePainelData(periodo, dataRef);

  return (
    <div>
      <ExportarRelatorio data={data} periodo={periodo} dataRef={dataRef} />

      <div className="page-eyebrow no-print">Análise Produção Processamento</div>
      <h1 className="page-title no-print">Painel de Produção</h1>

      <div className="filters-bar no-print">
        <div className="period-group">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              className={"period-btn" + (periodo === p.valor ? " active" : "")}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="date-input"
          value={dataRef}
          onChange={(e) => setDataRef(e.target.value)}
        />
      </div>

      {loading && <div className="state-msg no-print">Carregando dados do período…</div>}
      {error && <div className="state-msg no-print">Erro ao carregar: {error}</div>}

      {data && (
        <div className="no-print">
          <CardsResumo data={data} />
          <CardsDestaque data={data} />

          <div className="section-title">Composição e Evolução</div>
          <div className="charts-row">
            <ComposicaoChart data={data} />
            <EvolucaoChart data={data} periodo={periodo} />
          </div>

          <div className="section-title">Desempenho por Colaborador</div>
          <div className="charts-row">
            <EvolucaoIndividualChart data={data} />
            <RitmoChart data={data} />
          </div>

          <div className="section-title">Distribuição Operacional</div>
          <div className="charts-row">
            <ProcessoChart data={data} />
            <MapaDesempenho data={data} tab={tabMapa} setTab={setTabMapa} />
          </div>

          <div className="section-title">Tendência e Horários</div>
          <div className="charts-row">
            <ComparativoChart data={data} />
            <HorarioChart data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

function CardsResumo({ data }) {
  const { porOrigem, total } = data;
  const origensComDados = ORIGENS.filter(
    (o) => o.valor !== "consumivel" || porOrigem.consumivel > 0
  );
  return (
    <div className={"cards-row" + (origensComDados.length > 2 ? " cols-4" : "")}>
      {origensComDados.map((o) => (
        <div className="card" key={o.valor}>
          <div className="card-label">
            <span style={{ color: o.cor }}>●</span> Produção {o.label}
          </div>
          <div className="card-value">{numero(porOrigem[o.valor])}</div>
          <div className="card-progress">
            <div
              className="card-progress-fill"
              style={{ width: pct(porOrigem[o.valor], total), background: o.cor }}
            />
          </div>
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: o.cor, marginTop: 4 }}>
            {pct(porOrigem[o.valor], total)}
          </div>
        </div>
      ))}
      <div className="card card-total">
        <div className="card-label">Total do Período</div>
        <div className="card-value">{numero(total)}</div>
        <div className="card-sub">unidades processadas</div>
      </div>
    </div>
  );
}

function CardsDestaque({ data }) {
  const { maiorVolume, melhorRitmo, ritmoMedio, colaboradoresAtivos } = data;
  return (
    <div className="cards-row cols-4">
      <div className="card">
        <div className="card-label">🏆 Maior Volume</div>
        <div className="card-value" style={{ fontSize: 18 }}>
          {maiorVolume ? maiorVolume.nome : "—"}
        </div>
        <div className="card-sub">{maiorVolume ? numero(maiorVolume.unidades) + " un." : ""}</div>
      </div>
      <div className="card">
        <div className="card-label">🕐 Melhor Ritmo</div>
        <div className="card-value" style={{ fontSize: 18 }}>
          {melhorRitmo ? melhorRitmo.nome : "—"}
        </div>
        <div className="card-sub">{melhorRitmo ? numero(melhorRitmo.ritmo) + " un./h" : ""}</div>
      </div>
      <div className="card">
        <div className="card-label">📈 Ritmo Médio</div>
        <div className="card-value">{numero(ritmoMedio)} un./h</div>
        <div className="card-sub">no período selecionado</div>
      </div>
      <div className="card">
        <div className="card-label">👥 Colaboradores Ativos</div>
        <div className="card-value">{colaboradoresAtivos}</div>
        <div className="card-sub">com registro no período</div>
      </div>
    </div>
  );
}

function ComposicaoChart({ data }) {
  const { porOrigem } = data;
  const pieData = ORIGENS
    .filter((o) => porOrigem[o.valor] > 0)
    .map((o) => ({ name: o.label, value: porOrigem[o.valor], cor: o.cor }));

  return (
    <div className="chart-card">
      <div className="chart-card-title">Nacional × Importado{porOrigem.consumivel > 0 ? " × Consumível" : ""}</div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={pieData} dataKey="value" innerRadius={70} outerRadius={110} paddingAngle={2}>
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.cor} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => numero(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvolucaoChart({ data, periodo }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">Evolução — {periodo}</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data.evolucao}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Line type="monotone" dataKey="valor" stroke="#16C2C2" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvolucaoIndividualChart({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">Evolução Individual</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.evolucaoIndividual}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="data" fontSize={11} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Legend />
          {data.evolucaoIndividualColaboradores.map((nome, i) => (
            <Line
              key={nome}
              type="monotone"
              dataKey={nome}
              stroke={LINHA_CORES[i % LINHA_CORES.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RitmoChart({ data }) {
  const top = data.ritmoPorColaborador.slice(0, 10);
  return (
    <div className="chart-card">
      <div className="chart-card-title">Ritmo (unidades por hora)</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={12} />
          <YAxis type="category" dataKey="nome" width={140} fontSize={11} />
          <Tooltip formatter={(v) => numero(v) + " un./h"} />
          <Bar dataKey="ritmo" fill="#16C2C2" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProcessoChart({ data }) {
  const chartData = Object.entries(data.porProcesso).map(([nome, valor]) => ({ nome, valor }));
  return (
    <div className="chart-card">
      <div className="chart-card-title">Produção por Processo</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" fontSize={12} />
          <YAxis type="category" dataKey="nome" width={90} fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Bar dataKey="valor" fill="#16C2C2" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CATEGORIA_COR = { ideal: "#22C55E", medio: "#F5A623", abaixo: "#E5484D" };
const CATEGORIA_LABEL = { ideal: "Ideal", medio: "Médio", abaixo: "Abaixo" };

function MapaDesempenho({ data, tab, setTab }) {
  const filtrado = data.mapaDesempenho.filter((c) => c.categoria === tab);
  return (
    <div className="chart-card">
      <div className="chart-card-title">Mapa de Desempenho</div>
      <div className="tabs">
        {["ideal", "medio", "abaixo"].map((cat) => (
          <button
            key={cat}
            type="button"
            className={"tab-btn" + (tab === cat ? " active" : "")}
            style={tab === cat ? { background: CATEGORIA_COR[cat] } : {}}
            onClick={() => setTab(cat)}
          >
            {CATEGORIA_LABEL[cat]}
          </button>
        ))}
      </div>
      {filtrado.length === 0 ? (
        <div className="state-msg" style={{ padding: 20 }}>Sem dados no período selecionado.</div>
      ) : (
        <div className="mapa-grid">
          {filtrado.map((c) => (
            <div className="mapa-item" key={c.nome}>
              <div className="mapa-item-nome" title={c.nome}>{c.nome}</div>
              <div className="mapa-item-valor">{numero(c.unidades)}</div>
              <div
                className="mapa-item-bar"
                style={{ background: CATEGORIA_COR[c.categoria] }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparativoChart({ data }) {
  const { atual, anterior, variacaoPct } = data.comparativo;
  const chartData = [
    { nome: "Período anterior", valor: anterior },
    { nome: "Este período", valor: atual }
  ];
  const subiu = variacaoPct >= 0;
  return (
    <div className="chart-card">
      <div className="chart-card-title" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Comparativo — período atual vs anterior</span>
        <span style={{ color: subiu ? "#22C55E" : "#E5484D" }}>
          {subiu ? "▲" : "▼"} {Math.abs(Math.round(variacaoPct * 10) / 10)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="nome" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Bar dataKey="valor" fill="#16C2C2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorarioChart({ data }) {
  return (
    <div className="chart-card">
      <div className="chart-card-title">Distribuição por Horário</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.distribuicaoPorHorario}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Bar dataKey="valor" fill="#16C2C2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
