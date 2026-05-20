// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Chama a autenticação do Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error('Erro ao fazer login: Verifique suas credenciais.');
    } else {
      toast.success('Login realizado com sucesso!');
      navigate('/admin'); // Redireciona para o painel do bibliotecário
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-library-bg p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 border border-gray-100">
        
        {/* Cabeçalho do Login */}
        <div className="flex flex-col items-center justify-center mb-8 text-library-green">
          <h2 className="text-2xl font-bold text-gray-800">BiblioTech Admin</h2>
          <p className="text-sm text-gray-500">Acesso exclusivo para bibliotecários</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green focus:border-transparent outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@escola.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green focus:border-transparent outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-library-brown text-white py-2 rounded-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Link de Retorno */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-library-green hover:underline font-medium">
            &larr; Voltar para o catálogo
          </a>
        </div>
      </div>
    </div>
  );
}