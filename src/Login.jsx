import React, { useState } from "react";

// Mesma checagem do sistema anterior: usuário/senha fixos, só no
// front-end (sem Supabase Auth) — não é uma barreira de segurança de
// verdade (o RLS do banco já está aberto pra qualquer um com a chave
// pública), é só o "portão" social que a equipe já está acostumada a
// usar. As credenciais ficam em variáveis de ambiente (.env, fora do
// git) em vez de escritas direto no código — veja .env.example.
const USUARIO_VALIDO = import.meta.env.VITE_LOGIN_USER || "";
const SENHA_VALIDA = import.meta.env.VITE_LOGIN_PASS || "";

export default function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);

  function tentarEntrar() {
    if (usuario.trim() === USUARIO_VALIDO && senha === SENHA_VALIDA) {
      setErro(false);
      onEntrar();
    } else {
      setErro(true);
    }
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

          <button type="button" className="login-btn" onClick={tentarEntrar}>
            ENTRAR
          </button>
        </div>
      </div>
    </div>
  );
}
