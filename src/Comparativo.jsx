import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient.js";
import { useColaboradores } from "./useColaboradores.js";
import { formatMesAno, formatDiaMes } from "./dateRange.js";

function numero(v) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

function mesChave(dataISO) {
  return dataISO.slice(0, 7); // "YYYY-MM"
}

function primeiroEUltimoDiaDoMes(chave) {
  const [ano, mes] = chave.split("-").map(Number);
  const inicio = `${chave}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${chave}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

// O Supabase limita a 1000 linhas por requisição por padrão — busca em
// páginas até trazer tudo (ver mesmo padrão em useSkus.js).
async function buscarTodasDatas() {
  const PAGINA = 1000;
  let pagina = 0;
  let todas = [];
  while (true) {
    const { data } = await supabase
      .from("app_pp_producoes")
      .select("data")
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (!data || data.length === 0) break;
    todas = todas.concat(data);
    if (data.length < PAGINA) break;
    pagina += 1;
  }
  return todas;
}

// Lista os meses que têm algum registro no banco, do mais recente pro
// mais antigo — usada pra popular o filtro de mês.
function useMesesDisponiveis() {
  const [meses, setMeses] = useState([]);

  useEffect(() => {
    let cancelado = false;
    buscarTodasDatas().then((data) => {
      if (cancelado) return;
      const chaves = new Set(data.map((r) => mesChave(r.data)));
      const ordenado = Array.from(chaves).sort((a, b) => (a < b ? 1 : -1));
      setMeses(ordenado);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return meses;
}

async function buscarTodosParaRanking(mesFiltro) {
  const PAGINA = 1000;
  let pagina = 0;
  let todos = [];
  while (true) {
    let query = supabase
      .from("app_pp_producoes")
      .select("colaborador_nome,unidades_efetivas")
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (mesFiltro) {
      const { inicio, fim } = primeiroEUltimoDiaDoMes(mesFiltro);
      query = query.gte("data", inicio).lte("data", fim);
    }
    const { data } = await query;
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < PAGINA) break;
    pagina += 1;
  }
  return todos;
}

function useRanking(mesFiltro) {
  const [ranking, setRanking] = useState(new Map());

  useEffect(() => {
    let cancelado = false;
    buscarTodosParaRanking(mesFiltro).then((data) => {
      if (cancelado) return;
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
  }, [mesFiltro]);

  return ranking;
}

function useStatsColaborador(nome, mesFiltro) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!nome) {
      setStats(null);
      return;
    }
    let cancelado = false;
    let query = supabase
      .from("app_pp_producoes")
      .select("unidades_efetivas,tempo_min,data")
      .eq("colaborador_nome", nome);
    if (mesFiltro) {
      const { inicio, fim } = primeiroEUltimoDiaDoMes(mesFiltro);
      query = query.gte("data", inicio).lte("data", fim);
    }
    query.then(({ data }) => {
      if (cancelado) return;
      const registros = data || [];
      const total = registros.reduce((acc, r) => acc + (Number(r.unidades_efetivas) || 0), 0);
      const tempoTotalMin = registros.reduce((acc, r) => acc + (Number(r.tempo_min) || 0), 0);
      const ritmo = tempoTotalMin > 0 ? total / (tempoTotalMin / 60) : 0;
      const diasSet = new Set(registros.map((r) => r.data));
      const diasTrab = diasSet.size;
      const mediaDia = diasTrab > 0 ? total / diasTrab : 0;
      const tempoMedio = registros.length > 0 ? tempoTotalMin / registros.length : 0;

      let evolucao;
      let melhorMesLabel;

      if (mesFiltro) {
        // Com um mês específico selecionado, mostra a evolução dia a
        // dia dentro daquele mês.
        const porDia = new Map();
        registros.forEach((r) => {
          porDia.set(r.data, (porDia.get(r.data) || 0) + (Number(r.unidades_efetivas) || 0));
        });
        evolucao = Array.from(porDia.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([data, valor]) => ({ mes: formatDiaMes(data), valor }));
        melhorMesLabel = formatMesAno(mesFiltro + "-01");
      } else {
        const porMes = new Map();
        registros.forEach((r) => {
          const chave = mesChave(r.data);
          porMes.set(chave, (porMes.get(chave) || 0) + (Number(r.unidades_efetivas) || 0));
        });
        evolucao = Array.from(porMes.entries())
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
        melhorMesLabel = melhorMes ? formatMesAno(melhorMes + "-01") : "—";
      }

      setStats({
        total,
        ritmo,
        mediaDia,
        tempoMedio,
        registros: registros.length,
        diasTrab,
        melhorMes: melhorMesLabel,
        evolucaoLabel: mesFiltro ? "Evolução diária" : "Evolução mensal",
        evolucao
      });
    });
    return () => {
      cancelado = true;
    };
  }, [nome, mesFiltro]);

  return stats;
}

function PainelColaborador({ nome, cor, ranking, mesFiltro }) {
  const stats = useStatsColaborador(nome, mesFiltro);
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
        <div><strong>{stats.melhorMes}</strong><span>{mesFiltro ? "mês filtrado" : "melhor mês"}</span></div>
      </div>

      <div className="chart-card-title" style={{ marginTop: 16 }}>{stats.evolucaoLabel}</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={stats.evolucao}>
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
  const mesesDisponiveis = useMesesDisponiveis();
  const [mesFiltro, setMesFiltro] = useState("");
  const ranking = useRanking(mesFiltro);
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
        <div className="form-field" style={{ maxWidth: 200 }}>
          <label>Mês</label>
          <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}>
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map((chave) => (
              <option key={chave} value={chave}>{formatMesAno(chave + "-01")}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="charts-row">
        <PainelColaborador nome={nomeA} cor="#16C2C2" ranking={ranking} mesFiltro={mesFiltro} />
        <PainelColaborador nome={nomeB} cor="#F5A623" ranking={ranking} mesFiltro={mesFiltro} />
      </div>
    </div>
  );
}
