import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient.js";
import { useColaboradores } from "./useColaboradores.js";
import { formatMesAno } from "./dateRange.js";

function numero(v) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

function mesChave(dataISO) {
  return dataISO.slice(0, 7); // "YYYY-MM"
}

function useRanking() {
  const [ranking, setRanking] = useState(new Map());

  useEffect(() => {
    let cancelado = false;
    supabase
      .from("app_pp_producoes")
      .select("colaborador_nome,unidades_efetivas")
      .then(({ data }) => {
        if (cancelado || !data) return;
        const totais = new Map();
        data.forEach((r) => {
          const nome = r.colaborador_nome;
          totais.set(nome, (totais.get(nome) || 0) + (Number(r.unidades_efetivas) || 0));
        });
        const ordenado = Array.from(totais.entries()).sort((a, b) => b[1] - a[1]);
        const posicoes = new Map();
        ordenado.forEach(([nome], i) => posicoes.set(nome, i + 1));
        setRanking(posicoes);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return ranking;
}

function useStatsColaborador(nome) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!nome) {
      setStats(null);
      return;
    }
    let cancelado = false;
    supabase
      .from("app_pp_producoes")
      .select("unidades_efetivas,tempo_min,data")
      .eq("colaborador_nome", nome)
      .then(({ data }) => {
        if (cancelado) return;
        const registros = data || [];
        const total = registros.reduce((acc, r) => acc + (Number(r.unidades_efetivas) || 0), 0);
        const tempoTotalMin = registros.reduce((acc, r) => acc + (Number(r.tempo_min) || 0), 0);
        const ritmo = tempoTotalMin > 0 ? total / (tempoTotalMin / 60) : 0;
        const diasSet = new Set(registros.map((r) => r.data));
        const diasTrab = diasSet.size;
        const mediaDia = diasTrab > 0 ? total / diasTrab : 0;
        const tempoMedio = registros.length > 0 ? tempoTotalMin / registros.length : 0;

        const porMes = new Map();
        registros.forEach((r) => {
          const chave = mesChave(r.data);
          porMes.set(chave, (porMes.get(chave) || 0) + (Number(r.unidades_efetivas) || 0));
        });
        const evolucaoMensal = Array.from(porMes.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .slice(-6)
          .map(([chave, valor]) => ({ mes: formatMesAno(chave + "-01"), valor }));

        let melhorMes = null;
        let melhorMesValor = -1;
        porMes.forEach((valor, chave) => {
          if (valor > melhorMesValor) {
            melhorMesValor = valor;
            melhorMes = chave;
          }
        });

        setStats({
          total,
          ritmo,
          mediaDia,
          tempoMedio,
          registros: registros.length,
          diasTrab,
          melhorMes: melhorMes ? formatMesAno(melhorMes + "-01") : "—",
          evolucaoMensal
        });
      });
    return () => {
      cancelado = true;
    };
  }, [nome]);

  return stats;
}

function PainelColaborador({ nome, cor, ranking }) {
  const stats = useStatsColaborador(nome);
  const posicao = ranking.get(nome);

  if (!nome) {
    return <div className="chart-card comparativo-painel state-msg">Selecione um colaborador.</div>;
  }
  if (!stats) {
    return <div className="chart-card comparativo-painel state-msg">Carregando…</div>;
  }

  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="chart-card comparativo-painel" style={{ borderTop: `3px solid ${cor}` }}>
      <div className="comparativo-header">
        <div className="comparativo-avatar" style={{ background: cor }}>{iniciais}</div>
        <div>
          <div style={{ fontWeight: 800 }}>{nome}</div>
          {posicao && <div className="ranking-tag">🏅 {posicao}º no ranking</div>}
        </div>
      </div>

      <div className="comparativo-stats">
        <div className="comparativo-stat">
          <div className="card-label">Total produzido</div>
          <div className="card-value" style={{ fontSize: 22, color: cor }}>{numero(stats.total)}</div>
          <div className="card-sub">unidades</div>
        </div>
        <div className="comparativo-stat">
          <div className="card-label">Ritmo</div>
          <div className="card-value" style={{ fontSize: 22, color: cor }}>{numero(stats.ritmo)}</div>
          <div className="card-sub">un./hora</div>
        </div>
        <div className="comparativo-stat">
          <div className="card-label">Média/dia</div>
          <div className="card-value" style={{ fontSize: 22, color: cor }}>{numero(stats.mediaDia)}</div>
          <div className="card-sub">unidades</div>
        </div>
        <div className="comparativo-stat">
          <div className="card-label">Tempo médio</div>
          <div className="card-value" style={{ fontSize: 22, color: cor }}>{numero(stats.tempoMedio)}</div>
          <div className="card-sub">min/registro</div>
        </div>
      </div>

      <div className="comparativo-resumo">
        <div><strong>{stats.registros}</strong><span>registros</span></div>
        <div><strong>{stats.diasTrab}</strong><span>dias trab.</span></div>
        <div><strong>{stats.melhorMes}</strong><span>melhor mês</span></div>
      </div>

      <div className="chart-card-title" style={{ marginTop: 16 }}>Evolução mensal</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={stats.evolucaoMensal}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="mes" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v) => numero(v)} />
          <Bar dataKey="valor" fill={cor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Comparativo() {
  const colaboradores = useColaboradores();
  const ranking = useRanking();
  const [nomeA, setNomeA] = useState("");
  const [nomeB, setNomeB] = useState("");

  return (
    <div>
      <div className="page-eyebrow">Análise Produção Processamento</div>
      <h1 className="page-title">Comparativo de Colaboradores</h1>

      <div className="comparativo-selects">
        <div className="form-field" style={{ flex: 1 }}>
          <label>Colaborador A</label>
          <select value={nomeA} onChange={(e) => setNomeA(e.target.value)}>
            <option value="">Selecione...</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div className="comparativo-vs">VS</div>
        <div className="form-field" style={{ flex: 1 }}>
          <label>Colaborador B</label>
          <select value={nomeB} onChange={(e) => setNomeB(e.target.value)}>
            <option value="">Selecione...</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="charts-row">
        <PainelColaborador nome={nomeA} cor="#16C2C2" ranking={ranking} />
        <PainelColaborador nome={nomeB} cor="#F5A623" ranking={ranking} />
      </div>
    </div>
  );
}
