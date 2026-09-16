import React from "react";
import { ORIGENS } from "./origem.js";

function numero(v) {
  return Math.round(Number(v) || 0).toLocaleString("pt-BR");
}

const PERIODO_LABEL = { dia: "Dia", semana: "Semana", mes: "Mês", ano: "Ano" };

// Botão "Exportar Relatório": monta um resumo executivo (só os
// indicadores, sem os gráficos interativos) e aciona a impressão
// nativa do navegador — a pessoa escolhe "Salvar como PDF" no diálogo.
//
// Diferente da versão anterior (um script externo que precisava "ler"
// a tela pra descobrir os números), aqui os dados já são os mesmos
// objetos que alimentam os cards na tela — nada de adivinhação de DOM.
export default function ExportarRelatorio({ data, periodo, dataRef }) {
  function exportar() {
    window.print();
  }

  if (!data) return null;

  const geradoEm = new Date().toLocaleString("pt-BR");
  const { porOrigem, total, maiorVolume, melhorRitmo, ritmoMedio, colaboradoresAtivos } = data;
  const origensComDados = ORIGENS.filter((o) => o.valor !== "consumivel" || porOrigem.consumivel > 0);

  return (
    <>
      <button type="button" className="export-btn no-print" onClick={exportar}>
        ⬇ Exportar Relatório
      </button>

      <div className="print-only">
        <h1>Relatório de Produção</h1>
        <p>
          Período: {PERIODO_LABEL[periodo] || periodo} &nbsp;•&nbsp; Data de referência: {dataRef}
        </p>
        <p>Gerado em: {geradoEm}</p>

        <div className="print-grid">
          {origensComDados.map((o) => (
            <div className="print-kpi" key={o.valor}>
              <div className="print-kpi-label">Produção {o.label}</div>
              <div className="print-kpi-value">{numero(porOrigem[o.valor])}</div>
            </div>
          ))}
          <div className="print-kpi">
            <div className="print-kpi-label">Total do Período</div>
            <div className="print-kpi-value">{numero(total)}</div>
            <div className="print-kpi-extra">unidades processadas</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Maior Volume</div>
            <div className="print-kpi-value" style={{ fontSize: 16 }}>
              {maiorVolume ? maiorVolume.nome : "—"}
            </div>
            {maiorVolume && <div className="print-kpi-extra">{numero(maiorVolume.unidades)} un.</div>}
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Melhor Ritmo</div>
            <div className="print-kpi-value" style={{ fontSize: 16 }}>
              {melhorRitmo ? melhorRitmo.nome : "—"}
            </div>
            {melhorRitmo && <div className="print-kpi-extra">{numero(melhorRitmo.ritmo)} un./h</div>}
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Ritmo Médio</div>
            <div className="print-kpi-value">{numero(ritmoMedio)} un./h</div>
          </div>
          <div className="print-kpi">
            <div className="print-kpi-label">Colaboradores Ativos</div>
            <div className="print-kpi-value">{colaboradoresAtivos}</div>
          </div>
        </div>
      </div>
    </>
  );
}
