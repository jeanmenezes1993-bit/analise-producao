import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { getDateRange, formatDiaMes, formatMesAno } from "./dateRange.js";

function ritmo(unidades, tempoMin) {
  if (!tempoMin) return 0;
  return unidades / (tempoMin / 60);
}

function classificarDesempenho(valor, min, max) {
  if (max === min) return "ideal";
  const pos = (valor - min) / (max - min);
  if (pos >= 0.66) return "ideal";
  if (pos >= 0.33) return "medio";
  return "abaixo";
}

function shiftRange(periodo, inicio, fim) {
  const di = new Date(inicio);
  const df = new Date(fim);
  const diffDias = Math.round((df - di) / 86400000) + 1;
  const novoFim = new Date(di);
  novoFim.setDate(di.getDate() - 1);
  const novoInicio = new Date(novoFim);
  novoInicio.setDate(novoFim.getDate() - (diffDias - 1));
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { inicio: toISO(novoInicio), fim: toISO(novoFim) };
}

const FAIXAS_HORARIO = [
  { label: "08–10h", inicio: 8, fim: 10 },
  { label: "10–12h", inicio: 10, fim: 12 },
  { label: "12–14h", inicio: 12, fim: 14 },
  { label: "14–16h", inicio: 14, fim: 16 },
  { label: "16–18h", inicio: 16, fim: 18 },
  { label: "18–20h", inicio: 18, fim: 20 }
];

