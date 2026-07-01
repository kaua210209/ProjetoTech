// src/components/AddRentalModal.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, BookUser, Calendar, Clock, Phone, Camera, Search, Check } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';

export default function AddRentalModal({ isOpen, onClose, onRentalAdded }) {
  const [loading, setLoading] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  const [students, setStudents] = useState([]);
  
  // ESTADOS DE BUSCA (AUTOCOMPLETE)
  const [studentSearch, setStudentSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [showStudentResults, setShowStudentResults] = useState(false);
  const [showBookResults, setShowBookResults] = useState(false);
  
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isNewStudent, setIsNewStudent] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const html5QrCodeRef = useRef(null);
  const studentRef = useRef(null);
  const bookRef = useRef(null);

  const hoje = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    aluno_nome: '',
    aluno_turma: '',
    aluno_whatsapp: '',
    book_id: '',
    data_aluguel: hoje,
    tempo_limite: 7
  });

  // Fecha as listas de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (studentRef.current && !studentRef.current.contains(event.target)) setShowStudentResults(false);
      if (bookRef.current && !bookRef.current.contains(event.target)) setShowBookResults(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBooks();
      fetchStudents();
      resetForm();
    }
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => console.error(err));
      }
    };
  }, [isOpen]);

  const resetForm = () => {
    setFormData({ aluno_nome: '', aluno_turma: '', aluno_whatsapp: '', book_id: '', data_aluguel: hoje, tempo_limite: 7 });
    setStudentSearch('');
    setBookSearch('');
    setSelectedStudentId('');
    setIsNewStudent(false);
    setIsScanning(false);
  };

  const fetchAvailableBooks = async () => {
    const { data, error } = await supabase.from('books').select('id, titulo, codigo, quantidade').gt('quantidade', 0).order('titulo', { ascending: true });
    if (!error && data) setAvailableBooks(data);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase.from('students').select('*').order('nome', { ascending: true });
    if (!error && data) setStudents(data);
  };

  // --- LÓGICA DE FILTRAGEM ---
  const filteredStudents = students.filter(s => 
    s.nome.toLowerCase().includes(studentSearch.toLowerCase()) || 
    (s.turma && s.turma.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  const filteredBooks = availableBooks.filter(b => 
    b.titulo.toLowerCase().includes(bookSearch.toLowerCase()) || 
    b.codigo.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const handleSelectStudent = (student) => {
    setSelectedStudentId(student.id);
    setStudentSearch(student.nome);
    setFormData(prev => ({
      ...prev,
      aluno_nome: student.nome,
      aluno_turma: student.turma || '',
      aluno_whatsapp: student.whatsapp || ''
    }));
    setShowStudentResults(false);
  };

  const handleSelectBook = (book) => {
    setFormData(prev => ({ ...prev, book_id: book.id }));
    setBookSearch(`${book.titulo} (${book.codigo})`);
    setShowBookResults(false);
  };

  // --- SCANNER (LÓGICA MANTIDA) ---
  const startScannerWithMode = async (facingMode) => {
    try {
      if (!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode("reader");
      if (html5QrCodeRef.current.isScanning) await html5QrCodeRef.current.stop();
      await html5QrCodeRef.current.start(
        { facingMode: facingMode },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (decodedText) => {
          const livro = availableBooks.find(b => b.codigo === decodedText.trim());
          if (livro) {
            handleSelectBook(livro);
            handleStopScanner();
            toast.success(`Livro: ${livro.titulo}`);
          } else {
            toast.error("Código não encontrado no estoque.");
          }
        },
        () => {}
      );
    } catch (err) {
      toast.error("Erro ao acessar câmera.");
    }
  };

  const handleStartScanner = async () => {
    setIsScanning(true);
    setTimeout(() => startScannerWithMode("environment"), 100);
  };

  const handleStopScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) html5QrCodeRef.current.stop();
    setIsScanning(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.book_id) return toast.error('Selecione um livro.');
    setLoading(true);

    try {
      const dataAluguelObj = new Date(formData.data_aluguel + 'T00:00:00');
      dataAluguelObj.setDate(dataAluguelObj.getDate() + parseInt(formData.tempo_limite));
      const dataDevolucao = dataAluguelObj.toISOString().split('T')[0];
      const { data: sess } = await supabase.auth.getSession();

      if (isNewStudent) {
        await supabase.from('students').insert([{ nome: formData.aluno_nome, turma: formData.aluno_turma, whatsapp: formData.aluno_whatsapp }]);
      }

      await supabase.from('rentals').insert([{
        aluno_nome: formData.aluno_nome, aluno_turma: formData.aluno_turma, aluno_whatsapp: formData.aluno_whatsapp,
        book_id: formData.book_id, data_aluguel: formData.data_aluguel, data_devolucao: dataDevolucao,
        bibliotecario_email: sess?.session?.user?.email, status: 'Ativo'
      }]);

      const { data: bData } = await supabase.from('books').select('quantidade').eq('id', formData.book_id).single();
      await supabase.from('books').update({ quantidade: bData.quantidade - 1 }).eq('id', formData.book_id);

      toast.success('Empréstimo registrado!');
      onRentalAdded(); onClose();
    } catch (err) {
      toast.error('Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden my-8">
        
        <div className="bg-library-green p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookUser size={20} />
            <h3 className="font-bold text-lg">Novo Empréstimo</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition cursor-pointer"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => setIsNewStudent(false)} className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${!isNewStudent ? 'bg-white text-library-green shadow-sm' : 'text-gray-500'}`}>Aluno Registrado</button>
            <button type="button" onClick={() => { setIsNewStudent(true); resetForm(); setIsNewStudent(true); }} className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${isNewStudent ? 'bg-white text-library-green shadow-sm' : 'text-gray-500'}`}>+ Novo Aluno</button>
          </div>

          {/* BUSCA DE ALUNO (AUTOCOMPLETE) */}
          {!isNewStudent && (
            <div className="relative" ref={studentRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar Aluno</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Digite o nome do aluno..." 
                  value={studentSearch}
                  onChange={(e) => { setStudentSearch(e.target.value); setShowStudentResults(true); }}
                  onFocus={() => setShowStudentResults(true)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none text-sm"
                />
              </div>
              
              {showStudentResults && studentSearch.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-2xl max-h-48 overflow-y-auto">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(s => (
                      <li key={s.id} onClick={() => handleSelectStudent(s)} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center group">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{s.nome}</p>
                          <p className="text-xs text-gray-500">{s.turma || 'Sem Turma'}</p>
                        </div>
                        {selectedStudentId === s.id && <Check size={16} className="text-library-green" />}
                      </li>
                    ))
                  ) : (
                    <li className="p-3 text-sm text-gray-500 italic">Nenhum aluno encontrado.</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* DADOS DO ALUNO (SÓ EDITA SE FOR NOVO) */}
          <div className={`space-y-3 p-4 rounded-xl border ${isNewStudent ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-gray-50'}`}>
             <input required type="text" name="aluno_nome" value={formData.aluno_nome} onChange={(e) => setFormData({...formData, aluno_nome: e.target.value})} disabled={!isNewStudent} placeholder="Nome do Aluno" className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-library-green disabled:opacity-70" />
             <div className="grid grid-cols-2 gap-2">
                <input required type="text" name="aluno_turma" value={formData.aluno_turma} onChange={(e) => setFormData({...formData, aluno_turma: e.target.value})} disabled={!isNewStudent} placeholder="Turma" className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none disabled:opacity-70" />
                <input required type="text" name="aluno_whatsapp" value={formData.aluno_whatsapp} onChange={(e) => setFormData({...formData, aluno_whatsapp: e.target.value})} disabled={!isNewStudent} placeholder="WhatsApp" className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none disabled:opacity-70" />
             </div>
          </div>

          {/* BUSCA DE LIVRO (AUTOCOMPLETE) */}
          <div className="relative" ref={bookRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar Livro</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Título ou código do livro..." 
                  value={bookSearch}
                  onChange={(e) => { setBookSearch(e.target.value); setShowBookResults(true); }}
                  onFocus={() => setShowBookResults(true)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none text-sm"
                />
                {showBookResults && bookSearch.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-2xl max-h-48 overflow-y-auto">
                    {filteredBooks.map(b => (
                      <li key={b.id} onClick={() => handleSelectBook(b)} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0">
                        <p className="text-sm font-bold text-gray-800">{b.titulo}</p>
                        <p className="text-[10px] text-gray-500 font-mono">CÓD: {b.codigo} | Estoque: {b.quantidade}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!isScanning && (
                <button type="button" onClick={handleStartScanner} className="p-2.5 rounded-lg bg-green-50 text-library-green border border-green-200 hover:bg-green-100 transition"><Camera size={20} /></button>
              )}
            </div>
          </div>

          {isScanning && (
            <div className="bg-black p-2 rounded-xl space-y-2">
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => startScannerWithMode("user")} className="flex-1 py-1 bg-white/20 text-white text-[10px] rounded">Frontal</button>
                <button type="button" onClick={() => startScannerWithMode("environment")} className="flex-1 py-1 bg-white/20 text-white text-[10px] rounded">Traseira</button>
                <button type="button" onClick={handleStopScanner} className="px-3 py-1 bg-red-500 text-white text-[10px] rounded">Parar</button>
              </div>
              <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data</label>
              <input type="date" name="data_aluguel" value={formData.data_aluguel} onChange={(e) => setFormData({...formData, data_aluguel: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Dias p/ Devolução</label>
              <input type="number" name="tempo_limite" value={formData.tempo_limite} onChange={(e) => setFormData({...formData, tempo_limite: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-library-green text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition shadow-lg disabled:opacity-50 mt-4">
            {loading ? 'Processando...' : 'Confirmar Empréstimo'}
          </button>
        </form>
      </div>
    </div>
  );
}