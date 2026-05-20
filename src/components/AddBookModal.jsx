// src/components/AddBookModal.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddBookModal({ isOpen, onClose, onBookAdded }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    autor: '',
    categoria: 'Romance',
    ano_publicacao: '',
    quantidade: 1,
    capa_url: '',
    sinopse: ''
  });

  const categorias = ['Romance', 'Drama', 'Suspense', 'Ficção Científica', 'Terror', 'Fantasia', 'Biografia', 'Outros'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('books').insert([
      {
        ...formData,
        ano_publicacao: parseInt(formData.ano_publicacao),
        quantidade: parseInt(formData.quantidade)
      }
    ]);

    if (error) {
      if (error.code === '23505') { // Código de erro do Postgres para valor único duplicado
        toast.error('Já existe um livro com este código!');
      } else {
        toast.error('Erro ao cadastrar livro.');
        console.error(error);
      }
    } else {
      toast.success('Livro cadastrado com sucesso!');
      onBookAdded(); // Atualiza a lista no Dashboard
      onClose(); // Fecha o modal
      // Limpa o formulário
      setFormData({
        codigo: '', titulo: '', autor: '', categoria: 'Romance', 
        ano_publicacao: '', quantidade: 1, capa_url: '', sinopse: ''
      });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Cadastrar Novo Livro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Único (Ex: LIV-002)</label>
            <input required type="text" name="codigo" value={formData.codigo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input required type="text" name="titulo" value={formData.titulo} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
            <input required type="text" name="autor" value={formData.autor} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none">
              {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ano de Publicação</label>
            <input required type="number" name="ano_publicacao" value={formData.ano_publicacao} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade em Estoque</label>
            <input required type="number" min="1" name="quantidade" value={formData.quantidade} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">URL da Capa (Imagem)</label>
            <input type="url" name="capa_url" value={formData.capa_url} onChange={handleChange} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sinopse</label>
            <textarea rows="3" name="sinopse" value={formData.sinopse} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none"></textarea>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-library-green rounded-lg hover:bg-opacity-90 transition disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Livro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}