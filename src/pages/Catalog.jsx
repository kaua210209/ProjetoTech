// src/pages/Catalog.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, BookOpen, LogOut, LayoutDashboard, X, BookMarked } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Catalog() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [session, setSession] = useState(null);

  // NOVOS ESTADOS PARA O MODAL DE SINOPSE
  const [isSynopsisModalOpen, setIsSynopsisModalOpen] = useState(false);
  const [selectedBookSynopsis, setSelectedBookSynopsis] = useState(null);

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
    const { data, error } = await query.order('titulo', { ascending: true });
    if (!error && data) setBooks(data);
  };

  const filteredBooks = books.filter(book =>
    book.titulo.toLowerCase().includes(search.toLowerCase()) ||
    book.autor.toLowerCase().includes(search.toLowerCase()) ||
    book.codigo.toLowerCase().includes(search.toLowerCase())
  );

  // FUNÇÃO PARA ABRIR O MODAL DE SINOPSE
  const handleOpenSynopsis = (book) => {
    if (book.sinopse && book.sinopse.trim() !== '') {
      setSelectedBookSynopsis(book);
      setIsSynopsisModalOpen(true);
    } else {
      toast.error(`O livro "${book.titulo}" ainda não possui sinopse cadastrada.`);
    }
  };

  return (
    <div className="min-h-screen bg-library-bg pb-12">
      {/* Navbar */}
      <nav className="bg-library-green text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <BookOpen size={24} />
            <span className="font-black text-lg sm:text-xl tracking-tight">Biblioteca Virtual</span>
          </div>
          
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <button 
                  onClick={() => navigate('/admin')} 
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer"
                >
                  <LayoutDashboard size={16} /> <span className="hidden sm:inline">Painel</span>
                </button>
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/40 text-red-200 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer"
                >
                  <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => navigate('/login')} 
                className="font-bold px-4 py-2 rounded-lg text-xs sm:text-sm shadow hover:bg-black transition cursor-pointer"
              >
                Bibliotecário
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Header com pesquisa */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-10 text-center">
        <h1 className="text-2xl sm:text-4xl font-black text-library-green tracking-tight">Explore Nosso Acervo</h1>
        <p className="text-gray-600 text-xs sm:text-sm mt-2 max-w-md mx-auto">Encontre seus livros favoritos, verifique a disponibilidade e solicite a retirada na biblioteca física.</p>
        
        <div className="mt-6 sm:mt-8 max-w-xl mx-auto relative px-2 sm:px-0">
          <Search className="absolute left-5 sm:left-4 top-3.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquise por título, autor ou código do livro..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-library-green focus:border-transparent outline-none transition text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Categorias e Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none justify-start sm:justify-center px-1">
          {['Todos', 'Romance', 'Ficção', 'História', 'Biografia', 'Didático', 'Outros'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${category === cat ? 'bg-library-green text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
          {filteredBooks.map((book) => (
            <div key={book.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
              <div className="h-44 sm:h-56 bg-gray-50 flex items-center justify-center p-4">
                <img 
                  src={book.capa_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=3087&auto=format&fit=crop"} 
                  alt={book.titulo} 
                  className="h-full object-contain drop-shadow-md" 
                />
              </div>
              
              <div className="p-4 flex flex-col flex-1">
                <span className="text-[10px] font-bold text-library-brown uppercase tracking-wider">{book.categoria}</span>
                <h3 className="font-bold text-base sm:text-lg mt-1 text-library-green line-clamp-2 flex-1">{book.titulo}</h3>
                <p className="text-gray-500 text-xs sm:text-sm mb-1">{book.autor}</p>
                <p className="text-[11px] text-gray-400 mb-3">Código: {book.codigo}</p>
                
                {/* ÁREA DE DISPONIBILIDADE E BOTÕES */}
                <div className="mt-auto pt-3 border-t border-gray-50">
                  <div className="mb-2">
                    <span className={`text-xs sm:text-sm font-semibold ${book.quantidade > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {book.quantidade > 0 ? `${book.quantidade} disponíveis` : 'Indisponível'}
                    </span>
                  </div>

                  <div className="flex gap-2 w-full">
                    {/* BOTÃO DA SINOPSE ADICIONADO */}
                    <button 
                      type="button"
                      onClick={() => handleOpenSynopsis(book)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-200 transition cursor-pointer text-center"
                    >
                      Sinopse
                    </button>

                    <button 
                      disabled={book.quantidade === 0}
                      className="flex-1 bg-library-green text-white py-2 rounded-lg text-xs sm:text-sm font-medium disabled:opacity-50 hover:bg-opacity-90 transition cursor-pointer text-center"
                      onClick={() => toast.success(`Solicite o aluguel do livro "${book.titulo}" diretamente ao bibliotecário!`)}
                    >
                      Alugar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12 sm:py-20">
            <p className="text-gray-400 text-base sm:text-lg">Nenhum livro encontrado para esta busca.</p>
          </div>
        )}
      </main>

      {/* COMPONENTE DO MODAL DA SINOPSE (ABRE FLUTUANDO NA TELA) */}
      {isSynopsisModalOpen && selectedBookSynopsis && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all animate-scale-in">
            
            {/* Header do Modal */}
            <div className="bg-library-green p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BookMarked size={20} />
                <h3 className="font-bold text-base truncate max-w-[280px]">Sinopse do Livro</h3>
              </div>
              <button 
                onClick={() => setIsSynopsisModalOpen(false)} 
                className="hover:bg-white/20 p-1 rounded-full transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex gap-4 items-start">
                <img 
                  src={selectedBookSynopsis.capa_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=3087&auto=format&fit=crop"} 
                  alt={selectedBookSynopsis.titulo}
                  className="w-20 h-28 object-contain bg-gray-50 rounded-md border shadow-sm"
                />
                <div>
                  <h4 className="font-black text-gray-800 text-lg leading-tight">{selectedBookSynopsis.titulo}</h4>
                  <p className="text-sm text-gray-500 mt-1">{selectedBookSynopsis.autor}</p>
                  <span className="inline-block mt-2 text-[10px] font-bold bg-green-50 text-library-green px-2 py-0.5 rounded-md border border-green-100 uppercase">
                    {selectedBookSynopsis.categoria}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Resumo da História</h5>
                <p className="text-sm text-gray-600 leading-relaxed text-justify whitespace-pre-line">
                  {selectedBookSynopsis.sinopse}
                </p>
              </div>
            </div>

            {/* Rodapé */}
            <div className="bg-gray-50 p-4 flex justify-end border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsSynopsisModalOpen(false)}
                className="px-5 py-2 bg-library-green text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition cursor-pointer shadow-sm"
              >
                Entendi, Fechar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}