export function usePainelData(periodo, dataRefISO) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { inicio, fim } = getDateRange(periodo, dataRefISO);
      const anterior = shiftRange(periodo, inicio, fim);

      const [{ data: regs, error: err1 }, { data: regsAnterior, error: err2 }] =
        await Promise.all([
          supabase
            .from("app_pp_producoes")
            .select(
              "colaborador_nome,origem,quantidade,unidades_efetivas,etiquetagem,triagem,embalar,tempo_min,hora_inicio,data"
            )
            .gte("data", inicio)
            .lte("data", fim),
          supabase
            .from("app_pp_producoes")
            .select("unidades_efetivas")
            .gte("data", anterior.inicio)
            .lte("data", anterior.fim)
        ]);

      if (cancelado) return;

      if (err1 || err2) {
        setState({ loading: false, error: (err1 || err2).message, data: null });
        return;
      }

      const registros = regs || [];

      // --- Cards de origem -------------------------------------------
      const porOrigem = { nacional: 0, importado: 0, consumivel: 0 };
      registros.forEach((r) => {
        const chave = porOrigem[r.origem] !== undefined ? r.origem : "nacional";
        porOrigem[chave] += Number(r.unidades_efetivas) || 0;
      });
      const total = porOrigem.nacional + porOrigem.importado + porOrigem.consumivel;

      // --- Por colaborador ---------------------------------------------
      const porColaborador = new Map();
      registros.forEach((r) => {
        const nome = r.colaborador_nome || "Sem nome";
        if (!porColaborador.has(nome)) {
          porColaborador.set(nome, { unidades: 0, tempoMin: 0 });
        }
        const c = porColaborador.get(nome);
        c.unidades += Number(r.unidades_efetivas) || 0;
        c.tempoMin += Number(r.tempo_min) || 0;
      });

      const colaboradores = Array.from(porColaborador.entries()).map(
        ([nome, v]) => ({
          nome,
          unidades: v.unidades,
          ritmo: ritmo(v.unidades, v.tempoMin)
        })
      );

      const maiorVolume = colaboradores.slice().sort((a, b) => b.unidades - a.unidades)[0];
      const melhorRitmo = colaboradores.slice().sort((a, b) => b.ritmo - a.ritmo)[0];
      const somaTempoMin = registros.reduce((acc, r) => acc + (Number(r.tempo_min) || 0), 0);
      const ritmoMedio = ritmo(total, somaTempoMin);
      const colaboradoresAtivos = colaboradores.length;

      // --- Evolução (por dia) ------------------------------------------
      const porDia = new Map();
      registros.forEach((r) => {
        porDia.set(r.data, (porDia.get(r.data) || 0) + (Number(r.unidades_efetivas) || 0));
      });
      const evolucao = Array.from(porDia.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([data, valor]) => ({
          data,
          label: periodo === "ano" ? formatMesAno(data) : formatDiaMes(data),
          valor
        }));

      // --- Evolução individual (top 6 colaboradores) ---------------------
      const top6 = colaboradores
        .slice()
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 6)
        .map((c) => c.nome);

      const evolucaoIndividualPorDia = new Map();
      registros.forEach((r) => {
        const nome = r.colaborador_nome || "Sem nome";
        if (!top6.includes(nome)) return;
        if (!evolucaoIndividualPorDia.has(r.data)) {
          evolucaoIndividualPorDia.set(r.data, { data: r.data });
        }
        const linha = evolucaoIndividualPorDia.get(r.data);
        linha[nome] = (linha[nome] || 0) + (Number(r.unidades_efetivas) || 0);
      });
      const evolucaoIndividual = Array.from(evolucaoIndividualPorDia.values()).sort((a, b) =>
        a.data < b.data ? -1 : 1
      );

      // --- Ritmo por colaborador (bar chart) -----------------------------
      const ritmoPorColaborador = colaboradores
        .slice()
        .sort((a, b) => b.ritmo - a.ritmo);

      // --- Produção por processo -----------------------------------------
      const porProcesso = { Etiquetagem: 0, Triagem: 0, Embalar: 0 };
      registros.forEach((r) => {
        const qtd = Number(r.quantidade) || 0;
        if (r.etiquetagem) porProcesso.Etiquetagem += qtd;
        if (r.triagem) porProcesso.Triagem += qtd;
        if (r.embalar) porProcesso.Embalar += qtd;
      });

      // --- Mapa de desempenho (Ideal/Médio/Abaixo) -----------------------
      const valores = colaboradores.map((c) => c.unidades);
      const min = valores.length ? Math.min(...valores) : 0;
      const max = valores.length ? Math.max(...valores) : 0;
      const mapaDesempenho = colaboradores
        .slice()
        .sort((a, b) => b.unidades - a.unidades)
        .map((c) => ({
          ...c,
          categoria: classificarDesempenho(c.unidades, min, max)
        }));

      // --- Comparativo período atual vs anterior -------------------------
      const totalAnterior = (regsAnterior || []).reduce(
        (acc, r) => acc + (Number(r.unidades_efetivas) || 0),
        0
      );
      const variacaoPct =
        totalAnterior > 0
          ? ((total - totalAnterior) / totalAnterior) * 100
          : total > 0
          ? 100
          : 0;

      // --- Distribuição por horário ----------------------------------------
      const distribuicaoPorHorario = FAIXAS_HORARIO.map((faixa) => {
        const soma = registros.reduce((acc, r) => {
          if (!r.hora_inicio) return acc;
          const hora = Number(String(r.hora_inicio).split(":")[0]);
          if (hora >= faixa.inicio && hora < faixa.fim) {
            return acc + (Number(r.unidades_efetivas) || 0);
          }
          return acc;
        }, 0);
        return { label: faixa.label, valor: soma };
      });

      setState({
        loading: false,
        error: null,
        data: {
          porOrigem,
          total,
          maiorVolume,
          melhorRitmo,
          ritmoMedio,
          colaboradoresAtivos,
          evolucao,
          evolucaoIndividualColaboradores: top6,
          evolucaoIndividual,
          ritmoPorColaborador,
          porProcesso,
          mapaDesempenho,
          comparativo: { atual: total, anterior: totalAnterior, variacaoPct },
          distribuicaoPorHorario
        }
      });
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [periodo, dataRefISO]);

  return state;
}
