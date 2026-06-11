// src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Book, Users, Trash2, Pencil, Plus, Minus, MessageCircle, Menu, X, CalendarCheck, CalendarX, Clock, BarChart3, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import AddBookModal from '../components/AddBookModal';
import AddRentalModal from '../components/AddRentalModal';
import EditBookModal from '../components/EditBookModal';
import Barcode from 'react-barcode';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('alugueis'); // 'alugueis' ou 'livros'
    const [statusFilter, setStatusFilter] = useState('no_prazo'); // Novo filtro: 'no_prazo', 'atrasados', 'devolvidos'

    const [rentals, setRentals] = useState([]);
    const [books, setBooks] = useState([]);
    const [stats, setStats] = useState({ total: 0, ativos: 0, atrasados: 0, livrosTotal: 0 });

    // Controles de visibilidade dos Modais e Menus
    const [isMenuMobileOpen, setIsMenuMobileOpen] = useState(false);
    const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
    const [isAddRentalModalOpen, setIsAddRentalModalOpen] = useState(false);
    const [isEditBookModalOpen, setIsEditBookModalOpen] = useState(false);
    const [selectedBookForEdit, setSelectedBookForEdit] = useState(null);
    const [barcodeModal, setBarcodeModal] = useState({ isOpen: false, book: null });

    useEffect(() => {
        checkUser();
        fetchRentals();
        fetchBooks();
    }, []);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) navigate('/login');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const fetchRentals = async () => {
        try {
            // 1. Busca os dados dos aluguéis do banco de dados
            const { data: rentalsData, error: rentalsError } = await supabase
                .from('rentals')
                .select('*, books(titulo, codigo, categoria)')
                .order('created_at', { ascending: false });

            if (rentalsError) throw rentalsError;
            setRentals(rentalsData);

            // 2. Busca os dados atualizados dos livros diretamente da tabela 'books'
            const { data: booksData, error: booksError } = await supabase
                .from('books')
                .select('quantidade');

            if (booksError) throw booksError;

            // 3. Força a conversão para número inteiro (evita problemas se o banco retornar texto ou nulo)
            const totalLivrosEstoque = booksData.reduce((acc, book) => {
                const qtd = parseInt(book.quantidade, 10);
                return acc + (isNaN(qtd) ? 0 : qtd);
            }, 0);

            // 4. Calcula as métricas de prazos dos aluguéis ativos e atrasados
            const hoje = new Date();
            const totalAtivos = rentalsData.filter(r => r.status === 'Ativo').length;
            const totalAtrasados = rentalsData.filter(r => r.status === 'Ativo' && new Date(r.data_devolucao + 'T23:59:59') < hoje).length;

            // 5. Atualiza o estado unificado com os valores exatos e convertidos
            setStats({
                total: rentalsData.length,
                ativos: totalAtivos - totalAtrasados,
                atrasados: totalAtrasados,
                livrosTotal: totalLivrosEstoque
            });

        } catch (error) {
            console.error("Erro detalhado no painel:", error);
            toast.error('Erro ao carregar dados do painel');
        }
    };

    const fetchBooks = async () => {
        const { data, error } = await supabase.from('books').select('*').order('titulo', { ascending: true });
        if (error) toast.error('Erro ao carregar livros');
        else setBooks(data);
    };

    // BOTÃO DEVOLVER CORRIGIDO: Executa e recarrega os dados imediatamente
    const confirmarDevolucao = async (rentalId, bookId) => {
        try {
            const hoje = new Date().toISOString().split('T')[0];

            // 1. Atualiza o status do aluguel
            const { error: rentalError } = await supabase
                .from('rentals')
                .update({ status: 'Devolvido', data_devolucao_real: hoje })
                .eq('id', rentalId);

            if (rentalError) throw rentalError;

            // 2. Incrementa o estoque do livro (+1)
            const { data: bookData, error: fetchError } = await supabase
                .from('books')
                .select('quantidade')
                .eq('id', bookId)
                .single();

            if (fetchError) throw fetchError;

            const { error: bookUpdateError } = await supabase
                .from('books')
                .update({ quantidade: bookData.quantidade + 1 })
                .eq('id', bookId);

            if (bookUpdateError) throw bookUpdateError;

            toast.success('Devolução registrada com sucesso!');

            // Recarrega as tabelas para sumir o item da lista ativa
            await fetchRentals();
            await fetchBooks();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao confirmar devolução.');
        }
    };

    const handleExcluirLivro = async (id, titulo) => {
        if (!confirm(`Excluir permanentemente "${titulo}"?`)) return;
        const { error } = await supabase.from('books').delete().eq('id', id);
        if (error) toast.error('Livro possui histórico ativo.');
        else { toast.success('Removido!'); fetchBooks(); }
    };

    const handleAlterarEstoque = async (id, quantidadeAtual, mudanca) => {
        const novaQuantidade = quantidadeAtual + mudanca;
        if (novaQuantidade < 0) return;
        await supabase.from('books').update({ quantidade: novaQuantidade }).eq('id', id);
        fetchBooks();
    };

    const abrirEditarLivro = (book) => {
        setSelectedBookForEdit(book);
        setIsEditBookModalOpen(true);
    };

    const enviarReciboWhatsApp = (rental) => {
        const mensagem = `Olá, *${rental.aluno_nome}*! 📚\nLembramos do seu aluguel do livro: *${rental.books?.titulo}*.\n⚠️ Prazo limite para devolução: *${formatarData(rental.data_devolucao)}*.\nObrigado!`;
        let numeroLimpo = rental.aluno_whatsapp ? rental.aluno_whatsapp.replace(/\D/g, '') : '';
        if (numeroLimpo && numeroLimpo.length <= 11 && !numeroLimpo.startsWith('55')) numeroLimpo = '55' + numeroLimpo;
        window.open(`https://api.whatsapp.com/send?phone=${numeroLimpo}&text=${encodeURIComponent(mensagem)}`, '_blank');
    };

    const formatarData = (dataString) => {
        if (!dataString) return 'n/a';
        const [ano, mes, dia] = dataString.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    // LÓGICA DE FILTRAGEM DAS SUB-ABAS
    const getFilteredRentals = () => {
        const hoje = new Date();
        return rentals.filter(rental => {
            const dataPrazo = new Date(rental.data_devolucao + 'T23:59:59');
            if (statusFilter === 'devolvidos') {
                return rental.status === 'Devolvido';
            }
            if (statusFilter === 'atrasados') {
                return rental.status === 'Ativo' && dataPrazo < hoje;
            }
            if (statusFilter === 'no_prazo') {
                return rental.status === 'Ativo' && dataPrazo >= hoje;
            }
            return true;
        });
    };

    const filteredRentals = getFilteredRentals();

    const buscarLeitorDoMes = async () => {
        const inicioDoMes = new Date();
        inicioDoMes.setDate(1); // Define como dia 1 do mês atual
        inicioDoMes.setHours(0, 0, 0, 0);

        // Busca todos os aluguéis criados a partir do início do mês
        const { data, error } = await supabase
            .from('rentals')
            .select('aluno_nome')
            .gte('created_at', inicioDoMes.toISOString());

        if (error) return;

        // Agrupa e conta quantos livros cada aluno pegou
        const contagem = data.reduce((acc, rental) => {
            acc[rental.aluno_nome] = (acc[rental.aluno_nome] || 0) + 1;
            return acc;
        }, {});

        // Transforma em array e ordena do maior para o menor
        const ranking = Object.entries(contagem)
            .map(([nome, total]) => ({ nome, total }))
            .sort((a, b) => b.total - a.total);

        console.log("O campeão de leituras deste mês é:", ranking[0]);
        // Você pode salvar isso em um estado e mostrar um card dourado de destaque no seu Dashboard!
    };

    const obterEstatisticasAvancadas = () => {
        if (!rentals || rentals.length === 0) return { rankingAlunos: [], generoMaisLido: 'Nenhum', totalGenero: 0 };

        // 1. Contagem de Livros por Aluno
        const contagemAlunos = rentals.reduce((acc, r) => {
            if (r.aluno_nome) {
                acc[r.aluno_nome] = acc[r.aluno_nome] || { nome: r.aluno_nome, turma: r.aluno_turma, total: 0 };
                acc[r.aluno_nome].total += 1;
            }
            return acc;
        }, {});

        // Ordena os alunos do que pegou mais livros para o que pegou menos
        const rankingAlunos = Object.values(contagemAlunos).sort((a, b) => b.total - a.total);

        // 2. Contagem por Gênero Literário
        const contagemGeneros = rentals.reduce((acc, r) => {
            const genero = r.books?.categoria || 'Não Informado';
            acc[genero] = (acc[genero] || 0) + 1;
            return acc;
        }, {});

        // Encontra o gênero com maior número de aluguéis
        let generoMaisLido = 'Nenhum';
        let totalGenero = 0;
        Object.entries(contagemGeneros).forEach(([genero, total]) => {
            if (total > totalGenero) {
                generoMaisLido = genero;
                totalGenero = total;
            }
        });

        return { rankingAlunos, generoMaisLido, totalGenero };
    };

    const { rankingAlunos, generoMaisLido, totalGenero } = obterEstatisticasAvancadas();
    const leitorDoMes = rankingAlunos[0] || { nome: 'Nenhum aluno cadastrado ainda', total: 0, turma: '' };

    const imprimirEtiqueta = (codigo, titulo) => {
        // Abre uma janela pop-up apenas para a impressão
        const janelaImpressao = window.open('', '_blank', 'width=400,height=400');
        janelaImpressao.document.write(`
    <html>
      <head>
        <title>Imprimir Etiqueta - ${codigo}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            text-align: center;
          }
          .titulo { font-size: 12px; font-weight: bold; margin-bottom: 5px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          @media print {
            body { height: auto; }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="titulo">${titulo}</div>
        <svg id="barcode"></svg>
        <script>
          JsBarcode("#barcode", "${codigo}", {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 12
          });
          // Dispara o comando de impressão e fecha a aba depois
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        </script>
      </body>
    </html>
  `);
        janelaImpressao.document.close();
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
            {/* TOPO MOBILE */}
            <div className="bg-library-green p-4 flex justify-between items-center text-white md:hidden shadow-md z-20">
                <span className="font-bold text-xl">BiblioTech Admin</span>
                <button onClick={() => setIsMenuMobileOpen(!isMenuMobileOpen)} className="cursor-pointer">
                    {isMenuMobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* SIDEBAR */}
            {/* SIDEBAR RESPONSIVA - CORRIGIDA SEM SUMIR COM AS FUNÇÕES */}
            <aside className={`bg-library-green text-white flex flex-col transition-transform duration-300 z-30
    ${isMenuMobileOpen
                    ? 'fixed inset-x-0 bottom-0 top-[60px] translate-x-0'
                    : 'fixed inset-y-0 left-0 -translate-x-full md:sticky md:top-0 md:translate-x-0 md:w-64 md:h-screen md:z-10'
                }`}
            >
                {/* Título - Só visível no Computador */}
                <div className="p-6 text-2xl font-bold border-b border-white/20 hidden md:block">BiblioTech Admin</div>

                {/* Área dos Botões com Rolagem caso a tela do celular seja pequena ou deitada */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button
                        onClick={() => { setActiveTab('alugueis'); setIsMenuMobileOpen(false); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition ${activeTab === 'alugueis' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
                    >
                        <Users size={20} /> Aluguéis
                    </button>
                    <button
                        onClick={() => { setActiveTab('livros'); setIsMenuMobileOpen(false); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition ${activeTab === 'livros' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
                    >
                        <Book size={20} /> Livros (Estoque)
                    </button>
                    <button
                        onClick={() => { setActiveTab('estatisticas'); setIsMenuMobileOpen(false); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition ${activeTab === 'estatisticas' ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
                    >
                        <BarChart3 size={20} /> Estatísticas e Ranking
                    </button>
                </nav>

                {/* Contêiner do Botão Sair fixado na base do menu de forma limpa */}
                <div className="p-4 border-t border-white/10 bg-library-green">
                    <button
                        onClick={handleLogout}
                        className="w-full p-3 flex items-center justify-center gap-2 hover:bg-red-600 transition rounded-lg bg-red-500 font-semibold text-sm cursor-pointer"
                    >
                        <LogOut size={16} /> Sair
                    </button>
                </div>
            </aside>

            {/* CONTEÚDO */}
            <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Painel de Gestão</h2>

                {/* CARDS DE MÉTRICAS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500"><p className="text-gray-500 text-xs font-semibold">Aluguéis no Prazo</p><p className="text-2xl font-bold mt-1 text-blue-600">{stats.ativos}</p></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500"><p className="text-gray-500 text-xs font-semibold">Aluguéis Atrasados</p><p className="text-2xl font-bold mt-1 text-red-600">{stats.atrasados}</p></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><p className="text-gray-500 text-xs font-semibold">Histórico Total</p><p className="text-2xl font-bold mt-1 text-green-600">{stats.total}</p></div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-500"><p className="text-gray-500 text-xs font-semibold">Total de Livros (Acervo)</p><p className="text-2xl font-bold mt-1 text-purple-600">{stats.livrosTotal}</p>
                    </div>
                </div>

                {/* SEÇÃO DE ALUGUÉIS COM SUB-ABAS */}
                {activeTab === 'alugueis' && (
                    <div className="space-y-4">
                        {/* CONTÊINER CINZA - ADAPTÁVEL PARA WEB E MOBILE */}
                        <div className="bg-gray-100/90 p-2 md:p-1.5 rounded-xl flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto border border-gray-200/40 md:border-transparent">

                            {/* Linha dos 3 botões de filtro */}
                            {/* No Mobile: Fica em grid (grid-cols-3) dividindo igualmente o ecrã */}
                            {/* Na Web (md:): Volta a ser um flex inline compacto */}
                            <div className="grid grid-cols-3 md:flex gap-1.5 w-full md:w-auto">
                                <button
                                    onClick={() => setStatusFilter('no_prazo')}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition shadow-sm cursor-pointer border ${statusFilter === 'no_prazo'
                                        ? 'bg-white text-blue-600 border-gray-200'
                                        : 'bg-transparent text-gray-600 border-transparent hover:bg-white/50'
                                        }`}
                                >
                                    <Clock size={14} /> No Prazo
                                </button>
                                <button
                                    onClick={() => setStatusFilter('atrasados')}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition shadow-sm cursor-pointer border ${statusFilter === 'atrasados'
                                        ? 'bg-white text-red-600 border-gray-200'
                                        : 'bg-transparent text-gray-600 border-transparent hover:bg-white/50'
                                        }`}
                                >
                                    <CalendarX size={14} /> Atrasados
                                </button>
                                <button
                                    onClick={() => setStatusFilter('devolvidos')}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] sm:text-xs font-bold transition shadow-sm cursor-pointer border ${statusFilter === 'devolvidos'
                                        ? 'bg-white text-green-600 border-gray-200'
                                        : 'bg-transparent text-gray-600 border-transparent hover:bg-white/50'
                                        }`}
                                >
                                    <CalendarCheck size={14} /> Devolvidos
                                </button>
                            </div>

                            {/* Botão + Novo Aluguel */}
                            {/* No Mobile: Ocupa 100% da largura abaixo dos filtros (w-full) */}
                            {/* Na Web (md:): Fica ao lado dos filtros de forma compacta (md:w-auto) */}
                            <button
                                onClick={() => setIsAddRentalModalOpen(true)}
                                className="w-full md:w-auto bg-library-brown text-white py-2 px-4 rounded-lg text-xs sm:text-sm font-bold hover:bg-opacity-95 transition cursor-pointer shadow-sm text-center"
                            >
                                + Novo Aluguel
                            </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <h3 className="text-lg sm:text-xl font-bold text-gray-800 capitalize">
                                    {statusFilter === 'no_prazo' && 'Aluguéis Ativos no Prazo'}
                                    {statusFilter === 'atrasados' && 'Livros Pendentes / Atrasados'}
                                    {statusFilter === 'devolvidos' && 'Histórico de Livros Devolvidos'}
                                </h3>
                            </div>

                            {/* TABELA PC */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                            <th className="p-4">Aluno</th>
                                            <th className="p-4">Livro</th>
                                            <th className="p-4">Bibliotecário</th>
                                            <th className="p-4">Histórico de Datas</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredRentals.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-8 text-center text-gray-400 font-medium">Nenhum registro encontrado nesta categoria.</td>
                                            </tr>
                                        ) : (
                                            filteredRentals.map(rental => (
                                                <tr key={rental.id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-medium">
                                                        {rental.aluno_nome}<br />
                                                        <span className="text-xs text-gray-500">{rental.aluno_turma}</span>
                                                        {rental.aluno_whatsapp && <span className="text-xs text-green-600 block">📱 {rental.aluno_whatsapp}</span>}
                                                    </td>
                                                    <td className="p-4">{rental.books?.titulo}<br /><span className="text-xs text-gray-500">{rental.books?.codigo}</span></td>
                                                    <td className="p-4 text-gray-600">
                                                        <span className="font-semibold capitalize">{rental.bibliotecario_email ? rental.bibliotecario_email.split('@')[0] : 'Sistema'}</span>
                                                        <br /><span className="text-xs text-gray-400">{rental.bibliotecario_email || 'n/a'}</span>
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        <span className="block"><strong>Alugado:</strong> {formatarData(rental.data_aluguel)}</span>
                                                        <span className="text-amber-700 block"><strong>Prazo:</strong> {formatarData(rental.data_devolucao)}</span>
                                                        {rental.status === 'Devolvido' && (
                                                            <span className="text-green-600 font-bold block bg-green-50 px-1 py-0.5 rounded mt-1 w-max">Devolvido em: {formatarData(rental.data_devolucao_real)}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${rental.status === 'Devolvido' ? 'bg-green-100 text-green-800' :
                                                            statusFilter === 'atrasados' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {rental.status === 'Devolvido' ? 'Devolvido' : statusFilter === 'atrasados' ? 'Atrasado' : 'No Prazo'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-3">
                                                            {rental.status === 'Ativo' && (
                                                                <>
                                                                    <button onClick={() => confirmarDevolucao(rental.id, rental.book_id)} className="text-library-green hover:underline font-semibold cursor-pointer">Devolver</button>
                                                                    <button onClick={() => enviarReciboWhatsApp(rental)} className="flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-1 rounded border border-green-200 cursor-pointer"><MessageCircle size={14} />Recibo</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* CARDS MOBILE */}
                            <div className="block lg:hidden divide-y divide-gray-100">
                                {filteredRentals.length === 0 ? (
                                    <p className="p-6 text-center text-xs text-gray-400">Nenhum registro encontrado.</p>
                                ) : (
                                    filteredRentals.map(rental => (
                                        <div key={rental.id} className="p-4 space-y-2 bg-white">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-base">{rental.aluno_nome}</p>
                                                    <p className="text-xs text-gray-500">{rental.aluno_turma}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${rental.status === 'Devolvido' ? 'bg-green-100 text-green-800' :
                                                    statusFilter === 'atrasados' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>{rental.status === 'Devolvido' ? 'Devolvido' : statusFilter === 'atrasados' ? 'Atrasado' : 'No Prazo'}</span>
                                            </div>
                                            <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded space-y-1">
                                                <p className="font-semibold text-library-green">📖 {rental.books?.titulo} ({rental.books?.codigo})</p>
                                                <p>👤 <strong>Bibliotecário:</strong> {rental.bibliotecario_email || 'n/a'}</p>
                                                <p>📅 <strong>Alugado em:</strong> {formatarData(rental.data_aluguel)}</p>
                                                <p className="text-amber-700 font-medium">⚠️ <strong>Prazo Limite:</strong> {formatarData(rental.data_devolucao)}</p>
                                                {rental.status === 'Devolvido' && <p className="text-green-600 font-bold">✅ Devolvido em: {formatarData(rental.data_devolucao_real)}</p>}
                                                {rental.aluno_whatsapp && <p className="text-green-600 font-medium">📱 <strong>WhatsApp:</strong> {rental.aluno_whatsapp}</p>}
                                            </div>
                                            {rental.status === 'Ativo' && (
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={() => confirmarDevolucao(rental.id, rental.book_id)} className="flex-1 text-center bg-library-green text-white py-1.5 rounded text-xs font-semibold cursor-pointer">Confirmar Devolução</button>
                                                    <button onClick={() => enviarReciboWhatsApp(rental)} className="flex items-center justify-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"><MessageCircle size={14} /> Recibo</button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA DE LIVROS (ESTOQUE) */}
                {activeTab === 'livros' && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-800">Gerenciamento de Livros (Estoque)</h3>
                            <button onClick={() => setIsAddBookModalOpen(true)} className="bg-library-green text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium w-full sm:w-auto text-center cursor-pointer">+ Novo Livro</button>
                        </div>

                        {/* TABELA LIVROS PC */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                        <th className="p-4">Capa</th>
                                        <th className="p-4">Código / Título</th>
                                        <th className="p-4">Código de Barras (Imprimir)</th>
                                        <th className="p-4">Autor</th>
                                        <th className="p-4 text-center">Estoque</th>
                                        <th className="p-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {books.map(book => (
                                        <tr key={book.id} className="hover:bg-gray-50">
                                            <td className="p-4">
                                                <img src={book.capa_url || 'https://via.placeholder.com/40x60?text=No+Cover'} alt="Capa" className="w-10 h-14 object-contain rounded bg-gray-100 shadow-sm" />
                                            </td>
                                            <td className="p-4 font-medium">
                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-mono">{book.codigo}</span>
                                                <div className="mt-1 text-gray-900 font-semibold">{book.titulo}</div>
                                            </td>

                                            {/* CÓDIGO DE BARRAS DA TABELA PC */}
                                            <td className="p-4">
                                                <div
                                                    onClick={() => setBarcodeModal({ isOpen: true, book: book })}
                                                    className="bg-white p-1 rounded border border-gray-200 inline-block shadow-xs cursor-pointer hover:border-library-green hover:bg-gray-50 transition"
                                                    title="Clique para visualizar e imprimir"
                                                >
                                                    <Barcode value={book.codigo || "0000"} format="CODE128" width={1.2} height={35} fontSize={10} margin={2} />
                                                </div>
                                            </td>

                                            <td className="p-4 text-gray-600">{book.autor}<br /><span className="text-xs text-library-brown font-medium uppercase">{book.categoria}</span></td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button onClick={() => handleAlterarEstoque(book.id, book.quantidade, -1)} className="p-1 rounded bg-gray-100 cursor-pointer"><Minus size={14} /></button>
                                                    <span className="font-bold">{book.quantidade}</span>
                                                    <button onClick={() => handleAlterarEstoque(book.id, book.quantidade, 1)} className="p-1 rounded bg-gray-100 cursor-pointer"><Plus size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => abrirEditarLivro(book)} className="text-blue-500 p-2 cursor-pointer"><Pencil size={16} /></button>
                                                    <button onClick={() => handleExcluirLivro(book.id, book.titulo)} className="text-red-500 p-2 cursor-pointer"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* CARDS LIVROS MOBILE */}
                        <div className="block lg:hidden divide-y divide-gray-100">
                            {books.map(book => (
                                <div key={book.id} className="p-4 flex flex-col gap-3 bg-white">
                                    <div className="flex items-start gap-3">
                                        <img src={book.capa_url || 'https://via.placeholder.com/40x60?text=No+Cover'} alt="Capa" className="w-12 h-16 object-contain rounded bg-gray-100 shadow-sm flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{book.titulo}</p>
                                            <p className="text-xs text-gray-500 truncate">{book.autor} • {book.categoria}</p>
                                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono mt-1 inline-block">Cód: {book.codigo}</span>
                                        </div>
                                        <div className="flex gap-1 border-l pl-2 flex-shrink-0">
                                            <button onClick={() => abrirEditarLivro(book)} className="text-blue-500 p-1.5 cursor-pointer"><Pencil size={16} /></button>
                                            <button onClick={() => handleExcluirLivro(book.id, book.titulo)} className="text-red-500 p-1.5 cursor-pointer"><Trash2 size={16} /></button>
                                        </div>
                                    </div>

                                    {/* LINHA DE RECURSOS ADICIONAIS NO MOBILE (CÓDIGO DE BARRAS E ESTOQUE) */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-50">
                                        {/* CÓDIGO DE BARRAS DO CARD MOBILE */}
                                        <div
                                            onClick={() => setBarcodeModal({ isOpen: true, book: book })}
                                            className="bg-white p-1 rounded border border-gray-200 scale-90 origin-left shadow-xs cursor-pointer hover:border-library-green transition"
                                            title="Clique para visualizar e imprimir"
                                        >
                                            <Barcode value={book.codigo || "0000"} format="CODE128" width={1.0} height={28} fontSize={9} margin={1} />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600 font-medium">Estoque:</span>
                                            <button onClick={() => handleAlterarEstoque(book.id, book.quantidade, -1)} className="p-1 bg-gray-100 rounded text-gray-700 cursor-pointer"><Minus size={12} /></button>
                                            <span className="text-sm font-bold text-gray-900 w-4 text-center">{book.quantidade}</span>
                                            <button onClick={() => handleAlterarEstoque(book.id, book.quantidade, 1)} className="p-1 bg-gray-100 rounded text-gray-700 cursor-pointer"><Plus size={12} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* NOVA ABA: RELATÓRIOS E COMPROVAÇÕES */}
                {activeTab === 'estatisticas' && (
                    <div className="space-y-6 animate-fade-in">

                        {/* Painel Destaque (Cards de Ouro) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Card do Leitor do Mês */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-100 p-6 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-amber-800 text-xs font-bold bg-amber-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        🏆 Líder de Leituras / Leitor do Mês
                                    </span>
                                    <h4 className="text-2xl font-black text-amber-900 mt-2">{leitorDoMes.nome}</h4>
                                    <p className="text-sm text-amber-700 mt-0.5">Turma: {leitorDoMes.turma || 'Não informada'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-4xl font-extrabold text-amber-600">{leitorDoMes.total}</p>
                                    <p className="text-xs text-amber-700 font-medium">livros lidos</p>
                                </div>
                            </div>

                            {/* Card do Gênero Mais Popular */}
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-100 p-6 rounded-2xl border border-purple-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-purple-800 text-xs font-bold bg-purple-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        🔥 Gênero Mais Lido do Acervo
                                    </span>
                                    <h4 className="text-2xl font-black text-purple-900 mt-2 capitalize">{generoMaisLido}</h4>
                                    <p className="text-sm text-purple-700 mt-0.5">Preferência geral dos alunos</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-4xl font-extrabold text-purple-600">{totalGenero}</p>
                                    <p className="text-xs text-purple-700 font-medium">retiradas</p>
                                </div>
                            </div>

                        </div>

                        {/* Tabela do Ranking Geral de Alunos para Competições */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 text-lg">Ranking Geral de Alunos</h3>
                                <p className="text-xs text-gray-500">Lista ordenada dos alunos que mais retiraram livros no sistema para premiações</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase border-b border-gray-100">
                                            <th className="p-4 w-16 text-center">Posição</th>
                                            <th className="p-4">Nome do Aluno</th>
                                            <th className="p-4">Turma</th>
                                            <th className="p-4 text-center">Livros Retirados</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {rankingAlunos.map((aluno, index) => (
                                            <tr key={index} className="hover:bg-gray-50/80 transition">
                                                <td className="p-4 text-center font-bold">
                                                    {index === 0 && '🥇'}
                                                    {index === 1 && '🥈'}
                                                    {index === 2 && '🥉'}
                                                    {index > 2 && `${index + 1}º`}
                                                </td>
                                                <td className="p-4 font-semibold text-gray-800">{aluno.nome}</td>
                                                <td className="p-4 text-gray-600">{aluno.turma || '---'}</td>
                                                <td className="p-4 text-center font-bold text-library-green bg-green-50/30">{aluno.total}</td>
                                            </tr>
                                        ))}
                                        {rankingAlunos.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center p-8 text-gray-400">Nenhum dado de aluguel encontrado para gerar o ranking.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {barcodeModal.isOpen && barcodeModal.book && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all animate-scale-in">
                            <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">
                                {barcodeModal.book.titulo}
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">Visualização da Etiqueta</p>

                            <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 flex justify-center mb-8">
                                <Barcode
                                    value={barcodeModal.book.codigo || "0000"}
                                    format="CODE128"
                                    width={2}
                                    height={60}
                                    fontSize={14}
                                    margin={0}
                                />
                            </div>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setBarcodeModal({ isOpen: false, book: null })}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                                <button
                                    onClick={() => {
                                        imprimirEtiqueta(barcodeModal.book.codigo, barcodeModal.book.titulo);
                                        setBarcodeModal({ isOpen: false, book: null }); // Fecha o modal após imprimir
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-library-green text-white font-medium rounded-lg hover:bg-opacity-90 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <Printer size={18} /> Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modais Dinâmicos */}
                <AddBookModal isOpen={isAddBookModalOpen} onClose={() => setIsAddBookModalOpen(false)} onBookAdded={() => { fetchRentals(); fetchBooks(); }} />
                <AddRentalModal isOpen={isAddRentalModalOpen} onClose={() => setIsAddRentalModalOpen(false)} onRentalAdded={() => { fetchRentals(); fetchBooks(); }} />
                <EditBookModal isOpen={isEditBookModalOpen} onClose={() => { setIsEditBookModalOpen(false); setSelectedBookForEdit(null); }} book={selectedBookForEdit} onBookUpdated={() => { fetchRentals(); fetchBooks(); }} />
            </main>
        </div>
    );
}