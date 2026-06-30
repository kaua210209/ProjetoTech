// src/components/AddBookModal.jsx
import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddBookModal({ isOpen, onClose, onBookAdded }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  // Nova função para processar e fazer upload da foto tirada pela câmera
  const handleCapturePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Gera um nome único para a imagem usando o timestamp atual
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // 1. Faz o upload da foto para o Storage do Supabase (Bucket: capas-livros)
      const { error: uploadError } = await supabase.storage
        .from('capas-livros')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Busca a URL pública do arquivo enviado
      const { data } = supabase.storage
        .from('capas-livros')
        .getPublicUrl(filePath);

      // 3. Salva a URL gerada no estado do formulário
      setFormData(prev => ({ ...prev, capa_url: data.publicUrl }));
      toast.success('Foto da capa vinculada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar/enviar a foto da câmera.');
    } finally {
      setUploading(false);
    }
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
      if (error.code === '23505') {
        toast.error('Já existe um livro com este código!');
      } else {
        toast.error('Erro ao cadastrar livro.');
        console.error(error);
      }
    } else {
      toast.success('Livro cadastrado com sucesso!');
      onBookAdded();
      onClose();
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition cursor-pointer">
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
          
          {/* Campo de URL Refatorado com suporte a Câmera */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">URL da Capa (Imagem)</label>
            <div className="flex gap-2">
              <input 
                type="url" 
                name="capa_url" 
                value={formData.capa_url} 
                onChange={handleChange} 
                placeholder="https://... ou use a câmera ao lado" 
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none" 
              />
              
              {/* Input invisível focado em capturar imagem usando a câmera nativa do dispositivo */}
              <input 
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleCapturePhoto}
                className="hidden"
              />

              {/* Botão Visual da Câmera */}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-library-green text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 transition flex items-center gap-2 font-medium disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Camera size={18} />
                    <span>Câmera</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sinopse</label>
            <textarea rows="3" name="sinopse" value={formData.sinopse} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none"></textarea>
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-library-green rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 cursor-pointer">
              {loading ? 'Salvando...' : 'Salvar Livro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}