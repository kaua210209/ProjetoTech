// src/pages/Catalog.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, BookOpen, LogOut, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Catalog() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [session, setSession] = useState(null);

  useEffect(() => {
    fetchBooks();
    checkSession();
  }, [category]);

  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erro ao sair da conta.');
    } else {
      toast.success('Você saiu da conta!');
      setSession(null);
      navigate('/');
    }
  };

  const fetchBooks = async () => {
    let query = supabase.from('books').select('*');
    if (category !== 'Todos') {
      query = query.eq('categoria', category);
    }
    const { data, error } = await query;
    if (error) toast.error('Erro ao buscar livros');
    else setBooks(data);
  };

  const filteredBooks = books.filter(b => 
    b.titulo.toLowerCase().includes(search.toLowerCase()) || 
    b.autor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* HEADER RESPONSIVO */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-library-green">
          <h1 className="text-2xl sm:text-3xl font-bold">BiblioTech</h1>
        </div>
        
        {session ? (
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-gray-600 w-full text-center sm:w-auto sm:text-left">
              Logado como: <strong className="text-library-green">{session.user.email}</strong>
            </span>
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 text-library-green hover:underline font-semibold text-xs sm:text-sm bg-library-light-green px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <LayoutDashboard size={14} /> Painel Admin
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold text-xs sm:text-sm cursor-pointer"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        ) : (
          <button 
            onClick={() => navigate('/login')}
            className="text-library-brown hover:underline font-semibold text-sm sm:text-base cursor-pointer"
          >
            Área do Bibliotecário
          </button>
        )}
      </header>

      {/* FILTROS RESPONSIVOS (Empilham no telemóvel, ficam lado a lado no PC) */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título ou autor..." 
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-library-green"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white outline-none w-full sm:w-48 cursor-pointer"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {['Todos', 'Romance', 'Drama', 'Suspense', 'Ficção Científica', 'Terror', 'Fantasia', 'Biografia', 'Outros'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* GRID DE LIVROS (1 coluna no telemóvel, 2 em tablets, 3 ou 4 no PC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredBooks.map((book) => (
          <div key={book.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">
            <div className="w-full h-56 sm:h-64 bg-gray-100 flex items-center justify-center p-4">
                <img 
                    src={book.capa_url || 'https://via.placeholder.com/150x200?text=Sem+Capa'} 
                    alt={`Capa`} 
                    className="max-h-full max-w-full object-contain drop-shadow-md" 
                />
            </div>
            
            <div className="p-4 flex flex-col flex-1">
              <span className="text-[10px] font-bold text-library-brown uppercase tracking-wider">{book.categoria}</span>
              <h3 className="font-bold text-base sm:text-lg mt-1 text-library-green line-clamp-2 flex-1">{book.titulo}</h3>
              <p className="text-gray-500 text-xs sm:text-sm mb-1">{book.autor}</p>
              <p className="text-[11px] text-gray-400 mb-3">Código: {book.codigo}</p>
              
              <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-50">
                <span className={`text-xs sm:text-sm font-semibold ${book.quantidade > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {book.quantidade > 0 ? `${book.quantidade} disponíveis` : 'Indisponível'}
                </span>
                <button 
                  disabled={book.quantidade === 0}
                  className="bg-library-green text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium disabled:opacity-50 hover:bg-opacity-90 transition cursor-pointer"
                  onClick={() => toast.success(`Solicite o aluguel com o código: ${book.codigo}`, { duration: 5000 })}
                >
                  Alugar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}