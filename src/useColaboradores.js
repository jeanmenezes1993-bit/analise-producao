import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState([]);

  useEffect(() => {
    let cancelado = false;
    supabase
      .from("app_pp_colaboradores")
      .select("id,nome,ativo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (!cancelado) setColaboradores(data || []);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return colaboradores;
}
