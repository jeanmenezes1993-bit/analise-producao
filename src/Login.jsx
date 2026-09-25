import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

// Login real via Supabase Auth. Como o Supabase exige um e-mail (não
// um "usuário" livre), usamos um e-mail fixo por trás — a pessoa
// continua digitando "Usuário"/"Senha" como sempre, sem perceber a
// troca. O campo Usuário só serve de confirmação extra (precisa bater
// com USUARIO_VALIDO); quem realmente autentica é a senha, validada
// pelo Supabase — e é isso que trava o RLS do banco pra quem não
// estiver logado.
const USUARIO_VALIDO = import.meta.env.VITE_LOGIN_USER || "";
const EMAIL_AUTH = import.meta.env.VITE_LOGIN_EMAIL || "";

export default function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const [entrando, setEntrando] = useState(false);

  async function tentarEntrar() {
    if (entrando) return;
    if (usuario.trim() !== USUARIO_VALIDO) {
      setErro(true);
      return;
    }
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: EMAIL_AUTH,
      password: senha
    });
    setEntrando(false);

    if (error) {
      setErro(true);
      return;
    }
    setErro(false);
    onEntrar();
  }

  function aoDigitar(setter) {
    return (e) => {
      setter(e.target.value);
      setErro(false);
    };
  }

  function aoTeclar(e) {
    if (e.key === "Enter") tentarEntrar();
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <div className="login-title">Análise Produção</div>
          <div className="login-subtitle">Processamento</div>
        </div>
        <div className="login-body">
          <p>Informe suas credenciais para acessar o sistema.</p>

          <label>Usuário</label>
          <input
            type="text"
            autoFocus
            className={erro ? "login-input erro" : "login-input"}
            value={usuario}
            onChange={aoDigitar(setUsuario)}
            onKeyDown={aoTeclar}
          />

          <label>Senha</label>
          <input
            type="password"
            className={erro ? "login-input erro" : "login-input"}
            value={senha}
            onChange={aoDigitar(setSenha)}
            onKeyDown={aoTeclar}
          />

          {erro && <div className="login-erro">Usuário ou senha incorretos.</div>}

          <button type="button" className="login-btn" onClick={tentarEntrar} disabled={entrando}>
            {entrando ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
