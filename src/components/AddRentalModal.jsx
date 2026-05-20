// src/components/AddRentalModal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, BookUser, Calendar, Clock, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddRentalModal({ isOpen, onClose, onRentalAdded }) {
  const [loading, setLoading] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  
  const hoje = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    aluno_nome: '',
    aluno_turma: '',
    aluno_whatsapp: '', // Novo campo adicionado
    book_id: '',
    data_aluguel: hoje,
    tempo_limite: 7
  });

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBooks();
      setFormData(prev => ({
        ...prev,
        data_aluguel: hoje,
        tempo_limite: 7,
        aluno_whatsapp: ''
      }));
    }
  }, [isOpen]);

  const fetchAvailableBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, titulo, codigo, quantidade')
      .gt('quantidade', 0)
      .order('titulo', { ascending: true });
    
    if (error) toast.error('Erro ao buscar livros disponíveis');
    else setAvailableBooks(data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.book_id) {
      toast.error('Por favor, selecione um livro!');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const dataCalculada = new Date(formData.data_aluguel + 'T12:00:00');
      dataCalculada.setDate(dataCalculada.getDate() + parseInt(formData.tempo_limite));
      const dataDevolucaoFinal = dataCalculada.toISOString().split('T')[0];

      // Envia os dados incluindo o WhatsApp do aluno
      const { error: rentalError } = await supabase.from('rentals').insert([{
        book_id: formData.book_id,
        user_id: session?.user?.id,
        bibliotecario_email: session?.user?.email,
        aluno_nome: formData.aluno_nome,
        aluno_turma: formData.aluno_turma,
        aluno_whatsapp: formData.aluno_whatsapp, // Salvando no banco
        data_aluguel: formData.data_aluguel,
        data_devolucao: dataDevolucaoFinal,
        status: 'Ativo'
      }]);

      if (rentalError) throw rentalError;

      const selectedBook = availableBooks.find(b => b.id === formData.book_id);
      const { error: bookError } = await supabase
        .from('books')
        .update({ quantidade: selectedBook.quantidade - 1 })
        .eq('id', formData.book_id);

      if (bookError) throw bookError;

      toast.success('Aluguel registrado com sucesso!');
      onRentalAdded();
      onClose();
      setFormData({ aluno_nome: '', aluno_turma: '', aluno_whatsapp: '', book_id: '', data_aluguel: hoje, tempo_limite: 7 });

    } catch (error) {
      toast.error('Erro ao registrar aluguel.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-library-light-green">
          <div className="flex items-center gap-2 text-library-green">
            <BookUser size={24} />
            <h2 className="text-xl font-bold">Registrar Novo Aluguel</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo do Aluno</label>
            <input required type="text" name="aluno_nome" value={formData.aluno_nome} onChange={handleChange} placeholder="Ex: Kauã Anderson" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turma / Turno</label>
              <input required type="text" name="aluno_turma" value={formData.aluno_turma} onChange={handleChange} placeholder="Ex: 3º ano EM" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
            </div>
            {/* NOVO CAMPO: WHATSAPP DO ALUNO */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Phone size={14} /> WhatsApp
              </label>
              <input required type="text" name="aluno_whatsapp" value={formData.aluno_whatsapp} onChange={handleChange} placeholder="DDD + Número" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Livro Escolhido</label>
            <select required name="book_id" value={formData.book_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white">
              <option value="" disabled>Selecione um livro...</option>
              {availableBooks.map(book => (
                <option key={book.id} value={book.id}>
                  {book.codigo} - {book.titulo} ({book.quantidade} disp.)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Calendar size={14} /> Data do Aluguel
              </label>
              <input required type="date" name="data_aluguel" value={formData.data_aluguel} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock size={14} /> Tempo Limite (Dias)
              </label>
              <input required type="number" min="1" name="tempo_limite" value={formData.tempo_limite} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-library-brown rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 cursor-pointer">
              {loading ? 'Registrando...' : 'Confirmar Aluguel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}