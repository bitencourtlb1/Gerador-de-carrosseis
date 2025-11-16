
import React, { useState, useCallback, ChangeEvent, DragEvent, FC, PropsWithChildren, useEffect } from 'react';
import type { Language, GenerationMode, ApiResponse, Carousel, CsvRow, Slide } from './types';
import { TRANSLATIONS, STYLE_OPTIONS } from './constants';
import { generateCarouselsFromIA, generateCarouselsFromCSV, generateImage } from './services/geminiService';
import { LoaderIcon, UploadIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from './components/Icons';

declare const JSZip: any;
declare const saveAs: (blob: Blob, filename: string) => void;


// --- Reusable UI Components (defined in-file to reduce file count) ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}
const Button: FC<PropsWithChildren<ButtonProps>> = ({ children, isLoading, ...props }) => (
  <button
    {...props}
    className={`flex items-center justify-center w-full px-6 py-3 text-lg font-bold text-white transition-all duration-300 rounded-lg shadow-lg bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed ${props.className}`}
    disabled={isLoading || props.disabled}
  >
    {isLoading ? <LoaderIcon /> : children}
  </button>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}
const Select: FC<PropsWithChildren<SelectProps>> = ({ label, children, ...props }) => (
  <div className="w-full">
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <select {...props} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
      {children}
    </select>
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
const Input: FC<InputProps> = ({ label, ...props }) => (
  <div className="w-full">
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}</label>
    <input {...props} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
  </div>
);

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  name: string;
}
const Slider: FC<SliderProps> = ({ label, value, min, max, onChange, name }) => (
  <div className="w-full">
    <label className="block mb-2 text-sm font-medium text-gray-300">{label}: <span className="font-bold text-indigo-400">{value}</span></label>
    <input type="range" name={name} min={min} max={max} value={value} onChange={onChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
  </div>
);


// --- App Component ---

export default function App() {
  const [language, setLanguage] = useState<Language>('pt');
  const [mode, setMode] = useState<GenerationMode>('ia');
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useCallback((key: string) => TRANSLATIONS[language][key] || key, [language]);

  const handleGeneration = async (generationFn: () => Promise<ApiResponse>) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await generationFn();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadJson = () => {
    if (!results) return;
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'carrossel_data.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <Header t={t} language={language} setLanguage={setLanguage} />
      
      <main className="container px-4 py-8 mx-auto">
        <ModeSelector t={t} mode={mode} setMode={setMode} />

        <div className="p-8 mt-6 bg-gray-800 rounded-lg shadow-2xl">
          {mode === 'ia' ? <Mode1Form t={t} onGenerate={handleGeneration} isLoading={isLoading} language={language}/> : <Mode2Upload t={t} onGenerate={handleGeneration} isLoading={isLoading} language={language}/>}
        </div>

{/* Fix: Pass `downloadJson` function to `onDownload` prop instead of undefined `onDownload`. */}
        <ResultsDisplay t={t} isLoading={isLoading} error={error} results={results} onDownload={downloadJson} language={language}/>
      </main>

      <Footer t={t} />
    </div>
  );
}

// --- Child Components for App ---

const Header: FC<{ t: (key: string) => string, language: Language, setLanguage: (lang: Language) => void }> = ({ t, language, setLanguage }) => (
  <header className="py-4 bg-gray-800/50 backdrop-blur-sm shadow-lg sticky top-0 z-10">
    <div className="container flex items-center justify-between px-4 mx-auto">
      <div className="text-2xl font-bold text-white tracking-wider">{t('appName')}</div>
      <div className="flex items-center space-x-4">
        <p className="hidden text-sm text-gray-400 md:block">{t('appDescription')}</p>
        <div className="relative">
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="py-1 pl-3 pr-8 text-sm bg-gray-700 border border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="pt">PT-BR</option>
            <option value="en">EN-US</option>
            <option value="es">ES-ES</option>
          </select>
        </div>
      </div>
    </div>
  </header>
);

const ModeSelector: FC<{ t: (key: string) => string, mode: GenerationMode, setMode: (mode: GenerationMode) => void }> = ({ t, mode, setMode }) => (
  <div className="flex p-1 space-x-1 bg-gray-700 rounded-lg">
    <button onClick={() => setMode('ia')} className={`w-full py-2.5 text-sm font-medium leading-5 text-center transition rounded-md ${mode === 'ia' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>{t('generateWithIA')}</button>
    <button onClick={() => setMode('csv')} className={`w-full py-2.5 text-sm font-medium leading-5 text-center transition rounded-md ${mode === 'csv' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>{t('generateWithCSV')}</button>
  </div>
);

const Mode1Form: FC<{ t: (key: string) => string, onGenerate: (fn: () => Promise<ApiResponse>) => void, isLoading: boolean, language: Language }> = ({ t, onGenerate, isLoading, language }) => {
  const [params, setParams] = useState({
    niche: '', context: '', tone: '', slidesCount: 5, carouselsCount: 1,
    backgroundStyle: STYLE_OPTIONS.background[language][0],
    colorPalette: STYLE_OPTIONS.palette[language][0],
    typography: STYLE_OPTIONS.typography[language][0].value,
    phrasesLanguage: 'pt', cta: true, ctaType: STYLE_OPTIONS.ctaType[language][0],
  });
  
  const currentLangOptions = STYLE_OPTIONS.typography[language];

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setParams(p => ({ ...p, [name]: checked }));
    } else {
        setParams(p => ({ ...p, [name]: value }));
    }
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
     setParams(p => ({ ...p, [e.target.name]: Number(e.target.value) }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(() => generateCarouselsFromIA(params));
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Input label={t('niche')} name="niche" value={params.niche} onChange={handleChange} placeholder={t('nichePlaceholder')} required />
        <Input label={t('context')} name="context" value={params.context} onChange={handleChange} placeholder={t('contextPlaceholder')} required />
        <Input label={t('tone')} name="tone" value={params.tone} onChange={handleChange} placeholder={t('tonePlaceholder')} required />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Slider label={t('slidesCount')} name="slidesCount" value={params.slidesCount} min={2} max={10} onChange={handleSliderChange} />
        <Slider label={t('carouselsCount')} name="carouselsCount" value={params.carouselsCount} min={1} max={10} onChange={handleSliderChange} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
         <Select label={t('backgroundStyle')} name="backgroundStyle" value={params.backgroundStyle} onChange={handleChange}>
            {STYLE_OPTIONS.background[language].map((o, i) => <option key={i} value={o}>{o}</option>)}
        </Select>
        <Select label={t('colorPalette')} name="colorPalette" value={params.colorPalette} onChange={handleChange}>
            {STYLE_OPTIONS.palette[language].map((o, i) => <option key={i} value={o}>{o}</option>)}
        </Select>
        <Select label={t('typography')} name="typography" value={params.typography} onChange={handleChange}>
            {currentLangOptions.map((o, i) => <option key={i} value={o.value} style={{fontFamily: o.fontFamily}}>{o.name}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Select label={t('phrasesLanguage')} name="phrasesLanguage" value={params.phrasesLanguage} onChange={handleChange}>
            <option value="pt">Português (Brasil)</option>
            <option value="en">English (US)</option>
            <option value="es">Español (España)</option>
        </Select>
        <div className="flex items-center pt-6 space-x-4">
             <label className="text-sm font-medium text-gray-300">{t('cta')}</label>
             <input type="checkbox" name="cta" checked={params.cta} onChange={handleChange} className="w-5 h-5 rounded accent-indigo-500"/>
        </div>
        {params.cta && (
           <Select label={t('ctaType')} name="ctaType" value={params.ctaType} onChange={handleChange}>
              {STYLE_OPTIONS.ctaType[language].map((o, i) => <option key={i} value={o}>{o}</option>)}
           </Select>
        )}
      </div>
      <Button type="submit" isLoading={isLoading}>{t(isLoading ? 'generating' : 'generate')}</Button>
    </form>
  );
};

const Mode2Upload: FC<{ t: (key: string) => string, onGenerate: (fn: () => Promise<ApiResponse>) => void, isLoading: boolean, language: Language }> = ({ t, onGenerate, isLoading, language }) => {
    const [params, setParams] = useState({
        backgroundStyle: STYLE_OPTIONS.background[language][0],
        colorPalette: STYLE_OPTIONS.palette[language][0],
        typography: STYLE_OPTIONS.typography[language][0].value,
        cta: false,
    });
    const [csvData, setCsvData] = useState<CsvRow[] | null>(null);
    const [fileName, setFileName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    
    const currentLangOptions = STYLE_OPTIONS.typography[language];

    const handleChange = (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
          const { checked } = e.target as HTMLInputElement;
          setParams(p => ({ ...p, [name]: checked }));
        } else {
          setParams(p => ({ ...p, [name]: value }));
        }
    };
    
    const processFile = (file: File) => {
        if (file && file.type === 'text/csv') {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const rows = text.split('\n').slice(1); // skip header
                const data: CsvRow[] = rows.map(rowStr => {
                    const [carrossel_id, ordem_slide, ...fraseParts] = rowStr.split(',');
                    const frase = fraseParts.join(',').replace(/"/g, '').trim();
                    return { carrossel_id, ordem_slide: parseInt(ordem_slide, 10), frase };
                }).filter(r => r.carrossel_id && !isNaN(r.ordem_slide) && r.frase);
                setCsvData(data);
            };
            reader.readAsText(file);
        } else {
            alert('Por favor, envie um arquivo .csv');
        }
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFile(e.target.files[0]);
        }
    };

    const handleDragEvents = (e: DragEvent<HTMLDivElement>, dragging: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(dragging);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        handleDragEvents(e, false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!csvData || csvData.length === 0) {
        alert('Por favor, envie um arquivo CSV com dados válidos.');
        return;
      }
      onGenerate(() => generateCarouselsFromCSV(csvData, {...params, language}));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div 
                onDragEnter={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg cursor-pointer border-gray-600 hover:border-indigo-500 transition-colors ${isDragging ? 'border-indigo-500 bg-gray-700/50' : ''}`}
            >
                <UploadIcon className="w-10 h-10 mb-3 text-gray-500" />
                <p className="mb-2 text-sm text-gray-400">{t('uploadCsvInstruction')}</p>
                <label htmlFor="file-upload" className="font-medium text-indigo-400 cursor-pointer hover:underline">{t('uploadFile')}</label>
                <span className="text-gray-500"> {t('orDrag')}</span>
                <input id="file-upload" name="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                {fileName && <p className="mt-4 text-sm text-green-400">{t('fileSelected')} {fileName}</p>}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Select label={t('backgroundStyle')} name="backgroundStyle" value={params.backgroundStyle} onChange={handleChange}>
                    {STYLE_OPTIONS.background[language].map((o, i) => <option key={i} value={o}>{o}</option>)}
                </Select>
                <Select label={t('colorPalette')} name="colorPalette" value={params.colorPalette} onChange={handleChange}>
                    {STYLE_OPTIONS.palette[language].map((o, i) => <option key={i} value={o}>{o}</option>)}
                </Select>
                <Select label={t('typography')} name="typography" value={params.typography} onChange={handleChange}>
                     {currentLangOptions.map((o, i) => <option key={i} value={o.value} style={{fontFamily: o.fontFamily}}>{o.name}</option>)}
                </Select>
            </div>
            <div className="flex items-center space-x-4">
                 <label className="text-sm font-medium text-gray-300">{t('cta')}</label>
                 <input type="checkbox" name="cta" checked={params.cta} onChange={handleChange} className="w-5 h-5 rounded accent-indigo-500"/>
            </div>
            <Button type="submit" isLoading={isLoading} disabled={!csvData}>{t(isLoading ? 'generating' : 'generate')}</Button>
        </form>
    );
};


const ResultsDisplay: FC<{t: (k:string) => string, isLoading: boolean, error: string | null, results: ApiResponse | null, onDownload: () => void, language: Language}> = ({ t, isLoading, error, results, onDownload, language }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 mt-8 bg-gray-800 rounded-lg">
        <LoaderIcon />
        <p className="mt-4 text-lg">{t('generating')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 mt-8 bg-red-900/50 border border-red-500 rounded-lg">
        <h3 className="text-xl font-bold text-red-400">{t('errorTitle')}</h3>
        <p className="mt-2 text-red-300">{error}</p>
        <p className="mt-1 text-xs text-red-400">{t('errorCheckConsole')}</p>
      </div>
    );
  }

  if (!results || results.carrosseis.length === 0) {
    return (
      <div className="p-16 mt-8 text-center bg-gray-800 rounded-lg">
        <p className="text-gray-400">{t('noResults')}</p>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">{t('resultsTitle')}</h2>
        <button onClick={onDownload} className="px-4 py-2 text-sm font-semibold text-indigo-200 transition bg-indigo-600 rounded-md hover:bg-indigo-700">{t('downloadJson')}</button>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {results.carrosseis.map((carousel) => (
          <CarouselPreview key={carousel.id} carousel={carousel} t={t} language={language}/>
        ))}
      </div>
    </div>
  );
};

// --- Rendering & Utility Functions ---
{/* Fix: Updated `getFontDetails` to always return a complete style object, preventing type errors. */}
const getFontDetails = (typographyName: string, lang: Language) => {
    const defaultFont = { fontFamily: "'Montserrat', sans-serif", textTransform: 'none' as const, fontWeight: '700' };
    const fontOption = STYLE_OPTIONS.typography[lang].find(f => f.value === typographyName);
    
    if (!fontOption) {
        return defaultFont;
    }

    const details = {
        ...defaultFont,
        fontFamily: fontOption.fontFamily,
    };

    if (fontOption.value.includes('Caixa alta') || fontOption.value.includes('Uppercase') || fontOption.value.includes('Mayúsculas')) {
        details.textTransform = 'uppercase' as const;
    }

    return details;
};

const getColorPalette = (paletteName: string = '') => {
    if (paletteName.includes('Escuro') || paletteName.includes('Dark')) return { bg: '#1A1A1A', text: '#E0E0E0' };
    if (paletteName.includes('Vibrante') || paletteName.includes('Vibrant')) return { bg: 'linear-gradient(135deg, #4F46E5, #9333EA)', text: '#FFFFFF' };
    if (paletteName.includes('Neutro') || paletteName.includes('Neutral')) return { bg: '#E5E7EB', text: '#111827' };
    // Default to 'Claro'
    return { bg: '#F3EAD3', text: '#3A3A3A' };
};

const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(' ');
  let line = '';
  let lines = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
      lines++;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
  lines++;
  return lines;
};

const renderSlideToBlob = (slide: Slide, carousel: Carousel, language: Language, bgImage: HTMLImageElement | null): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        const size = 1080;
        canvas.width = size;
        canvas.height = size;
        
        // 1. Draw Background
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, size, size);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Dark overlay
            ctx.fillRect(0, 0, size, size);
        } else {
            const colors = getColorPalette(carousel.paleta_cores);
            if (typeof colors.bg === 'string' && colors.bg.startsWith('linear-gradient')) {
                const gradient = ctx.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#4F46E5');
                gradient.addColorStop(1, '#9333EA');
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = colors.bg as string;
            }
            ctx.fillRect(0, 0, size, size);
        }

        // 2. Prepare Text
        const { fontFamily, textTransform, fontWeight } = getFontDetails(carousel.tipografia || '', language);
        const { text: textColor } = getColorPalette(carousel.paleta_cores);
        const text = textTransform === 'uppercase' ? slide.frase.toUpperCase() : slide.frase;
        
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Dynamic font size
        const baseFontSize = slide.tipo === 'capa' ? 90 : 70;
        const maxTextWidth = size * 0.85;
        let fontSize = baseFontSize;
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        while (ctx.measureText(text).width > maxTextWidth * 2.5 && fontSize > 30) { // crude adjustment for wrapping
             fontSize -= 5;
             ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        }
        const lineHeight = fontSize * 1.2;
        
        // 3. Draw Text (wrapped)
        wrapText(ctx, text, size / 2, size / 2, maxTextWidth, lineHeight);

        canvas.toBlob(blob => resolve(blob), 'image/png');
    });
};

const CarouselPreview: FC<{ carousel: Carousel; t: (key: string) => string; language: Language }> = ({ carousel, t, language }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [isZipping, setIsZipping] = useState(false);

    useEffect(() => {
        const isPhotoBg = carousel.estilo_fundo?.includes('foto') || carousel.estilo_fundo?.includes('photo');
        if (isPhotoBg) {
            setIsLoadingImages(true);
            const fetchImages = async () => {
                const promises = carousel.slides.map(slide => generateImage(slide.prompt_imagem));
                const results = await Promise.all(promises);
                const urls: Record<number, string> = {};
                results.forEach((url, index) => {
                    if (url) {
                       urls[carousel.slides[index].ordem] = url;
                    }
                });
                setImageUrls(urls);
                setIsLoadingImages(false);
            };
            fetchImages();
        }
    }, [carousel]);


    const nextSlide = () => setCurrentSlide(prev => (prev + 1) % carousel.slides.length);
    const prevSlide = () => setCurrentSlide(prev => (prev - 1 + carousel.slides.length) % carousel.slides.length);
    
    const handleDownloadZip = async () => {
        setIsZipping(true);
        try {
            const zip = new JSZip();
            for (const slide of carousel.slides) {
                const imageUrl = imageUrls[slide.ordem];
                let bgImage: HTMLImageElement | null = null;

                if (imageUrl) {
                    bgImage = await new Promise(resolve => {
                       const img = new Image();
                       img.crossOrigin = 'anonymous';
                       img.onload = () => resolve(img);
                       img.onerror = () => resolve(null);
                       img.src = imageUrl;
                    });
                }
                
                const blob = await renderSlideToBlob(slide, carousel, language, bgImage);
                if (blob) {
                    zip.file(`slide_${slide.ordem}.png`, blob);
                }
            }
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${carousel.id}.zip`);
        } catch(err) {
            console.error("Failed to create ZIP", err);
            alert("Failed to create ZIP file. See console for details.");
        } finally {
            setIsZipping(false);
        }
    };

    const slide = carousel.slides[currentSlide];
    const currentImageUrl = imageUrls[slide?.ordem];

    const getBgStyle = () => {
        if (currentImageUrl) {
            return { backgroundImage: `url(${currentImageUrl})` };
        }
        const colors = getColorPalette(carousel.paleta_cores);
        return { background: colors.bg };
    }
    
    const fontDetails = getFontDetails(carousel.tipografia || '', language);
    const textStyle: React.CSSProperties = {
        fontFamily: fontDetails.fontFamily,
        textTransform: fontDetails.textTransform,
        fontWeight: fontDetails.fontWeight,
        color: getColorPalette(carousel.paleta_cores).text,
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-indigo-400 truncate flex-1 mr-2">{carousel.id}</h3>
                <button 
                  onClick={handleDownloadZip} 
                  disabled={isZipping}
                  className="flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-200 transition bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500"
                >
                  {isZipping ? <><LoaderIcon /> <span className="ml-2">{t('downloadingZip')}</span></> : <><DownloadIcon className="w-4 h-4 mr-2"/> {t('downloadZip')}</>}
                </button>
            </div>
            <div className="relative aspect-square">
                <div className={`w-full h-full rounded-md flex items-center justify-center p-8 text-center bg-cover bg-center`} style={getBgStyle()}>
                    {(isLoadingImages && !currentImageUrl) && <LoaderIcon />}
                    {(!isLoadingImages || currentImageUrl) && (
                        <>
                            {currentImageUrl && <div className="absolute inset-0 bg-black/50 rounded-md"></div>}
                            <p className="text-2xl font-bold leading-tight md:text-3xl z-10 relative" style={textStyle}>
                                {slide?.frase}
                            </p>
                        </>
                    )}
                </div>
                {carousel.slides.length > 1 && (
                    <>
                        <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full hover:bg-black/50 transition z-20"><ChevronLeftIcon /></button>
                        <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full hover:bg-black/50 transition z-20"><ChevronRightIcon /></button>
                    </>
                )}
            </div>
             <div className="flex justify-center mt-3 space-x-2">
                {carousel.slides.map((_, index) => (
                    <button key={index} onClick={() => setCurrentSlide(index)} className={`w-2.5 h-2.5 rounded-full transition ${currentSlide === index ? 'bg-indigo-500' : 'bg-gray-600 hover:bg-gray-500'}`}></button>
                ))}
            </div>
            <div className="mt-4 p-3 bg-gray-900 rounded-md text-xs text-gray-400 max-h-40 overflow-y-auto">
                <p><strong className="text-gray-200">Layout:</strong> {slide?.instrucoes_layout}</p>
                <p className="mt-2"><strong className="text-gray-200">Prompt Imagem:</strong> {slide?.prompt_imagem}</p>
            </div>
        </div>
    );
}

const Footer: FC<{ t: (key: string) => string }> = ({ t }) => (
  <footer className="py-6 mt-12 bg-gray-800 border-t border-gray-700">
    <div className="container px-4 mx-auto text-center text-gray-400">
      <p className="text-sm">{t('footerText')}</p>
      <p className="mt-2 text-xs">&copy; {new Date().getFullYear()} Gerador de Carrosséis IA</p>
    </div>
  </footer>
);
