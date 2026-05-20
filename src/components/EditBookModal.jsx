// src/components/EditBookModal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditBookModal({ isOpen, onClose, book, onBookUpdated }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    autor: '',
    categoria: 'Romance',
    capa_url: '',
    codigo: '',
    quantidade: 0
  });

  // Toda vez que o modal abrir com um livro selecionado, preenche o formulário
  useEffect(() => {
    if (isOpen && book) {
      setFormData({
        titulo: book.titulo || '',
        autor: book.autor || '',
        categoria: book.categoria || 'Romance',
        capa_url: book.capa_url || '',
        codigo: book.codigo || '',
        quantidade: book.quantidade || 0
      });
    }
  }, [isOpen, book]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('books')
        .update({
          titulo: formData.titulo,
          autor: formData.autor,
          categoria: formData.categoria,
          capa_url: formData.capa_url,
          codigo: formData.codigo,
          quantidade: parseInt(formData.quantidade)
        })
        .eq('id', book.id);

      if (error) throw error;

      toast.success('Livro atualizado com sucesso!');
      onBookUpdated();
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar dados do livro.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-blue-50 text-blue-600">
          <div className="flex items-center gap-2">
            <Edit3 size={24} />
            <h2 className="text-xl font-bold">Editar Informações do Livro</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Único</label>
            <input required type="text" name="codigo" value={formData.codigo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título do Livro</label>
            <input required type="text" name="titulo" value={formData.titulo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
            <input required type="text" name="autor" value={formData.autor} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white">
              {['Romance', 'Drama', 'Suspense', 'Ficção Científica', 'Terror', 'Fantasia', 'Biografia', 'Outros'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL da Capa do Livro</label>
            <input type="url" name="capa_url" value={formData.capa_url} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade no Stock</label>
            <input required type="number" min="0" name="quantidade" value={formData.quantidade} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 cursor-pointer">
              {loading ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}