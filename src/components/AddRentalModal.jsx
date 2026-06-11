// src/components/AddRentalModal.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, BookUser, Calendar, Clock, Phone, Camera } from 'lucide-react';
// IMPORTANTE: Mudamos de Html5QrcodeScanner para Html5Qrcode
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';

export default function AddRentalModal({ isOpen, onClose, onRentalAdded }) {
  const [loading, setLoading] = useState(false);
  const [availableBooks, setAvailableBooks] = useState([]);
  
  // ESTADOS PARA GESTÃO DE ALUNOS
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isNewStudent, setIsNewStudent] = useState(false);

  // NOVOS ESTADOS PARA A CÂMERA
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef(null);

  const hoje = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    aluno_nome: '',
    aluno_turma: '',
    aluno_whatsapp: '',
    book_id: '',
    data_aluguel: hoje,
    tempo_limite: 7
  });

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBooks();
      fetchStudents();
      setFormData({
        aluno_nome: '',
        aluno_turma: '',
        aluno_whatsapp: '',
        book_id: '',
        data_aluguel: hoje,
        tempo_limite: 7
      });
      setSelectedStudentId('');
      setIsNewStudent(false);
      setIsScanning(false);
    }
    
    // Desliga a câmera de verdade se o modal for fechado pelo "X" ou "Cancelar"
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => console.error("Erro ao desligar:", err));
      }
    };
  }, [isOpen]);

  const fetchAvailableBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, titulo, codigo, quantidade')
      .gt('quantidade', 0)
      .order('titulo', { ascending: true });
    
    if (!error && data) setAvailableBooks(data);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('nome', { ascending: true });
    
    if (!error && data) setStudents(data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId);
    if (studentId === '') {
      setFormData(prev => ({ ...prev, aluno_nome: '', aluno_turma: '', aluno_whatsapp: '' }));
      return;
    }
    const student = students.find(s => s.id === studentId);
    if (student) {
      setFormData(prev => ({
        ...prev,
        aluno_nome: student.nome,
        aluno_turma: student.turma || '',
        aluno_whatsapp: student.whatsapp || ''
      }));
    }
  };

  // --- NOVA LÓGICA DA CÂMERA (CONTROLE TOTAL) ---

  // Função para ligar uma câmera específica (Frontal ou Traseira)
  const startScannerWithMode = async (facingMode) => {
    try {
      // Se não existir o leitor ainda, a gente cria atrelado à div "reader"
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }
      
      const html5QrCode = html5QrCodeRef.current;

      // Se já houver uma câmera ligada, desliga antes de ligar a nova
      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }

      // Inicia com a câmera escolhida (user = Frontal, environment = Traseira)
      await html5QrCode.start(
        { facingMode: facingMode },
        { 
          fps: 10, 
          qrbox: { width: 250, height: 120 },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      toast.error("Não foi possível acessar a câmera solicitada.");
    }
  };

  // Botão principal: Pede permissão e mostra as opções
  const handleStartScanner = async () => {
    try {
      // Isso forçará o navegador a pedir permissão de câmera IMEDIATAMENTE
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setIsScanning(true); // Exibe o painel da câmera
        
        // Aguarda 100ms para o React renderizar a <div id="reader"> antes de ligar o vídeo
        setTimeout(() => {
          startScannerWithMode("environment"); // Começa pela Traseira automaticamente
        }, 100);
      } else {
        toast.error("Nenhuma câmera encontrada no seu dispositivo.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Permissão de câmera negada. Autorize no navegador para escanear.");
    }
  };

  // Função para o botão "Parar"
  const handleStopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
    }
    setIsScanning(false);
  };

  // Quando o código for lido com sucesso
  const onScanSuccess = (decodedText) => {
    const livroEncontrado = availableBooks.find(b => b.codigo === decodedText.trim());

    if (livroEncontrado) {
      setFormData(prev => ({ ...prev, book_id: livroEncontrado.id }));
      toast.success(`Livro identificado: "${livroEncontrado.titulo}"`);
      handleStopScanner(); // Desliga a câmera imediatamente após achar o livro
    } else {
      toast.error(`Código "${decodedText}" lido, mas não há estoque ou não existe.`);
    }
  };

  const onScanFailure = (error) => {
    // Ignorado propositadamente para não poluir a consola enquanto ele foca
  };
  // ------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.book_id) {
      toast.error('Por favor, selecione ou escaneie um livro.');
      return;
    }

    setLoading(true);
    try {
      const dataAluguelObj = new Date(formData.data_aluguel + 'T00:00:00');
      dataAluguelObj.setDate(dataAluguelObj.getDate() + parseInt(formData.tempo_limite, 10));
      const dataDevolucao = dataAluguelObj.toISOString().split('T')[0];

      const { data: sessionData } = await supabase.auth.getSession();
      const emailBibliotecario = sessionData?.session?.user?.email || 'Sistema';

      if (isNewStudent && formData.aluno_nome.trim() !== '') {
        const { error: studentError } = await supabase
          .from('students')
          .insert([{
            nome: formData.aluno_nome.trim(),
            turma: formData.aluno_turma,
            whatsapp: formData.aluno_whatsapp
          }]);
        if (studentError) throw studentError;
      }

      const { error: rentalError } = await supabase
        .from('rentals')
        .insert([{
          aluno_nome: formData.aluno_nome,
          aluno_turma: formData.aluno_turma,
          aluno_whatsapp: formData.aluno_whatsapp,
          book_id: formData.book_id,
          data_aluguel: formData.data_aluguel,
          data_devolucao: dataDevolucao,
          bibliotecario_email: emailBibliotecario,
          status: 'Ativo'
        }]);

      if (rentalError) throw rentalError;

      const { data: bookData, error: bookFetchError } = await supabase
        .from('books')
        .select('quantidade')
        .eq('id', formData.book_id)
        .single();

      if (bookFetchError) throw bookFetchError;

      const { error: bookUpdateError } = await supabase
        .from('books')
        .update({ quantidade: Math.max(0, bookData.quantidade - 1) })
        .eq('id', formData.book_id);

      if (bookUpdateError) throw bookUpdateError;

      toast.success('Aluguel registado com sucesso!');
      onRentalAdded();
      onClose();

    } catch (error) {
      console.error(error);
      toast.error('Erro ao registar aluguel.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden transform transition-all animate-scale-in">
        
        <div className="bg-library-green p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookUser size={20} />
            <h3 className="font-bold text-lg">Novo Aluguel de Livro</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 max-h-[85vh] overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => { setIsNewStudent(false); setFormData(prev => ({ ...prev, aluno_nome: '', aluno_turma: '', aluno_whatsapp: '' })); setSelectedStudentId(''); }} className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${!isNewStudent ? 'bg-white text-library-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Aluno Cadastrado
            </button>
            <button type="button" onClick={() => { setIsNewStudent(true); setFormData(prev => ({ ...prev, aluno_nome: '', aluno_turma: '', aluno_whatsapp: '' })); setSelectedStudentId(''); }} className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${isNewStudent ? 'bg-white text-library-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              + Novo Aluno
            </button>
          </div>

          {!isNewStudent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <BookUser size={14} /> Selecionar Aluno Registrado
              </label>
              <select required={!isNewStudent} value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white text-sm">
                <option value="">-- Escolha o Aluno da Lista --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.turma || 'Sem Turma'})</option>)}
              </select>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <BookUser size={14} /> Nome do Aluno
              </label>
              <input required disabled={!isNewStudent} type="text" name="aluno_nome" value={formData.aluno_nome} onChange={handleChange} placeholder={isNewStudent ? "Nome completo do aluno" : "Selecione o aluno na lista acima"} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none text-sm transition ${!isNewStudent ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                <input required disabled={!isNewStudent} type="text" name="aluno_turma" value={formData.aluno_turma} onChange={handleChange} placeholder="Ex: 3º Ano A" className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none text-sm transition ${!isNewStudent ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone size={14} /> WhatsApp
                </label>
                <input required disabled={!isNewStudent} type="text" name="aluno_whatsapp" value={formData.aluno_whatsapp} onChange={handleChange} placeholder="(00) 00000-0000" className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none text-sm transition ${!isNewStudent ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`} />
              </div>
            </div>
          </div>

          {/* NOVA ÁREA DE SELEÇÃO E ESCANEAMENTO DO LIVRO COM BOTÕES CUSTOMIZADOS */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Livro Disponível</label>
                <select required name="book_id" value={formData.book_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white text-sm">
                  <option value="">-- Selecione o livro --</option>
                  {availableBooks.map(book => <option key={book.id} value={book.id}>{book.titulo} ({book.codigo}) - Disponíveis: {book.quantidade}</option>)}
                </select>
              </div>
              
              {/* Só exibe o botão verde se a câmera não estiver ligada */}
              {!isScanning && (
                <button type="button" onClick={handleStartScanner} className="p-2.5 rounded-lg border font-medium flex items-center justify-center transition cursor-pointer bg-green-50 text-library-green border-green-200 hover:bg-green-100" title="Abrir Câmera">
                  <Camera size={20} />
                </button>
              )}
            </div>

            {/* PAINEL DA CÂMERA (SÓ APARECE QUANDO LIGADO) */}
            {isScanning && (
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 animate-fade-in space-y-3">
                
                {/* 3 OPÇÕES SOLICITADAS */}
                <div className="flex gap-2 justify-center">
                  <button type="button" onClick={() => startScannerWithMode("user")} className="flex-1 py-1.5 px-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer shadow-sm">
                    Frontal
                  </button>
                  <button type="button" onClick={() => startScannerWithMode("environment")} className="flex-1 py-1.5 px-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer shadow-sm">
                    Traseira
                  </button>
                  <button type="button" onClick={handleStopScanner} className="flex-1 py-1.5 px-2 bg-red-50 border border-red-200 rounded-md text-xs font-semibold text-red-600 hover:bg-red-100 transition cursor-pointer shadow-sm">
                    ❌ Parar
                  </button>
                </div>

                {/* DIV ONDE O VÍDEO SERÁ RENDERIZADO */}
                <div id="reader" className="w-full overflow-hidden rounded-lg bg-black min-h-[150px]"></div>
                
                <p className="text-[11px] text-center text-gray-500">Aponte a câmera para o código do livro</p>
              </div>
            )}
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
                <Clock size={14} /> Tempo Limite
              </label>
              <input required type="number" min="1" name="tempo_limite" value={formData.tempo_limite} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-green outline-none bg-white text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-library-green rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 font-medium text-sm cursor-pointer">
              {loading ? 'A Registar...' : 'Confirmar Aluguel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}