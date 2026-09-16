import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// O catálogo de produtos é a junção de duas tabelas:
// - app_pp_skus: cadastrados pelo próprio app, editáveis/removíveis.
// - skus: catálogo externo (de outro sistema) — só leitura, "emprestado"
//   aqui. Cada item ganha um id prefixado "ext-" e a origem é inferida
//   do campo "categoria" (contém "import" → importado, senão nacional).
//   Itens externos nunca podem ser removidos por aqui.
// O Supabase limita a 1000 linhas por requisição por padrão — o
// catálogo externo tem mais que isso, então busca em páginas até
// trazer tudo.
async function buscarTodosSkusExternos() {
  const PAGINA = 1000;
  let pagina = 0;
  let todos = [];
  while (true) {
    const { data } = await supabase
      .from("skus")
      .select("id,nome,categoria,nomenclatura")
      .order("nome")
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < PAGINA) break;
    pagina += 1;
  }
  return todos;
}

export function useSkus() {
  const [skus, setSkus] = useState([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const [{ data: proprios }, externos] = await Promise.all([
      supabase.from("app_pp_skus").select("*").order("created_at", { ascending: false }),
      buscarTodosSkusExternos()
    ]);

    const externosMapeados = (externos || []).map((s) => ({
      id: "ext-" + s.id,
      codigo: s.nomenclatura || s.nome,
      nome: s.nome,
      origem: (s.categoria || "").toLowerCase().includes("import") ? "importado" : "nacional",
      externo: true
    }));

    const propriosMapeados = (proprios || []).map((s) => ({ ...s, externo: false }));

    setSkus([...propriosMapeados, ...externosMapeados]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  return { skus, carregando, recarregar: carregar };
}
